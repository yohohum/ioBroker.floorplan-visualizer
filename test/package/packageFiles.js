'use strict';

const path = require('path');
const { tests } = require('@iobroker/testing');

// Run package tests using the built-in validation
const adapterDir = path.join(__dirname, '..', '..');

tests.packageFiles(adapterDir);