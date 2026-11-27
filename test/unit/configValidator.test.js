'use strict';

const chai = require('chai');
const { validateConfig, sanitizeConfig, getDefaultConfig, ValidationResult } = require('../../lib/configValidator');

const assert = chai.assert;

describe('ConfigValidator', function () {
    describe('getDefaultConfig', function () {
        it('should return a valid default config', function () {
            const config = getDefaultConfig();
            assert.isObject(config);
            assert.isArray(config.floors);
            assert.isArray(config.templates);
            assert.equal(config.screenBg, '#f7f9fc');
            assert.equal(config.planBg, '#2a2f36');
            assert.equal(config.backdropRadius, 16);
            assert.equal(config.scaleMode, 'height');
            assert.isNull(config.floorBar);
            assert.isNull(config.layerBar);
        });
    });

    describe('validateConfig - valid configs', function () {
        it('should accept empty valid config', function () {
            const config = getDefaultConfig();
            const result = validateConfig(config);
            assert.isTrue(result.isValid());
        });

        it('should accept config with valid floor', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Ground Floor',
                slug: 'ground',
                image: '/uploads/floor1.png',
                icon: { kind: 'emoji', value: '🏠' },
                layers: [{
                    id: 'layer_1',
                    name: 'Lights',
                    icon: { kind: 'mfd', value: 'light' },
                    devices: [{
                        id: 'dev_1',
                        name: 'Living Room Light',
                        objType: 'switch',
                        stateIds: ['switch.0.living'],
                        x: 50,
                        y: 50,
                        locked: false,
                        icon: { kind: 'emoji', value: '💡' },
                        valueFont: { family: 'Arial', weight: '400', size: '12px', color: '#fff', bgColor: 'transparent', position: 'overlay' },
                        nameFont: { family: 'Arial', weight: '400', size: '12px', color: '#fff', bgColor: 'transparent', position: 'bottom' },
                        showValue: true,
                        showName: true,
                        prefixes: [],
                        postfixes: []
                    }]
                }],
                guides: []
            });
            const result = validateConfig(config);
            assert.isTrue(result.isValid(), `Validation errors: ${JSON.stringify(result.errors)}`);
        });

        it('should accept config with value device type', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Ground Floor',
                layers: [{
                    id: 'layer_1',
                    name: 'Sensors',
                    devices: [{
                        id: 'dev_1',
                        name: 'Temperature',
                        objType: 'value',
                        stateIds: ['sensor.0.temp'],
                        x: 50,
                        y: 50,
                        icon: { kind: 'emoji', value: '🌡️' },
                        valueFont: { family: 'Arial', weight: '400', size: '12px', color: '#fff', bgColor: 'transparent', position: 'overlay' },
                        nameFont: { family: 'Arial', weight: '400', size: '12px', color: '#fff', bgColor: 'transparent', position: 'bottom' },
                        showValue: true,
                        showName: true,
                        prefixes: [],
                        postfixes: ['°C'],
                        warnBelow: 10,
                        warnAbove: 30
                    }]
                }],
                guides: []
            });
            const result = validateConfig(config);
            assert.isTrue(result.isValid(), `Validation errors: ${JSON.stringify(result.errors)}`);
        });

        it('should accept config with guide', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Ground Floor',
                layers: [],
                guides: [{
                    id: 'guide_1',
                    type: 'h',
                    position: 50
                }]
            });
            const result = validateConfig(config);
            assert.isTrue(result.isValid(), `Validation errors: ${JSON.stringify(result.errors)}`);
        });

        it('should accept config with template', function () {
            const config = getDefaultConfig();
            config.templates.push({
                name: 'My Template',
                data: {
                    objType: 'switch',
                    icon: { kind: 'emoji', value: '💡' }
                }
            });
            const result = validateConfig(config);
            assert.isTrue(result.isValid(), `Validation errors: ${JSON.stringify(result.errors)}`);
        });

        it('should accept config with bar config', function () {
            const config = getDefaultConfig();
            config.floorBar = {
                height: 40,
                width: 120,
                gap: 8,
                radius: 100,
                orient: 'h',
                position: 'top',
                align: 'center',
                textAlign: 'left',
                icon: { kind: 'emoji', value: '🏠' },
                iconPos: 'left',
                active: { bg: '#0cbaba', border: '#0cbaba', font: { family: 'Roboto', weight: '500', size: '14px', color: '#ffffff' } },
                inactive: { bg: '#2a2f36', border: '#3a4048', font: { family: 'Roboto', weight: '500', size: '14px', color: '#e8eaed' } }
            };
            const result = validateConfig(config);
            assert.isTrue(result.isValid(), `Validation errors: ${JSON.stringify(result.errors)}`);
        });
    });

    describe('validateConfig - invalid configs', function () {
        it('should reject non-object config', function () {
            const result = validateConfig(null);
            assert.isFalse(result.isValid());
            assert.isAbove(result.errors.length, 0);
        });

        it('should reject invalid scaleMode', function () {
            const config = getDefaultConfig();
            config.scaleMode = 'invalid';
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path === 'scaleMode'));
        });

        it('should reject invalid backdropRadius', function () {
            const config = getDefaultConfig();
            config.backdropRadius = -1;
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path === 'backdropRadius'));
        });

        it('should reject invalid floor id', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: '',
                name: 'Test',
                layers: [],
                guides: []
            });
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path.includes('.id')));
        });

        it('should reject invalid device objType', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Test',
                layers: [{
                    id: 'layer_1',
                    name: 'Test',
                    devices: [{
                        id: 'dev_1',
                        name: 'Test',
                        objType: 'invalid_type',
                        stateIds: ['test'],
                        x: 50,
                        y: 50
                    }]
                }],
                guides: []
            });
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path.includes('.objType')));
        });

        it('should reject empty stateIds', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Test',
                layers: [{
                    id: 'layer_1',
                    name: 'Test',
                    devices: [{
                        id: 'dev_1',
                        name: 'Test',
                        objType: 'switch',
                        stateIds: [],
                        x: 50,
                        y: 50
                    }]
                }],
                guides: []
            });
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path.includes('.stateIds')));
        });

        it('should reject invalid guide type', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Test',
                layers: [],
                guides: [{
                    id: 'guide_1',
                    type: 'invalid',
                    position: 50
                }]
            });
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path.includes('.type')));
        });

        it('should reject invalid guide position', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Test',
                layers: [],
                guides: [{
                    id: 'guide_1',
                    type: 'h',
                    position: 150
                }]
            });
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path.includes('.position')));
        });

        it('should reject invalid bar orient', function () {
            const config = getDefaultConfig();
            config.floorBar = {
                height: 40,
                width: 120,
                gap: 8,
                radius: 100,
                orient: 'invalid',
                position: 'top',
                align: 'center',
                textAlign: 'left',
                iconPos: 'left',
                active: { bg: '#0cbaba', border: '#0cbaba', font: { family: 'Roboto', weight: '500', size: '14px', color: '#ffffff' } },
                inactive: { bg: '#2a2f36', border: '#3a4048', font: { family: 'Roboto', weight: '500', size: '14px', color: '#e8eaed' } }
            };
            const result = validateConfig(config);
            assert.isFalse(result.isValid());
            assert.isTrue(result.errors.some(e => e.path.includes('.orient')));
        });
    });

    describe('sanitizeConfig', function () {
        it('should return default config for null input', function () {
            const result = sanitizeConfig(null);
            assert.isObject(result);
            assert.isArray(result.floors);
            assert.equal(result.scaleMode, 'height');
        });

        it('should sanitize invalid scaleMode', function () {
            const config = getDefaultConfig();
            config.scaleMode = 'invalid';
            const result = sanitizeConfig(config);
            assert.equal(result.scaleMode, 'height');
        });

        it('should sanitize invalid backdropRadius', function () {
            const config = getDefaultConfig();
            config.backdropRadius = -1;
            const result = sanitizeConfig(config);
            assert.equal(result.backdropRadius, 16);
        });

        it('should sanitize floor with missing fields', function () {
            const config = getDefaultConfig();
            config.floors.push({
                name: 'Test Floor'
            });
            const result = sanitizeConfig(config);
            assert.isArray(result.floors);
            assert.isAbove(result.floors.length, 0);
            assert.isString(result.floors[0].id);
            assert.isString(result.floors[0].name);
        });

        it('should sanitize device with missing fields', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Test',
                layers: [{
                    id: 'layer_1',
                    name: 'Test',
                    devices: [{
                        name: 'Test Device'
                    }]
                }],
                guides: []
            });
            const result = sanitizeConfig(config);
            const device = result.floors[0].layers[0].devices[0];
            assert.isString(device.id);
            assert.equal(device.objType, 'switch');
            assert.isArray(device.stateIds);
            assert.equal(device.x, 50);
            assert.equal(device.y, 50);
        });

        it('should sanitize guide with invalid position', function () {
            const config = getDefaultConfig();
            config.floors.push({
                id: 'floor_1',
                name: 'Test',
                layers: [],
                guides: [{
                    id: 'guide_1',
                    type: 'h',
                    position: 150
                }]
            });
            const result = sanitizeConfig(config);
            assert.equal(result.floors[0].guides[0].position, 50);
        });
    });

    describe('ValidationResult', function () {
        it('should track errors and warnings', function () {
            const result = new ValidationResult();
            result.addError('test.path', 'Test error');
            result.addWarning('test.path', 'Test warning');
            assert.isFalse(result.isValid());
            assert.equal(result.errors.length, 1);
            assert.equal(result.warnings.length, 1);
        });

        it('should throw on throwIfInvalid when errors exist', function () {
            const result = new ValidationResult();
            result.addError('test', 'error');
            assert.throws(() => result.throwIfInvalid(), /Configuration validation failed/);
        });

        it('should not throw on throwIfInvalid when valid', function () {
            const result = new ValidationResult();
            assert.doesNotThrow(() => result.throwIfInvalid());
        });
    });
});