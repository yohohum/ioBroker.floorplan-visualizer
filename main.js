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

        // Start HTTP servers
        this.startServer(this.config.adminPort || 8083, 'admin');
        this.startServer(this.config.presentationPort || 8084, 'presentation');

        this.log.info('Adapter started successfully');
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
        const app = this.buildApp();
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
     * Build Express application with all routes
     * @returns {express.Application}
     */
    buildApp() {
        const app = express();
        const self = this;

        // CORS middleware
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });

        // Version endpoint
        app.get('/api/version', (req, res) => {
            res.json({ version: this.version });
        });

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

        // Upload endpoint
        app.post('/api/upload', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                const { filename, base64Data } = req.body;
                if (!filename || !base64Data) {
                    return res.status(400).json({ error: 'Missing filename or base64Data' });
                }
                const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '');
                const data = String(base64Data).split(';base64,').pop();
                fs.writeFileSync(path.join(self.uploadDir, safeName), data, { encoding: 'base64' });
                res.json({ success: true, url: '/uploads/' + safeName });
            } catch (e) {
                self.log.error(`Upload error: ${e.message}`);
                res.status(500).json({ error: 'Upload failed' });
            }
        });

        // Config GET
        app.get('/api/config', async (req, res) => {
            try {
                const state = await this.getStateAsync('config');
                res.json(state && state.val ? JSON.parse(state.val) : { floors: [] });
            } catch (e) {
                self.log.error(`Config GET error: ${e.message}`);
                res.status(500).json({ floors: [] });
            }
        });

        // Config POST
        app.post('/api/config', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                await this.setStateAsync('config', { val: JSON.stringify(req.body), ack: true });
                res.json({ success: true });
            } catch (e) {
                self.log.error(`Config POST error: ${e.message}`);
                res.status(500).json({ error: 'Save failed' });
            }
        });

        // State GET
        app.get('/api/state/:id(*)', async (req, res) => {
            try {
                const state = await this.getForeignStateAsync(req.params.id);
                res.json({ val: state ? state.val : null });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // State POST (set value)
        app.post('/api/state/:id(*)', express.json(), async (req, res) => {
            try {
                const { val } = req.body;
                await this.setForeignStateAsync(req.params.id, val, false);
                res.json({ success: true });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        // Get all ioBroker objects (states + enums for rooms/functions)
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

        // Get MFD icons list
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