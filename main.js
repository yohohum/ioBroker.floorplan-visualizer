'use strict';

const utils = require('@iobroker/adapter-core');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

class FloorplanVisualizer extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'floorplan-visualizer',
        });

        this.server = null;
        this.io = null;
        this.app = express();
        this.subscribedStates = new Set();

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info('Starting Floor Plan Visualizer...');

        await this.setObjectNotExistsAsync('config', {
            type: 'state',
            common: {
                name: 'Floor Plan Configuration',
                type: 'json',
                role: 'config',
                read: true,
                write: true
            },
            native: {}
        });

        const configState = await this.getStateAsync('config');
        if (!configState || !configState.val) {
            const defaultConfig = {
                floors: {
                    1: { image: '', devices: { lighting: [], sockets: [], sensors: [], security: [] } },
                    2: { image: '', devices: { lighting: [], sockets: [], sensors: [], security: [] } }
                }
            };
            await this.setStateAsync('config', { val: JSON.stringify(defaultConfig, null, 2), ack: true });
            this.log.info('Default configuration created in state floorplan-visualizer.0.config');
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

        this.app.get('/api/config', async (req, res) => {
            try {
                const state = await this.getStateAsync('config');
                res.json(state && state.val ? JSON.parse(state.val) : { floors: {} });
            } catch (error) {
                this.log.error('API /api/config error: ' + error);
                res.status(500).json({ error: 'Failed to get config' });
            }
        });

        this.app.post('/api/config', express.json({ limit: '10mb' }), async (req, res) => {
            try {
                await this.setStateAsync('config', { val: JSON.stringify(req.body, null, 2), ack: true });
                this.io.emit('configChanged', req.body);
                res.json({ success: true });
            } catch (error) {
                this.log.error('API POST /api/config error: ' + error);
                res.status(500).json({ error: 'Failed to save config' });
            }
        });

        this.app.get('/api/state/:id(*)', async (req, res) => {
            try {
                const stateId = req.params.id;
                const state = await this.getForeignStateAsync(stateId);
                res.json({ id: stateId, val: state ? state.val : null, ack: state ? state.ack : false });
            } catch (error) {
                this.log.error('API GET /api/state error: ' + error);
                res.status(500).json({ error: 'Failed to get state' });
            }
        });

        this.app.post('/api/state/:id(*)', express.json(), async (req, res) => {
            try {
                const stateId = req.params.id;
                const value = req.body.val;
                await this.setForeignStateAsync(stateId, value, false);
                res.json({ success: true });
            } catch (error) {
                this.log.error('API POST /api/state error: ' + error);
                res.status(500).json({ error: 'Failed to set state' });
            }
        });
    }

    startServer() {
        // ИЗМЕНЕНО: порт по умолчанию теперь 8083
        const port = this.config.port || 8083;
        const bind = this.config.bind || '0.0.0.0';

        this.server = http.createServer(this.app);
        this.io = socketIO(this.server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

        this.io.on('connection', (socket) => {
            this.log.debug('Client connected: ' + socket.id);

            socket.on('subscribe', (stateId) => {
                this.subscribedStates.add(stateId);
                socket.join(stateId);
            });

            socket.on('unsubscribe', (stateId) => {
                this.subscribedStates.delete(stateId);
                socket.leave(stateId);
            });

            socket.on('getState', async (stateId, callback) => {
                try {
                    const state = await this.getForeignStateAsync(stateId);
                    if (callback) callback(null, state);
                } catch (error) {
                    if (callback) callback(error, null);
                }
            });

            socket.on('setState', async (stateId, value, callback) => {
                try {
                    await this.setForeignStateAsync(stateId, value, false);
                    if (callback) callback(null);
                } catch (error) {
                    if (callback) callback(error);
                }
            });

            socket.on('disconnect', () => this.log.debug('Client disconnected: ' + socket.id));
        });

        this.server.listen(port, bind, () => {
            this.log.info(`Server listening on http://${bind}:${port}`);
        });

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
        try {
            if (this.server) this.server.close();
            callback();
        } catch (error) {
            callback();
        }
    }
}

if (module === require.main) {
    new FloorplanVisualizer();
}

module.exports = (options) => new FloorplanVisualizer(options);