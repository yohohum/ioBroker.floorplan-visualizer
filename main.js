'use strict';

const utils = require('@iobroker/adapter-core');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

class FloorplanVisualizer extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'floorplan-visualizer' });
        this.adminServer = null;
        this.presentationServer = null;
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info('Starting Floor Plan Visualizer v5.2...');
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
        this.startAdminServer();
        this.startPresentationServer();
    }

    findIconDirs() {
        const results = [];
        const nm = path.resolve(__dirname, '..');
        const bases = [nm, path.join(nm, '@iobroker')];
        for (const base of bases) {
            if (!fs.existsSync(base)) continue;
            let entries = [];
            try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch (e) { continue; }
            for (const ent of entries) {
                if (!ent.isDirectory()) continue;
                const pkgDir = path.join(base, ent.name);
                const candidates = [
                    path.join(pkgDir, 'icons'),
                    path.join(pkgDir, 'www', 'icons-mfd-png'),
                    path.join(pkgDir, 'www', 'icons-mfd-svg'),
                    path.join(pkgDir, 'icons-mfd-png'),
                    path.join(pkgDir, 'icons-mfd-svg'),
                    path.join(pkgDir, 'widgets', 'icons-mfd-png')
                ];
                for (const dir of candidates) {
                    try {
                        if (fs.existsSync(dir)) {
                            const files = fs.readdirSync(dir);
                            const iconFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.svg'));
                            if (iconFiles.length > 0) {
                                const baseUrl = dir.includes('svg') ? '/icons-mfd-svg/' : '/icons-mfd-png/';
                                results.push({ dir, baseUrl, count: iconFiles.length });
                            }
                        }
                    } catch (e) {}
                }
            }
        }
        return results;
    }

    buildApp() {
        const app = express();
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
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

        app.get('/api/iobroker/icons', async (req, res) => {
            try {
                const found = this.findIconDirs();
                found.sort((a, b) => (a.baseUrl.includes('png') ? 0 : 1) - (b.baseUrl.includes('png') ? 0 : 1));
                let icons = [], baseUrl = '/icons-mfd-png/', source = 'none';
                if (found.length > 0) {
                    const best = found[0];
                    baseUrl = best.baseUrl;
                    source = best.dir;
                    icons = fs.readdirSync(best.dir)
                        .filter(f => f.endsWith('.png') || f.endsWith('.svg'))
                        .map(f => f.replace(/\.(png|svg)$/, ''))
                        .sort();
                }
                this.log.info('MFD icons: ' + icons.length + ' from ' + source);
                res.json({ icons, count: icons.length, baseUrl, source, diagnostics: found.map(f => f.dir + ' (' + f.count + ')') });
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