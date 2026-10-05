'use strict';

const utils = require('@iobroker/adapter-core');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

class FloorplanVisualizer extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'floorplan-visualizer' });
        this.adminServer = null;
        this.presentationServer = null;
        this.iconsDir = null;
        this.ioBrokerWebHost = '127.0.0.1';
        this.ioBrokerWebPort = 8082;
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info('Starting Floor Plan Visualizer v5.4...');
        await this.setObjectNotExistsAsync('config', {
            type: 'state',
            common: { name: 'Floor Plan Configuration', type: 'json', role: 'config', read: true, write: true },
            native: {}
        });
        const configState = await this.getStateAsync('config');
        if (!configState || !configState.val) {
            const defaultConfig = {
                elementTypes: [
                    { id: 'lighting', name: 'Освещение', iconSize: 48, iconOpacity: 1.0, textPosition: 'bottom',
                      colors: { active: '#f39c12', inactive: '#7f8c8d', warning: '#e74c3c', safe: '#2ecc71' },
                      font: { family: 'Arial, sans-serif', weight: 'bold', size: '12px', color: '#ffffff' } },
                    { id: 'sensor', name: 'Датчики', iconSize: 56, iconOpacity: 0.9, textPosition: 'overlay',
                      colors: { active: '#3498db', inactive: '#7f8c8d', warning: '#e74c3c', safe: '#2ecc71' },
                      font: { family: 'Arial, sans-serif', weight: 'bold', size: '14px', color: '#ffffff' } }
                ],
                floors: []
            };
            await this.setStateAsync('config', { val: JSON.stringify(defaultConfig, null, 2), ack: true });
        }
        const uploadDir = path.join(__dirname, 'www', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        
        // Поиск папки с MFD-иконками в iobroker-data
        this.iconsDir = this.findIconsDirectory();
        
        // Получаем порт веб-адаптера из ioBroker
        await this.detectWebPort();
        
        if (this.iconsDir) {
            this.log.info('MFD icons found at: ' + this.iconsDir);
        } else {
            this.log.info('MFD icons directory not found, will use proxy to ioBroker web server at ' + this.ioBrokerWebHost + ':' + this.ioBrokerWebPort);
        }
        
        this.startAdminServer();
        this.startPresentationServer();
    }

    // === ПОИСК ПАПКИ С ИКОНКАМИ В iobroker-data ===
    findIconsDirectory() {
        const searchPaths = [
            '/opt/iobroker/iobroker-data/files/icons-mfd-png',
            '/opt/iobroker/iobroker-data/files/icons-mfd-svg',
            path.join(process.cwd(), 'iobroker-data', 'files', 'icons-mfd-png'),
            path.join(process.cwd(), 'iobroker-data', 'files', 'icons-mfd-svg'),
            path.join(__dirname, '..', '..', 'iobroker-data', 'files', 'icons-mfd-png'),
            path.join(__dirname, '..', 'iobroker.icons-mfd-png')
        ];
        
        for (const p of searchPaths) {
            try {
                if (fs.existsSync(p)) {
                    const files = fs.readdirSync(p);
                    const iconFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.svg'));
                    if (iconFiles.length > 0) {
                        return p;
                    }
                }
            } catch (e) {
                this.log.debug('Cannot read ' + p + ': ' + e.message);
            }
        }
        return null;
    }

    // === ОПРЕДЕЛЕНИЕ ПОРТА ВЕБ-АДАПТЕРА ===
    async detectWebPort() {
        try {
            const webInstance = await this.getObjectAsync('system.adapter.web.0');
            if (webInstance && webInstance.native && webInstance.native.port) {
                this.ioBrokerWebPort = webInstance.native.port;
                this.log.info('Detected ioBroker web adapter port: ' + this.ioBrokerWebPort);
            }
        } catch (e) {
            this.log.debug('Cannot detect web port: ' + e.message);
        }
    }

    buildApp() {
        const app = express();
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
        
        // === ОТДАЧА ИКОНОК ===
        if (this.iconsDir) {
            // Если нашли папку - раздаём напрямую
            app.use('/icons-mfd-png', express.static(this.iconsDir));
            app.use('/icons-mfd-svg', express.static(this.iconsDir));
        } else {
            // Если не нашли - проксируем к веб-серверу ioBroker
            app.use('/icons-mfd-png', (req, res) => {
                const iconPath = req.url;
                const proxyUrl = `http://${this.ioBrokerWebHost}:${this.ioBrokerWebPort}/icons-mfd-png${iconPath}`;
                
                const proxyReq = http.get(proxyUrl, (proxyRes) => {
                    res.set(proxyRes.headers);
                    res.status(proxyRes.statusCode);
                    proxyRes.pipe(res);
                });
                
                proxyReq.on('error', (err) => {
                    this.log.error('Proxy error for ' + iconPath + ': ' + err.message);
                    res.status(404).send('Icon not found');
                });
                
                proxyReq.end();
            });
            
            app.use('/icons-mfd-svg', (req, res) => {
                const iconPath = req.url;
                const proxyUrl = `http://${this.ioBrokerWebHost}:${this.ioBrokerWebPort}/icons-mfd-svg${iconPath}`;
                
                const proxyReq = http.get(proxyUrl, (proxyRes) => {
                    res.set(proxyRes.headers);
                    res.status(proxyRes.statusCode);
                    proxyRes.pipe(res);
                });
                
                proxyReq.on('error', (err) => {
                    this.log.error('Proxy error for ' + iconPath + ': ' + err.message);
                    res.status(404).send('Icon not found');
                });
                
                proxyReq.end();
            });
        }
        
        app.use(express.static(path.join(__dirname, 'www')));
        app.get('/favicon.ico', (req, res) => res.status(204));

        app.post('/api/upload', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                const { filename, base64Data } = req.body;
                const safeFilename = String(filename).replace(/[^a-zA-Z0-9._-]/g, '');
                const filePath = path.join(__dirname, 'www', 'uploads', safeFilename);
                fs.writeFileSync(filePath, String(base64Data).split(';base64,').pop(), { encoding: 'base64' });
                res.json({ success: true, url: '/uploads/' + safeFilename });
            } catch (error) {
                this.log.error('Upload error: ' + error);
                res.status(500).json({ error: 'Upload failed' });
            }
        });

        app.get('/api/config', async (req, res) => {
            try {
                const state = await this.getStateAsync('config');
                res.json(state && state.val ? JSON.parse(state.val) : { elementTypes: [], floors: [] });
            } catch (e) { res.status(500).json({ error: 'Failed' }); }
        });

        app.post('/api/config', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                await this.setStateAsync('config', { val: JSON.stringify(req.body, null, 2), ack: true });
                res.json({ success: true });
            } catch (e) { res.status(500).json({ error: 'Failed' }); }
        });

        app.get('/api/state/:id(*)', async (req, res) => {
            try {
                const state = await this.getForeignStateAsync(req.params.id);
                res.json({ id: req.params.id, val: state ? state.val : null });
            } catch (e) { res.status(500).json({ error: 'Failed' }); }
        });

        app.post('/api/state/:id(*)', express.json(), async (req, res) => {
            try {
                await this.setForeignStateAsync(req.params.id, req.body.val, false);
                res.json({ success: true });
            } catch (e) { res.status(500).json({ error: 'Failed' }); }
        });

        app.get('/api/iobroker/objects', async (req, res) => {
            try {
                const objects = await this.getForeignObjectsAsync('*', 'state');
                const result = [];
                for (const id in objects) {
                    const obj = objects[id];
                    if (obj && obj.common) {
                        const name = typeof obj.common.name === 'object'
                            ? (obj.common.name.ru || obj.common.name.en || obj.common.name.de || id)
                            : (obj.common.name || id);
                        result.push({ id, name, type: obj.common.type || 'unknown', role: obj.common.role || '' });
                    }
                }
                result.sort((a, b) => a.id.localeCompare(b.id));
                res.json(result);
            } catch (e) {
                this.log.error('Get objects error: ' + e);
                res.status(500).json({ error: e.message });
            }
        });

        // === API для MFD-иконок ===
        app.get('/api/iobroker/icons', async (req, res) => {
            try {
                let icons = [];
                let source = 'none';
                let baseUrl = '/icons-mfd-png/';
                
                if (this.iconsDir) {
                    const files = fs.readdirSync(this.iconsDir);
                    icons = files
                        .filter(f => f.endsWith('.png'))
                        .map(f => f.replace(/\.png$/, ''))
                        .sort();
                    source = this.iconsDir;
                } else {
                    // Пробуем получить список через прокси к index.html
                    const proxyUrl = `http://${this.ioBrokerWebHost}:${this.ioBrokerWebPort}/icons-mfd-png/index.html`;
                    try {
                        const response = await new Promise((resolve, reject) => {
                            http.get(proxyUrl, (res) => {
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => resolve(data));
                            }).on('error', reject);
                        });
                        
                        // Парсим HTML чтобы извлечь имена иконок
                        const matches = response.match(/[a-z0-9_-]+\.png/gi);
                        if (matches) {
                            icons = [...new Set(matches.map(f => f.replace(/\.png$/, '')))].sort();
                        }
                        source = 'proxy:' + proxyUrl;
                    } catch (e) {
                        this.log.warn('Cannot fetch icons list from proxy: ' + e.message);
                        icons = [];
                        source = 'error:' + e.message;
                    }
                }
                
                this.log.info('MFD icons: ' + icons.length + ' from ' + source);
                res.json({
                    icons,
                    count: icons.length,
                    baseUrl,
                    source,
                    diagnostics: [source]
                });
            } catch (e) {
                this.log.error('Get icons error: ' + e);
                res.status(500).json({ error: e.message });
            }
        });

        return app;
    }

    startAdminServer() {
        const port = this.config.adminPort || 8083;
        const bind = this.config.bind || '0.0.0.0';
        const app = this.buildApp();
        this.adminServer = http.createServer(app);
        this.adminServer.listen(port, bind, () => this.log.info('Admin server on http://' + bind + ':' + port));
        this.adminServer.on('error', (e) => this.log.error('Admin server error: ' + e));
    }

    startPresentationServer() {
        const port = this.config.presentationPort || 8084;
        const bind = this.config.bind || '0.0.0.0';
        const app = this.buildApp();
        this.presentationServer = http.createServer(app);
        this.presentationServer.listen(port, bind, () => this.log.info('Presentation server on http://' + bind + ':' + port));
        this.presentationServer.on('error', (e) => this.log.error('Presentation server error: ' + e));
    }

    async onUnload(callback) {
        try {
            if (this.adminServer) this.adminServer.close();
            if (this.presentationServer) this.presentationServer.close();
            callback();
        } catch (error) { callback(); }
    }
}

if (module === require.main) { new FloorplanVisualizer(); }
module.exports = (options) => new FloorplanVisualizer(options);