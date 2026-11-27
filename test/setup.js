'use strict';

// Test setup file
global.assert = require('chai').assert;
global.expect = require('chai').expect;
global.should = require('chai').should();

// Mock adapter-core for unit tests
const sinon = require('sinon');

class MockAdapter {
    constructor(options = {}) {
        this.options = options;
        this.namespace = options.name || 'test';
        this.config = options.config || {};
        this.log = {
            info: sinon.spy(),
            warn: sinon.spy(),
            error: sinon.spy(),
            debug: sinon.spy()
        };
        this.states = {
            getStateAsync: sinon.stub().resolves(null),
            setStateAsync: sinon.stub().resolves()
        };
        this.objects = {
            getObjectAsync: sinon.stub().resolves(null),
            setObjectNotExistsAsync: sinon.stub().resolves(),
            getForeignObjectAsync: sinon.stub().resolves(null),
            getForeignObjectsAsync: sinon.stub().resolves({})
        };
        this.on = sinon.spy();
    }
}

global.MockAdapter = MockAdapter;