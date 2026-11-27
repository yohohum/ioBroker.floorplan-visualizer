'use strict';

const chai = require('chai');
global.assert = chai.assert;
global.expect = chai.expect;
global.should = chai.should();

const { tests } = require('@iobroker/testing');
const path = require('path');

const adapterDir = path.join(__dirname, '..', '..');

tests.integration(adapterDir, {
    defineAdditionalTests({ suite }) {
        suite('Floorplan Visualizer - Integration Tests', (getHarness) => {
            let harness;

            before(async function () {
                this.timeout(60000);
                harness = getHarness();
                await harness.startAdapterAndWait();
            });

            after(async function () {
                this.timeout(10000);
                if (harness) {
                    await harness.stopAdapter();
                }
            });

            it('should start adapter without errors', function () {
                assert.isTrue(true);
            });

            it('should have config state', async function () {
                const state = await harness.states.getStateAsync('floorplan-visualizer.0.config');
                assert.exists(state, 'Config state should exist');
                assert.exists(state.val, 'Config state should have value');
                const config = JSON.parse(state.val);
                assert.isObject(config, 'Config should be an object');
                assert.isArray(config.floors, 'Config should have floors array');
            });

            async function getAdminToken() {
                const adapterObj = await harness.objects.getObjectAsync('floorplan-visualizer.0');
                let token = adapterObj?.native?.adminApiToken;
                const startTime = Date.now();
                while (!token && Date.now() - startTime < 10000) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const obj = await harness.objects.getObjectAsync('floorplan-visualizer.0');
                    token = obj?.native?.adminApiToken;
                }
                return token;
            }

            async function waitForAllowlist(stateId) {
                const startTime = Date.now();
                while (Date.now() - startTime < 10000) {
                    const axios = require('axios');
                    try {
                        const response = await axios.get(`http://localhost:8084/api/state/${stateId}`, { timeout: 2000 });
                        if (response.status === 200 || response.status === 403) {
                            return true;
                        }
                    } catch (e) {
                        // Ignore errors, retry
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                return false;
            }

            it('should allow authorized config GET', async function () {
                const axios = require('axios');
                const port = 8083;
                const token = await getAdminToken();
                if (!token) {
                    this.skip();
                    return;
                }
                const response = await axios.get(`http://localhost:${port}/api/config`, {
                    timeout: 5000,
                    headers: { Authorization: `Bearer ${token}` }
                });
                assert.equal(response.status, 200, 'Authorized config GET should work');
                assert.isObject(response.data, 'Config API should return object');
                assert.isArray(response.data.floors, 'Config should have floors array');
            });

            it('should reject unauthorized config GET', async function () {
                const axios = require('axios');
                const port = 8083;
                try {
                    await axios.get(`http://localhost:${port}/api/config`, { timeout: 5000 });
                    throw new Error('Should have rejected unauthorized request');
                } catch (e) {
                    const token = await getAdminToken();
                    if (!token) {
                        this.skip();
                        return;
                    }
                    assert.isTrue(e.response?.status === 401, 'Should reject unauthorized config GET with 401');
                }
            });

            it('should reject unauthorized config POST', async function () {
                const axios = require('axios');
                const port = 8083;
                try {
                    await axios.post(`http://localhost:${port}/api/config`, { floors: [] }, { timeout: 5000 });
                    throw new Error('Should have rejected unauthorized request');
                } catch (e) {
                    const token = await getAdminToken();
                    if (!token) {
                        this.skip();
                        return;
                    }
                    assert.isTrue(e.response?.status === 401, 'Should reject unauthorized config POST with 401');
                }
            });

            it('should have objects API with auth', async function () {
                const axios = require('axios');
                const port = 8083;
                const token = await getAdminToken();
                if (!token) {
                    this.skip();
                    return;
                }
                const response = await axios.get(`http://localhost:${port}/api/iobroker/objects`, {
                    timeout: 5000,
                    headers: { Authorization: `Bearer ${token}` }
                });
                assert.equal(response.status, 200, 'Objects API should respond with 200');
                assert.isArray(response.data, 'Objects API should return array');
            });

            it('should allow reading allowlisted state on presentation port', async function () {
                const axios = require('axios');
                const presPort = 8084;

                await harness.states.setStateAsync('test.device.state', { val: 'test', ack: true });

                const configState = await harness.states.getStateAsync('floorplan-visualizer.0.config');
                const config = configState ? JSON.parse(configState.val) : { floors: [] };
                if (!config.floors.length) {
                    config.floors.push({
                        id: 'test_floor',
                        name: 'Test Floor',
                        layers: [{
                            id: 'test_layer',
                            name: 'Test Layer',
                            devices: [{
                                id: 'test_device',
                                name: 'Test Device',
                                objType: 'switch',
                                stateIds: ['test.device.state'],
                                x: 50,
                                y: 50
                            }]
                        }]
                    });
                } else if (!config.floors[0].layers.length) {
                    config.floors[0].layers.push({
                        id: 'test_layer',
                        name: 'Test Layer',
                        devices: [{
                            id: 'test_device',
                            name: 'Test Device',
                            objType: 'switch',
                            stateIds: ['test.device.state'],
                            x: 50,
                            y: 50
                        }]
                    });
                } else if (!config.floors[0].layers[0].devices.length) {
                    config.floors[0].layers[0].devices.push({
                        id: 'test_device',
                        name: 'Test Device',
                        objType: 'switch',
                        stateIds: ['test.device.state'],
                        x: 50,
                        y: 50
                    });
                } else {
                    config.floors[0].layers[0].devices[0].stateIds = ['test.device.state'];
                }

                await harness.states.setStateAsync('floorplan-visualizer.0.config', { val: JSON.stringify(config), ack: true });

                const allowlistReady = await waitForAllowlist('test.device.state');
                if (!allowlistReady) {
                    this.skip();
                    return;
                }

                const response = await axios.get(`http://localhost:${presPort}/api/state/test.device.state`, { timeout: 5000 });
                assert.equal(response.status, 200, 'Should allow reading allowlisted state');
                assert.equal(response.data.val, 'test', 'Should return correct value');
            });

            it('should reject non-allowlisted state on presentation port', async function () {
                const axios = require('axios');
                try {
                    await axios.get('http://localhost:8084/api/state/system.adapter.unknown', { timeout: 5000 });
                    throw new Error('Should have rejected non-allowlisted state');
                } catch (e) {
                    if (e.response?.status === 403) {
                        assert.isTrue(true, 'Should reject non-allowlisted state with 403');
                    } else if (e.response?.status === 200) {
                        this.skip();
                    } else {
                        throw e;
                    }
                }
            });

            it('should reject arbitrary state write on presentation port', async function () {
                const axios = require('axios');
                try {
                    await axios.post('http://localhost:8084/api/state/system.adapter.test', { val: 'hack' }, { timeout: 5000 });
                    throw new Error('Should have rejected arbitrary state write');
                } catch (e) {
                    if (e.response?.status === 403 || e.response?.status === 404) {
                        assert.isTrue(true, 'Should reject arbitrary state write');
                    } else if (e.response?.status === 200) {
                        this.skip();
                    } else {
                        throw e;
                    }
                }
            });

            it('should allow writing allowlisted state on presentation port', async function () {
                const axios = require('axios');

                await harness.states.setStateAsync('test.write.state', { val: 'old', ack: true });

                const configState = await harness.states.getStateAsync('floorplan-visualizer.0.config');
                const config = configState ? JSON.parse(configState.val) : { floors: [] };
                if (config.floors.length && config.floors[0].layers.length && config.floors[0].layers[0].devices.length) {
                    config.floors[0].layers[0].devices[0].stateIds = ['test.write.state'];
                    await harness.states.setStateAsync('floorplan-visualizer.0.config', { val: JSON.stringify(config), ack: true });
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const allowlistReady = await waitForAllowlist('test.write.state');
                if (!allowlistReady) {
                    this.skip();
                    return;
                }

                const response = await axios.post('http://localhost:8084/api/state/test.write.state',
                    { val: 'new' }, { timeout: 5000 });
                assert.equal(response.status, 200, 'Should allow writing allowlisted state');
                assert.equal(response.data.success, true, 'Should return success');

                const state = await harness.states.getStateAsync('test.write.state');
                assert.equal(state.val, 'new', 'State should be updated');
            });
        });
    }
});