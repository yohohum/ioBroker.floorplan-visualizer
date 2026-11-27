'use strict';

const chai = require('chai');
const path = require('path');
const fs = require('fs');

const assert = chai.assert;

// Simple test for configuration validation
describe('Configuration validation', function () {
    const ioPackage = require('../../io-package.json');

    it('should have correct version in io-package.json', function () {
        assert.equal(ioPackage.common.version, '15.3.0');
    });

    it('should have correct name in io-package.json', function () {
        assert.equal(ioPackage.common.name, 'floorplan-visualizer');
    });

    it('should have all 11 languages in titleLang', function () {
        const requiredLangs = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        requiredLangs.forEach(lang => {
            assert.property(ioPackage.common.titleLang, lang, `Missing titleLang for ${lang}`);
            assert.isString(ioPackage.common.titleLang[lang]);
            assert.isAbove(ioPackage.common.titleLang[lang].length, 0);
        });
    });

    it('should have all 11 languages in desc', function () {
        const requiredLangs = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        requiredLangs.forEach(lang => {
            assert.property(ioPackage.common.desc, lang, `Missing desc for ${lang}`);
            assert.isString(ioPackage.common.desc[lang]);
            assert.isAbove(ioPackage.common.desc[lang].length, 0);
        });
    });

    it('should have news entries with all languages', function () {
        const requiredLangs = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        Object.entries(ioPackage.common.news).forEach(([version, translations]) => {
            requiredLangs.forEach(lang => {
                assert.property(translations, lang, `Missing news.${version}.${lang}`);
                assert.isString(translations[lang]);
            });
        });
    });

    it('should have native config with correct defaults', function () {
        assert.equal(ioPackage.native.adminPort, 8083);
        assert.equal(ioPackage.native.presentationPort, 8084);
        assert.equal(ioPackage.native.bind, '0.0.0.0');
    });
});

describe('package.json validation', function () {
    const pkg = require('../../package.json');

    it('should have correct version', function () {
        assert.equal(pkg.version, '15.3.0');
    });

    it('should have correct name', function () {
        assert.equal(pkg.name, 'iobroker.floorplan-visualizer');
    });

    it('should have required dependencies', function () {
        assert.property(pkg.dependencies, '@iobroker/adapter-core');
        assert.property(pkg.dependencies, 'express');
        assert.property(pkg.dependencies, 'socket.io');
    });

    it('should have required devDependencies', function () {
        assert.property(pkg.devDependencies, '@iobroker/testing');
        assert.property(pkg.devDependencies, '@iobroker/adapter-dev');
        assert.property(pkg.devDependencies, 'typescript');
    });

    it('should have correct engines', function () {
        assert.property(pkg.engines, 'node');
        assert.include(pkg.engines.node, '18');
    });

    it('should have test scripts', function () {
        assert.property(pkg.scripts, 'test:package');
        assert.property(pkg.scripts, 'test:integration');
        assert.property(pkg.scripts, 'test:unit');
        assert.property(pkg.scripts, 'lint');
        assert.property(pkg.scripts, 'build');
    });
});

describe('Admin i18n files', function () {
    const i18nDir = path.join(__dirname, '..', '..', 'admin', 'i18n');
    const requiredLangs = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

    requiredLangs.forEach(lang => {
        it(`should have ${lang}.json`, function () {
            const filePath = path.join(i18nDir, `${lang}.json`);
            assert.isTrue(fs.existsSync(filePath), `Missing ${lang}.json`);
        });

        it(`should have valid JSON in ${lang}.json`, function () {
            const filePath = path.join(i18nDir, `${lang}.json`);
            assert.doesNotThrow(() => {
                JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }, `Invalid JSON in ${lang}.json`);
        });

        it(`should have all required keys in ${lang}.json`, function () {
            const filePath = path.join(i18nDir, `${lang}.json`);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const requiredKeys = [
                'Floor Plan Visualizer Settings',
                'General',
                'Editor port',
                'Port for the visual editor web interface',
                'Presentation port',
                'Port for the presentation mode (embedding in dashboards)',
                'IP address',
                'Network interface to bind (0.0.0.0 = all interfaces)'
            ];
            requiredKeys.forEach(key => {
                assert.property(content, key, `Missing key "${key}" in ${lang}.json`);
                assert.isString(content[key]);
                assert.isAbove(content[key].length, 0);
            });
        });
    });
});

describe('Admin jsonConfig', function () {
    const configPath = path.join(__dirname, '..', '..', 'admin', 'jsonConfig.json');

    it('should exist', function () {
        assert.isTrue(fs.existsSync(configPath));
    });

    it('should have valid JSON', function () {
        assert.doesNotThrow(() => {
            JSON.parse(fs.readFileSync(configPath, 'utf8'));
        });
    });

    it('should have correct structure', function () {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.equal(config.type, 'panel');
        assert.equal(config.title, 'Floor Plan Visualizer Settings');
        assert.isArray(config.items);
        assert.isAbove(config.items.length, 0);
    });
});

describe('Main module syntax', function () {
    const mainPath = path.join(__dirname, '..', '..', 'main.js');

    it('should exist', function () {
        assert.isTrue(fs.existsSync(mainPath));
    });

    it('should have valid JavaScript syntax', function () {
        const content = fs.readFileSync(mainPath, 'utf8');
        assert.doesNotThrow(() => {
            new Function(content);
        }, 'main.js has syntax errors');
    });

    it('should export adapter class', function () {
        const content = fs.readFileSync(mainPath, 'utf8');
        assert.include(content, 'class FloorplanVisualizer');
        assert.include(content, 'extends utils.Adapter');
        assert.include(content, 'module.exports');
    });
});