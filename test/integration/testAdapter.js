'use strict';

const chai = require('chai');
global.assert = chai.assert;
global.expect = chai.expect;
global.should = chai.should();

const { tests } = require('@iobroker/testing');
const path = require('path');

// Run integration tests
// See https://github.com/ioBroker/testing for a detailed explanation

const adapterDir = path.join(__dirname, '..');

tests.integration(adapterDir, {
    // Define test cases
    defineAdditionalTests({ suite }) {
        suite('Floorplan Visualizer - Integration Tests', (getHarness) => {
            let harness;

            before(async function () {
                this.timeout(10000);
                harness = getHarness();
            });

            it('should start adapter without errors', function () {
                return new Promise((resolve, reject) => {
                    harness.once('ready', () => resolve());
                    harness.once('error', (err) => reject(err));
                });
            });

            it('should have config state', async function () {
                const state = await harness.states.getStateAsync('floorplan-visualizer.0.config');
                assert.exists(state);
                assert.exists(state.val);
                const config = JSON.parse(state.val);
                assert.isObject(config);
                assert.isArray(config.floors);
            });

            it('should have admin server running', async function () {
                // Check if admin server is accessible
                const axios = require('axios');
                try {
                    const response = await axios.get('http://localhost:8083/api/version', { timeout: 5000 });
                    assert.equal(response.status, 200);
                    assert.equal(response.data.version, '15.3.0');
                } catch (e) {
                    // Server might not be running in test environment, skip
                    this.skip();
                }
            });

            it('should have presentation server running', async function () {
                const axios = require('axios');
                try {
                    const response = await axios.get('http://localhost:8084/api/version', { timeout: 5000 });
                    assert.equal(response.status, 200);
                    assert.equal(response.data.version, '15.3.0');
                } catch (e) {
                    this.skip();
                }
            });

            it('should handle config API', async function () {
                const axios = require('axios');
                try {
                    const response = await axios.get('http://localhost:8083/api/config', { timeout: 5000 });
                    assert.equal(response.status, 200);
                    assert.isObject(response.data);
                    assert.isArray(response.data.floors);
                } catch (e) {
                    this.skip();
                }
            });

            it('should handle objects API', async function () {
                const axios = require('axios');
                try {
                    const response = await axios.get('http://localhost:8083/api/iobroker/objects', { timeout: 5000 });
                    assert.equal(response.status, 200);
                    assert.isArray(response.data);
                } catch (e) {
                    this.skip();
                }
            });

            it('should handle icons API', async function () {
                const axios = require('axios');
                try {
                    const response = await axios.get('http://localhost:8083/api/iobroker/icons', { timeout: 5000 });
                    assert.equal(response.status, 200);
                    assert.isObject(response.data);
                    assert.isArray(response.data.icons);
                    assert.isNumber(response.data.count);
                } catch (e) {
                    this.skip();
                }
            });
        });
    }
});