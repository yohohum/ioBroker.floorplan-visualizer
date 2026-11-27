'use strict';

/**
 * Floor Plan Visualizer - ioBroker Adapter
 * @module floorplan-visualizer
 * @version 15.3.0
 */

const utils = require('@iobroker/adapter-core');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * @typedef {Object} FloorConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [slug]
 * @property {string} [image]
 * @property {Object} [icon]
 * @property {Array<LayerConfig>} [layers]
 * @property {Array<GuideConfig>} [guides]
 */

/**
 * @typedef {Object} LayerConfig
 * @property {string} id
 * @property {string} name
 * @property {Object} [icon]
 * @property {Array<DeviceConfig>} [devices]
 */

/**
 * @typedef {Object} DeviceConfig
 * @property {string} id
 * @property {string} name
 * @property {string} objType
 * @property {Array<string>} stateIds
 * @property {number} x
 * @property {number} y
 * @property {boolean} [locked]
 * @property {number} [lockedUntil]
 * @property {Object} [icon]
 * @property {Object} [valueFont]
 * @property {Object} [nameFont]
 * @property {boolean} [showValue]
 * @property {boolean} [showName]
 * @property {Array<string>} [prefixes]
 * @property {Array<string>} [postfixes]
 * @property {number} [warnBelow]
 * @property {number} [warnAbove]
 */

/**
 * @typedef {Object} GuideConfig
 * @property {string} id
 * @property {'h'|'v'} type
 * @property {number} position
 */

/**
 * @typedef {Object} BarConfig
 * @property {number} height
 * @property {number} width
 * @property {number} gap
 * @property {number} radius
 * @property {'h'|'v'} orient
 * @property {'top'|'bottom'|'left'|'right'} position
 * @property {'center'|'left'|'right'} align
 * @property {'left'|'center'|'right'} textAlign
 * @property {Object} [icon]
 * @property {'left'|'right'} iconPos
 * @property {Object} active
 * @property {Object} inactive
 */

class FloorplanVisualizer extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options]
     */
    constructor(options = {}) {
        super({
            ...options,
            name: 'floorplan-visualizer'
        });

        /** @type {http.Server|null} */
        this.adminServer = null;
        /** @type {http.Server|null} */
        this.presentationServer = null;
        /** @type {string|null} */
        this.uploadDir = null;
        /** @type {string|null} */
        this.iconsDir = null;
        /** @type {string} */
        this.webHost = '127.0.0.1';
        /** @type {number} */
        this.webPort = 8082;
        /** @type {string|null} */
        this.adminApiToken = null;
        /** @type {Set<string>} */
        this.allowedPresentationStateIds = new Set();
        /** @type {Object|null} */
        this.currentConfig = null;

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
    }

    /**
     * Adapter ready - initialize servers and configuration
     */
    async onReady() {
        this.log.info(`Starting ${this.namespace} v${this.version}`);

        // Ensure config state exists
        await this.ensureConfigState();

        // Initialize directories
        this.uploadDir = this.getUploadDir();
        this.iconsDir = this.findIconsDir();

        // Detect web adapter port
        await this.detectWebAdapter();

        // Generate or load admin API token
        await this.initAdminApiToken();

        // Load current config and build allowed state IDs for presentation
        await this.loadConfigAndBuildAllowlist();

        // Start HTTP servers with separate apps
        this.startServer(this.config.adminPort || 8083, 'admin');
        this.startServer(this.config.presentationPort || 8084, 'presentation');

        this.log.info('Adapter started successfully');
    }

    /**
     * Initialize admin API token for authentication
     */
    async initAdminApiToken() {
        // Check if token exists in native config
        if (this.config.adminApiToken && typeof this.config.adminApiToken === 'string' && this.config.adminApiToken.length >= 32) {
            this.adminApiToken = this.config.adminApiToken;
            this.log.debug('Using existing admin API token');
        } else {
            // Generate new secure token
            this.adminApiToken = crypto.randomBytes(32).toString('hex');
            // Update native config with the new token
            const newConfig = { ...this.config, adminApiToken: this.adminApiToken };
            await this.setForeignObjectAsync(`${this.namespace}`, {
                ...(await this.getForeignObjectAsync(`${this.namespace}`)),
                native: newConfig
            });
            this.config = newConfig;
            this.log.info('Generated new admin API token');
        }
    }

    /**
     * Load config and build allowlist of state IDs that presentation can access
     */
    async loadConfigAndBuildAllowlist() {
        try {
            const state = await this.getStateAsync('config');
            if (state && state.val) {
                this.currentConfig = JSON.parse(state.val);
                this.buildPresentationAllowlist(this.currentConfig);
            }
        } catch (e) {
            this.log.warn(`Could not load config for allowlist: ${e.message}`);
        }
    }

    /**
     * Build set of allowed state IDs from config for presentation mode
     * @param {Object} config
     */
    buildPresentationAllowlist(config) {
        this.allowedPresentationStateIds.clear();
        if (!config || !Array.isArray(config.floors)) return;

        for (const floor of config.floors) {
            if (!Array.isArray(floor.layers)) continue;
            for (const layer of floor.layers) {
                if (!Array.isArray(layer.devices)) continue;
                for (const device of layer.devices) {
                    if (Array.isArray(device.stateIds)) {
                        for (const stateId of device.stateIds) {
                            if (stateId && typeof stateId === 'string') {
                                this.allowedPresentationStateIds.add(stateId);
                            }
                        }
                    }
                }
            }
        }
        this.log.debug(`Presentation allowlist contains ${this.allowedPresentationStateIds.size} state IDs`);
    }

    /**
     * Check if a state ID is allowed for presentation access
     * @param {string} stateId
     * @returns {boolean}
     */
    isStateAllowedForPresentation(stateId) {
        return this.allowedPresentationStateIds.has(stateId);
    }

    /**
     * Middleware to verify admin API token
     * @param {express.Request} req
     * @param {express.Response} res
     * @param {Function} next
     */
    requireAdminAuth(req, res, next) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.query.token;

        if (!token || token !== this.adminApiToken) {
            this.log.warn(`Unauthorized admin API access from ${req.ip}: ${req.method} ${req.path}`);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    }

    /**
     * Middleware to verify presentation access (read-only, allowlisted states only)
     * @param {express.Request} req
     * @param {express.Response} res
     * @param {Function} next
     */
    requirePresentationAuth(req, res, next) {
        // For presentation, we allow read access to config and version without auth
        // but state writes require the state to be in allowlist
        next();
    }

    /**
     * Ensure config state exists with default structure
     */
    async ensureConfigState() {
        const defaultConfig = {
            floors: [],
            templates: [],
            screenBg: '#f7f9fc',
            planBg: '#2a2f36',
            backdropRadius: 16,
            scaleMode: 'height',
            floorBar: null,
            layerBar: null
        };

        await this.setObjectNotExistsAsync('config', {
            type: 'state',
            common: {
                name: 'Floorplan Configuration',
                type: 'json',
                role: 'config',
                read: true,
                write: true,
                desc: 'Visualizer configuration (floors, layers, devices, settings)'
            },
            native: {}
        });

        const existing = await this.getStateAsync('config');
        if (!existing || !existing.val) {
            await this.setStateAsync('config', { val: JSON.stringify(defaultConfig), ack: true });
            this.log.debug('Created default configuration');
        }
    }

    /**
     * Get upload directory for user files
     * @returns {string}
     */
    getUploadDir() {
        let baseDir;
        try {
            baseDir = utils.getAbsoluteDefaultDataDir();
        } catch (e) {
            baseDir = '/opt/iobroker/iobroker-data';
        }
        const dir = path.join(baseDir, 'floorplan-visualizer.0', 'uploads');
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (e) {
            this.log.warn(`Could not create upload directory: ${e.message}`);
        }
        return dir;
    }

    /**
     * Find MFD icons directory
     * @returns {string|null}
     */
    findIconsDir() {
        const candidates = [
            '/opt/iobroker/iobroker-data/files/icons-mfd-png',
            path.join(process.cwd(), 'iobroker-data', 'files', 'icons-mfd-png'),
            path.join(__dirname, '..', '..', 'iobroker-data', 'files', 'icons-mfd-png'),
            path.join(__dirname, '..', 'iobroker.icons-mfd-png')
        ];

        for (const dir of candidates) {
            try {
                if (fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.endsWith('.png'))) {
                    return dir;
                }
            } catch (e) {
                // ignore
            }
        }
        return null;
    }

    /**
     * Detect web adapter port for icon proxying
     */
    async detectWebAdapter() {
        try {
            const webAdapter = await this.getForeignObjectAsync('system.adapter.web.0');
            if (webAdapter && webAdapter.native && webAdapter.native.port) {
                this.webPort = webAdapter.native.port;
            }
        } catch (e) {
            this.log.debug('Web adapter not found, using default port');
        }
    }

    /**
     * Start HTTP server
     * @param {number} port
     * @param {'admin'|'presentation'} kind
     */
    startServer(port, kind) {
        const app = kind === 'admin' ? this.buildAdminApp() : this.buildPresentationApp();
        const server = http.createServer(app);

        server.listen(port, this.config.bind || '0.0.0.0', () => {
            this.log.info(`${kind} server listening on ${this.config.bind || '0.0.0.0'}:${port}`);
        });

        server.on('error', (err) => {
            this.log.error(`${kind} server error: ${err.message}`);
        });

        if (kind === 'admin') {
            this.adminServer = server;
        } else {
            this.presentationServer = server;
        }
    }

    /**
     * Build Express application for admin interface (full access with auth)
     * @returns {express.Application}
     */
    buildAdminApp() {
        const app = express();
        const self = this;

        // CORS middleware - restrict to same origin in production
        app.use((req, res, next) => {
            const origin = req.headers.origin;
            // Allow localhost and configured origins
            const allowedOrigins = [
                'http://localhost:8083',
                'http://localhost:8084',
                'http://127.0.0.1:8083',
                'http://127.0.0.1:8084'
            ];
            if (origin && allowedOrigins.includes(origin)) {
                res.header('Access-Control-Allow-Origin', origin);
            }
            res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Credentials', 'true');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });

        // Body parsers with size limits
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Version endpoint (public)
        app.get('/api/version', (req, res) => {
            res.json({ version: this.version });
        });

        // Admin auth required for all other endpoints
        app.use('/api', self.requireAdminAuth.bind(self));

        // Icon proxy endpoint
        const iconHandler = (req, res) => {
            let name = path.basename(req.params.name);
            if (!/\.(png|svg)$/i.test(name)) name += '.png';

            res.setHeader('Cache-Control', 'no-cache');

            if (self.iconsDir) {
                const filePath = path.join(self.iconsDir, name);
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', name.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
                    fs.createReadStream(filePath).pipe(res);
                } else {
                    res.status(404).send('Not found');
                }
            } else {
                http.get(`http://${self.webHost}:${self.webPort}/icons-mfd-png/${name}`, (r) => {
                    res.setHeader('Content-Type', r.headers['content-type'] || 'image/png');
                    res.status(r.statusCode);
                    r.pipe(res);
                }).on('error', () => res.status(500).send('Proxy error'));
            }
        };
        app.get('/icons-mfd-png/:name', iconHandler);

        // Static file serving
        app.use('/uploads', express.static(this.uploadDir, { maxAge: 0 }));
        app.use(express.static(path.join(__dirname, 'www'), { maxAge: 0, fallthrough: true }));

        // Favicon
        app.get('/favicon.ico', (req, res) => res.status(204).end());

        // Upload endpoint (admin only)
        app.post('/api/upload', async (req, res) => {
            try {
                const { filename, base64Data } = req.body;
                if (!filename || !base64Data) {
                    return res.status(400).json({ error: 'Missing filename or base64Data' });
                }
                // Sanitize filename - prevent path traversal
                const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '');
                if (safeName !== filename) {
                    return res.status(400).json({ error: 'Invalid filename' });
                }
                // Validate base64 data
                const base64Part = String(base64Data).split(';base64,').pop();
                if (!/^[A-Za-z0-9+/=]+$/.test(base64Part)) {
                    return res.status(400).json({ error: 'Invalid base64 data' });
                }
                const data = Buffer.from(base64Part, 'base64');
                // Limit file size to 10MB
                if (data.length > 10 * 1024 * 1024) {
                    return res.status(400).json({ error: 'File too large (max 10MB)' });
                }
                const filePath = path.join(self.uploadDir, safeName);
                // Ensure path is within upload directory
                if (!filePath.startsWith(self.uploadDir)) {
                    return res.status(400).json({ error: 'Invalid file path' });
                }
                fs.writeFileSync(filePath, data);
                res.json({ success: true, url: '/uploads/' + safeName });
            } catch (e) {
                self.log.error(`Upload error: ${e.message}`);
                res.status(500).json({ error: 'Upload failed' });
            }
        });

        // Config GET (admin only)
        app.get('/api/config', async (req, res) => {
            try {
                const state = await this.getStateAsync('config');
                res.json(state && state.val ? JSON.parse(state.val) : { floors: [] });
            } catch (e) {
                self.log.error(`Config GET error: ${e.message}`);
                res.status(500).json({ floors: [] });
            }
        });

        // Config POST (admin only)
        app.post('/api/config', async (req, res) => {
            try {
                await this.setStateAsync('config', { val: JSON.stringify(req.body), ack: true });
                // Reload config and rebuild allowlist
                await self.loadConfigAndBuildAllowlist();
                res.json({ success: true });
            } catch (e) {
                self.log.error(`Config POST error: ${e.message}`);
                res.status(500).json({ error: 'Save failed' });
            }
        });

        // State GET (admin only - can read any state)
        app.get('/api/state/:id(*)', async (req, res) => {
            try {
                const state = await this.getForeignStateAsync(req.params.id);
                res.json({ val: state ? state.val : null });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // State POST (admin only - can write any state)
        app.post('/api/state/:id(*)', async (req, res) => {
            try {
                const { val } = req.body;
                await this.setForeignStateAsync(req.params.id, val, false);
                res.json({ success: true });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // Get all ioBroker objects (admin only)
        app.get('/api/iobroker/objects', async (req, res) => {
            try {
                const [states, enums] = await Promise.all([
                    this.getForeignObjectsAsync('*', 'state'),
                    this.getForeignObjectsAsync('enum.*', 'enum').catch(() => ({}))
                ]);

                const rooms = [];
                const functions = [];

                for (const id in enums) {
                    const e = enums[id];
                    if (!e || !e.common) continue;
                    const name = typeof e.common.name === 'object'
                        ? (e.common.name.ru || e.common.name.en || e.common.name.de || id)
                        : (e.common.name || id);
                    const members = e.common.members || [];
                    if (id.startsWith('enum.rooms.')) rooms.push({ members, name });
                    else if (id.startsWith('enum.functions.')) functions.push({ members, name });
                }

                const match = (list, objId) =>
                    list.filter(g => g.members.some(m => objId === m || objId.startsWith(m + '.')))
                        .map(g => g.name)
                        .join(', ');

                const result = [];
                for (const id in states) {
                    const obj = states[id];
                    if (obj && obj.common) {
                        const name = typeof obj.common.name === 'object'
                            ? (obj.common.name.ru || obj.common.name.en || obj.common.name.de || id)
                            : (obj.common.name || id);
                        result.push({
                            id,
                            name,
                            role: obj.common.role || '',
                            room: match(rooms, id),
                            func: match(functions, id)
                        });
                    }
                }

                result.sort((a, b) => a.id.localeCompare(b.id));
                res.json(result);
            } catch (e) {
                self.log.error(`Objects API error: ${e.message}`);
                res.status(500).json({ error: e.message });
            }
        });

        // Get MFD icons list (admin only)
        app.get('/api/iobroker/icons', async (req, res) => {
            try {
                let icons = [];
                if (self.iconsDir) {
                    icons = fs.readdirSync(self.iconsDir)
                        .filter(f => f.endsWith('.png'))
                        .map(f => f.replace(/\.png$/, ''))
                        .sort();
                }
                res.json({ icons, count: icons.length, baseUrl: '/icons-mfd-png/' });
            } catch (e) {
                res.status(500).json({ icons: [], count: 0, baseUrl: '/icons-mfd-png/' });
            }
        });

        // 404 handler
        app.use((req, res) => res.status(404).json({ error: 'Not found' }));

        // Error handler - don't leak stack traces
        app.use((err, req, res, _next) => {
            self.log.error(`Admin API error: ${err.message}`);
            res.status(500).json({ error: 'Internal server error' });
        });

        return app;
    }

    /**
     * Build Express application for presentation interface (restricted access)
     * @returns {express.Application}
     */
    buildPresentationApp() {
        const app = express();
        const self = this;

        // CORS middleware - restrict to same origin
        app.use((req, res, next) => {
            const origin = req.headers.origin;
            const allowedOrigins = [
                'http://localhost:8083',
                'http://localhost:8084',
                'http://127.0.0.1:8083',
                'http://127.0.0.1:8084'
            ];
            if (origin && allowedOrigins.includes(origin)) {
                res.header('Access-Control-Allow-Origin', origin);
            }
            res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });

        // Body parser with size limit
        app.use(express.json({ limit: '1mb' }));

        // Version endpoint (public)
        app.get('/api/version', (req, res) => {
            res.json({ version: this.version });
        });

        // Presentation auth for all other endpoints
        app.use('/api', self.requirePresentationAuth.bind(self));

        // Icon proxy endpoint (public for presentation)
        const iconHandler = (req, res) => {
            let name = path.basename(req.params.name);
            if (!/\.(png|svg)$/i.test(name)) name += '.png';

            res.setHeader('Cache-Control', 'no-cache');

            if (self.iconsDir) {
                const filePath = path.join(self.iconsDir, name);
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', name.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
                    fs.createReadStream(filePath).pipe(res);
                } else {
                    res.status(404).send('Not found');
                }
            } else {
                http.get(`http://${self.webHost}:${self.webPort}/icons-mfd-png/${name}`, (r) => {
                    res.setHeader('Content-Type', r.headers['content-type'] || 'image/png');
                    res.status(r.statusCode);
                    r.pipe(res);
                }).on('error', () => res.status(500).send('Proxy error'));
            }
        };
        app.get('/icons-mfd-png/:name', iconHandler);

        // Static file serving for presentation
        app.use(express.static(path.join(__dirname, 'www'), { maxAge: 0, fallthrough: true }));

        // Favicon
        app.get('/favicon.ico', (req, res) => res.status(204).end());

        // Config GET (read-only, no auth required for presentation)
        app.get('/api/config', async (req, res) => {
            try {
                const state = await this.getStateAsync('config');
                const config = state && state.val ? JSON.parse(state.val) : { floors: [] };
                // For presentation, we can return full config or sanitized version
                res.json(config);
            } catch (e) {
                self.log.error(`Presentation Config GET error: ${e.message}`);
                res.status(500).json({ floors: [] });
            }
        });

        // State GET (presentation - only allowlisted states)
        app.get('/api/state/:id(*)', async (req, res) => {
            try {
                const stateId = req.params.id;
                // Check if state is in allowlist
                if (!self.isStateAllowedForPresentation(stateId)) {
                    return res.status(403).json({ error: 'State not accessible in presentation mode' });
                }
                const state = await this.getForeignStateAsync(stateId);
                res.json({ val: state ? state.val : null });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // State POST (presentation - only allowlisted states, only for controllable devices)
        app.post('/api/state/:id(*)', async (req, res) => {
            try {
                const stateId = req.params.id;
                // Check if state is in allowlist
                if (!self.isStateAllowedForPresentation(stateId)) {
                    return res.status(403).json({ error: 'State not controllable in presentation mode' });
                }
                const { val } = req.body;
                await this.setForeignStateAsync(stateId, val, false);
                res.json({ success: true });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // 404 handler
        app.use((req, res) => res.status(404).json({ error: 'Not found' }));

        // Error handler
        app.use((err, req, res, _next) => {
            self.log.error(`Presentation API error: ${err.message}`);
            res.status(500).json({ error: 'Internal server error' });
        });

        return app;
    }

    /**
     * Handle object changes (e.g., config updates)
     * @param {string} id
     * @param {ioBroker.Object|null} obj
     */
    onObjectChange(id, obj) {
        if (obj && id === `${this.namespace}.config`) {
            this.log.debug('Config object changed');
        }
    }

    /**
     * Handle state changes
     * @param {string} id
     * @param {ioBroker.State|null} state
     */
    onStateChange(id, state) {
        if (state && id === `${this.namespace}.config`) {
            this.log.debug('Config state changed');
            this.loadConfigAndBuildAllowlist();
        }
    }

    /**
     * Cleanup on unload
     * @param {Function} callback
     */
    async onUnload(callback) {
        try {
            if (this.adminServer) {
                await new Promise((resolve) => this.adminServer.close(resolve));
            }
            if (this.presentationServer) {
                await new Promise((resolve) => this.presentationServer.close(resolve));
            }
            this.log.info('Adapter stopped');
            callback();
        } catch (e) {
            this.log.error(`Unload error: ${e.message}`);
            callback();
        }
    }
}

// Start adapter if run directly
if (require.main === module) {
    new FloorplanVisualizer();
}

module.exports = (options) => new FloorplanVisualizer(options);