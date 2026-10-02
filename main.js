'use strict';

const utils = require('@iobroker/adapter-core');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

class FloorplanVisualizer extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'floorplan-visualizer' });
        this.adminServer = null;
        this.presentationServer = null;
        this.adminIO = null;
        this.presentationIO = null;
        this.subscribedStates = new Set();

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info('Starting Floor Plan Visualizer v4.0.0...');

        await this.setObjectNotExistsAsync('config', {
            type: 'state',
            common: { name: 'Floor Plan Configuration', type: 'json', role: 'config', read: true, write: true },
            native: {}
        });

        const configState = await this.getStateAsync('config');
        if (!configState || !configState.val) {
            const defaultConfig = {
                elementTypes: [
                    {
                        id: 'lighting', name: 'Освещение', iconSize: 48, iconOpacity: 1.0, textPosition: 'bottom',
                        colors: { active: '#f39c12', inactive: '#7f8c8d', warning: '#e74c3c', safe: '#2ecc71' },
                        font: { family: 'Arial, sans-serif', weight: 'bold', size: '12px', color: '#ffffff' }
                    },
                    {
                        id: 'socket', name: 'Розетки', iconSize: 48, iconOpacity: 1.0, textPosition: 'bottom',
                        colors: { active: '#e67e22', inactive: '#7f8c8d', warning: '#e74c3c', safe: '#2ecc71' },
                        font: { family: 'Arial, sans-serif', weight: 'bold', size: '12px', color: '#ffffff' }
                    },
                    {
                        id: 'sensor', name: 'Датчики', iconSize: 56, iconOpacity: 0.9, textPosition: 'overlay',
                        colors: { active: '#3498db', inactive: '#7f8c8d', warning: '#e74c3c', safe: '#2ecc71' },
                        font: { family: 'Arial, sans-serif', weight: 'bold', size: '14px', color: '#ffffff' }
                    },
                    {
                        id: 'security', name: 'Безопасность', iconSize: 48, iconOpacity: 1.0, textPosition: 'bottom',
                        colors: { active: '#2ecc71', inactive: '#7f8c8d', warning: '#e74c3c', safe: '#2ecc71' },
                        font: { family: 'Arial, sans-serif', weight: 'bold', size: '12px', color: '#ffffff' }
                    }
                ],
                floors: [
                    {
                        id: 'floor_1', name: '1 этаж', image: '',
                        layers: [
                            { id: 'layer_1', name: 'Свет', type: 'lighting', devices: [] },
                            { id: 'layer_2', name: 'Датчики', type: 'sensor', devices: [] }
                        ]
                    }
                ]
            };
            await this.setStateAsync('config', { val: JSON.stringify(defaultConfig, null, 2), ack: true });
            this.log.info('Default v4.0.0 configuration created.');
        }

        const uploadDir = path.join(__dirname, 'www', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        this.startAdminServer();
        this.startPresentationServer();
    }

    startAdminServer() {
        const port = this.config.adminPort || 8083;
        const bind = this.config.bind || '0.0.0.0';
        const app = express();

        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });

        app.use(express.static(path.join(__dirname, 'www')));

        app.post('/api/upload', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                const { filename, base64Data } = req.body;
                const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
                const filePath = path.join(__dirname, 'www', 'uploads', safeFilename);
                fs.writeFileSync(filePath, base64Data.split(';base64,').pop(), { encoding: 'base64' });
                res.json({ success: true, url: `/uploads/${safeFilename}` });
            } catch (error) {
                res.status(500).json({ error: 'Upload failed' });
            }
        });

        app.get('/api/config', async (req, res) => {
            const state = await this.getStateAsync('config');
            res.json(state && state.val ? JSON.parse(state.val) : { elementTypes: [], floors: [] });
        });

        app.post('/api/config', express.json({ limit: '10mb' }), async (req, res) => {
            await this.setStateAsync('config', { val: JSON.stringify(req.body, null, 2), ack: true });
            this.adminIO.emit('configChanged', req.body);
            this.presentationIO.emit('configChanged', req.body);
            res.json({ success: true });
        });

        app.post('/api/state/:id(*)', express.json(), async (req, res) => {
            await this.setForeignStateAsync(req.params.id, req.body.val, false);
            res.json({ success: true });
        });

        this.adminServer = http.createServer(app);
        this.adminIO = socketIO(this.adminServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
        this.setupSocket(this.adminIO);
        this.adminServer.listen(port, bind, () => this.log.info(`Admin server on http://${bind}:${port}`));
    }

    startPresentationServer() {
        const port = this.config.presentationPort || 8084;
        const bind = this.config.bind || '0.0.0.0';
        const app = express();

        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            next();
        });
        app.use(express.static(path.join(__dirname, 'www')));

        app.get('/api/config', async (req, res) => {
            const state = await this.getStateAsync('config');
            res.json(state && state.val ? JSON.parse(state.val) : { elementTypes: [], floors: [] });
        });

        app.post('/api/state/:id(*)', express.json(), async (req, res) => {
            await this.setForeignStateAsync(req.params.id, req.body.val, false);
            res.json({ success: true });
        });

        this.presentationServer = http.createServer(app);
        this.presentationIO = socketIO(this.presentationServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
        this.setupSocket(this.presentationIO);
        this.presentationServer.listen(port, bind, () => this.log.info(`Presentation server on http://${bind}:${port}`));
    }

    setupSocket(io) {
        io.on('connection', (socket) => {
            socket.on('subscribe', (stateId) => { this.subscribedStates.add(stateId); socket.join(stateId); });
            socket.on('unsubscribe', (stateId) => { this.subscribedStates.delete(stateId); socket.leave(stateId); });
            socket.on('getState', async (stateId, callback) => {
                try { const state = await this.getForeignStateAsync(stateId); if (callback) callback(null, state); } 
                catch (e) { if (callback) callback(e, null); }
            });
            socket.on('setState', async (stateId, value, callback) => {
                try { await this.setForeignStateAsync(stateId, value, false); if (callback) callback(null); } 
                catch (e) { if (callback) callback(e); }
            });
        });
    }

    async onStateChange(id, state) {
        if (!state) return;
        if (id === `${this.namespace}.config`) {
            const config = JSON.parse(state.val);
            this.adminIO.emit('configChanged', config);
            this.presentationIO.emit('configChanged', config);
            return;
        }
        if (this.subscribedStates.has(id)) {
            this.adminIO.to(id).emit('stateChange', id, state);
            this.presentationIO.to(id).emit('stateChange', id, state);
        }
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