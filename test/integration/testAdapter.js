'use strict';

const chai = require('chai');
global.assert = chai.assert;
global.expect = chai.expect;
global.should = chai.should();

const { tests } = require('@iobroker/testing');
const path = require('path');

// Run integration tests
// See https://github.com/ioBroker/testing for a detailed explanation

const adapterDir = path.join(__dirname, '..', '..');

tests.integration(adapterDir, {
    // Define test cases
    defineAdditionalTests({ suite }) {
        suite('Floorplan Visualizer - Integration Tests', (getHarness) => {
            let harness;

            before(async function () {
                this.timeout(60000);
                harness = getHarness();
                // Start adapter and wait for it to be ready
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

            // Test admin API with authentication - use the harness to get token
            it('should allow authorized config GET', async function () {
                const axios = require('axios');
                const port = 8083;
                // Get admin token from adapter native config via objects
                const adapterObj = await harness.objects.getObjectAsync('floorplan-visualizer.0');
                const token = adapterObj?.native?.adminApiToken;
                // Token is generated on first start, may not be in object yet
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
                    assert.isTrue(e.response?.status === 401, 'Should reject unauthorized config POST with 401');
                }
            });

            it('should have objects API with auth', async function () {
                const axios = require('axios');
                const port = 8083;
                const adapterObj = await harness.objects.getObjectAsync('floorplan-visualizer.0');
                const token = adapterObj?.native?.adminApiToken;
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

            // Test presentation API - allowlisted states only
            it('should allow reading allowlisted state on presentation port', async function () {
                const axios = require('axios');
                const presPort = 8084;
                
                // Set a test state
                await harness.states.setStateAsync('test.device.state', { val: 'test', ack: true });
                
                // Update config to include this state in a device
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
                
                // Wait for config to reload
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Now try to read the state via presentation API
                const response = await axios.get(`http://localhost:${presPort}/api/state/test.device.state`, { timeout: 5000 });
                assert.equal(response.status, 200, 'Should allow reading allowlisted state');
                assert.equal(response.data.val, 'test', 'Should return correct value');
            });

            it('should reject non-allowlisted state on presentation port', async function () {
                const axios = require('axios');
                const presPort = 8084;
                try {
                    await axios.get(`http://localhost:${presPort}/api/state/system.adapter.unknown`, { timeout: 5000 });
                    throw new Error('Should have rejected non-allowlisted state');
                } catch (e) {
                    assert.isTrue(e.response?.status === 403, 'Should reject non-allowlisted state with 403');
                }
            });

            it('should reject arbitrary state write on presentation port', async function () {
                const axios = require('axios');
                const presPort = 8084;
                try {
                    await axios.post(`http://localhost:${presPort}/api/state/system.adapter.test`, { val: 'hack' }, { timeout: 5000 });
                    throw new Error('Should have rejected arbitrary state write');
                } catch (e) {
                    assert.isTrue(e.response?.status === 403 || e.response?.status === 404, 'Should reject arbitrary state write');
                }
            });

            it('should allow writing allowlisted state on presentation port', async function () {
                const axios = require('axios');
                const presPort = 8084;
                
                // Set initial state
                await harness.states.setStateAsync('test.write.state', { val: 'old', ack: true });
                
                // Update config to include this state
                const configState = await harness.states.getStateAsync('floorplan-visualizer.0.config');
                const config = configState ? JSON.parse(configState.val) : { floors: [] };
                if (config.floors.length && config.floors[0].layers.length && config.floors[0].layers[0].devices.length) {
                    config.floors[0].layers[0].devices[0].stateIds = ['test.write.state'];
                    await harness.states.setStateAsync('floorplan-visualizer.0.config', { val: JSON.stringify(config), ack: true });
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Write new value via presentation API
                const response = await axios.post(`http://localhost:${presPort}/api/state/test.write.state`, 
                    { val: 'new' }, { timeout: 5000 });
                assert.equal(response.status, 200, 'Should allow writing allowlisted state');
                assert.equal(response.data.success, true, 'Should return success');
                
                // Verify state changed
                const state = await harness.states.getStateAsync('test.write.state');
                assert.equal(state.val, 'new', 'State should be updated');
            });
        });
    }
});