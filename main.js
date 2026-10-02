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
        this.server = null;
        this.io = null;
        this.app = express();
        this.subscribedStates = new Set();

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info('Starting Floor Plan Visualizer v2.0.0...');

        await this.setObjectNotExistsAsync('config', {
            type: 'state',
            common: { name: 'Floor Plan Configuration', type: 'json', role: 'config', read: true, write: true },
            native: {}
        });

        const configState = await this.getStateAsync('config');
        if (!configState || !configState.val) {
            const defaultConfig = {
                globalSettings: {
                    iconSize: 48,
                    iconOpacity: 1.0,
                    colors: {
                        lightOn: '#f39c12', lightOff: '#7f8c8d',
                        socketOn: '#e67e22', socketOff: '#7f8c8d',
                        sensorNormal: '#3498db', sensorHigh: '#e74c3c', sensorLow: '#2ecc71',
                        securityNormal: '#2ecc71', securityTriggered: '#e74c3c'
                    },
                    sensorFont: { family: 'Arial, sans-serif', weight: 'bold', size: '12px', color: '#ffffff' }
                },
                floors: [
                    {
                        id: 'floor_1', name: '1 этаж', image: '',
                        layers: [
                            { id: 'layer_1', name: 'Освещение', type: 'lighting', devices: [] },
                            { id: 'layer_2', name: 'Датчики', type: 'sensor', devices: [] }
                        ]
                    }
                ]
            };
            await this.setStateAsync('config', { val: JSON.stringify(defaultConfig, null, 2), ack: true });
            this.log.info('Default v2.0.0 configuration created.');
        }

        // Создаем папку для загрузок, если её нет
        const uploadDir = path.join(__dirname, 'www', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        this.setupExpress();
        this.startServer();
    }

    setupExpress() {
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });

        const wwwDir = path.join(__dirname, 'www');
        this.app.use(express.static(wwwDir));

        // API: Загрузка изображения (Base64 -> Файл)
        this.app.post('/api/upload', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                const { filename, base64Data } = req.body;
                if (!filename || !base64Data) throw new Error('Missing data');
                
                const uploadDir = path.join(__dirname, 'www', 'uploads');
                const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, ''); // Защита от path traversal
                const filePath = path.join(uploadDir, safeFilename);
                
                const base64Image = base64Data.split(';base64,').pop();
                fs.writeFileSync(filePath, base64Image, { encoding: 'base64' });
                
                const publicUrl = `/floorplan-visualizer/uploads/${safeFilename}`;
                this.log.info(`Image uploaded: ${publicUrl}`);
                res.json({ success: true, url: publicUrl });
            } catch (error) {
                this.log.error('Upload error: ' + error);
                res.status(500).json({ error: 'Upload failed' });
            }
        });

        this.app.get('/api/config', async (req, res) => {
            try {
                const state = await this.getStateAsync('config');
                res.json(state && state.val ? JSON.parse(state.val) : { floors: [] });
            } catch (error) {
                this.log.error('API /api/config error: ' + error);
                res.status(500).json({ error: 'Failed' });
            }
        });

        this.app.post('/api/config', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                await this.setStateAsync('config', { val: JSON.stringify(req.body, null, 2), ack: true });
                this.io.emit('configChanged', req.body);
                res.json({ success: true });
            } catch (error) {
                this.log.error('API POST /api/config error: ' + error);
                res.status(500).json({ error: 'Failed' });
            }
        });

        this.app.get('/api/state/:id(*)', async (req, res) => {
            try {
                const state = await this.getForeignStateAsync(req.params.id);
                res.json({ id: req.params.id, val: state ? state.val : null, ack: state ? state.ack : false });
            } catch (error) {
                res.status(500).json({ error: 'Failed' });
            }
        });

        this.app.post('/api/state/:id(*)', express.json(), async (req, res) => {
            try {
                await this.setForeignStateAsync(req.params.id, req.body.val, false);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: 'Failed' });
            }
        });
    }

    startServer() {
        const port = this.config.port || 8083;
        const bind = this.config.bind || '0.0.0.0';
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

        this.io.on('connection', (socket) => {
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

        this.server.listen(port, bind, () => this.log.info(`Server listening on http://${bind}:${port}`));
        this.server.on('error', (error) => this.log.error(`Server error: ${error}`));
    }

    async onStateChange(id, state) {
        if (!state) return;
        if (id === `${this.namespace}.config`) {
            this.io.emit('configChanged', JSON.parse(state.val));
            return;
        }
        if (this.subscribedStates.has(id)) {
            this.io.to(id).emit('stateChange', id, state);
        }
    }

    async onUnload(callback) {
        try { if (this.server) this.server.close(); callback(); } 
        catch (error) { callback(); }
    }
}

if (module === require.main) { new FloorplanVisualizer(); }
module.exports = (options) => new FloorplanVisualizer(options);