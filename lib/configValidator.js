'use strict';

/**
 * Config Validator for Floorplan Visualizer
 * Validates configuration structure and data integrity
 */

const VALID_DEVICE_TYPES = ['switch', 'indicator', 'value'];
const VALID_SCALE_MODES = ['height', 'width', 'none'];
const VALID_BAR_POSITIONS = ['top', 'bottom', 'left', 'right'];
const VALID_BAR_ORIENTS = ['h', 'v'];
const VALID_BAR_ALIGNS = ['center', 'left', 'right'];
const VALID_TEXT_ALIGNS = ['left', 'center', 'right'];
const VALID_ICON_POSITIONS = ['left', 'right'];
const VALID_FONT_POSITIONS = ['bottom', 'top', 'right', 'left', 'overlay'];
const VALID_GUIDE_TYPES = ['h', 'v'];
const MAX_CONFIG_SIZE = 1024 * 1024; // 1MB
const MAX_FLOORS = 100;
const MAX_LAYERS_PER_FLOOR = 50;
const MAX_DEVICES_PER_LAYER = 500;
const MAX_GUIDES_PER_FLOOR = 100;
const MAX_TEMPLATES = 100;

/**
 * Validation result class
 */
class ValidationResult {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    addError(path, message) {
        this.errors.push({ path, message });
    }

    addWarning(path, message) {
        this.warnings.push({ path, message });
    }

    isValid() {
        return this.errors.length === 0;
    }

    throwIfInvalid() {
        if (!this.isValid()) {
            const error = new Error('Configuration validation failed');
            error.validationErrors = this.errors;
            error.validationWarnings = this.warnings;
            throw error;
        }
    }
}

/**
 * Validates a string field
 */
function validateString(result, path, value, required = false, maxLength = 256) {
    if (value === undefined || value === null || value === '') {
        if (required) {
            result.addError(path, 'Field is required');
        }
        return;
    }
    if (typeof value !== 'string') {
        result.addError(path, 'Must be a string');
        return;
    }
    if (value.length > maxLength) {
        result.addError(path, `String too long (max ${maxLength} characters)`);
    }
}

/**
 * Validates a number field
 */
function validateNumber(result, path, value, required = false, min = null, max = null, integer = false) {
    if (value === undefined || value === null || value === '') {
        if (required) {
            result.addError(path, 'Field is required');
        }
        return;
    }
    const num = Number(value);
    if (isNaN(num)) {
        result.addError(path, 'Must be a number');
        return;
    }
    if (integer && !Number.isInteger(num)) {
        result.addError(path, 'Must be an integer');
        return;
    }
    if (min !== null && num < min) {
        result.addError(path, `Must be >= ${min}`);
    }
    if (max !== null && num > max) {
        result.addError(path, `Must be <= ${max}`);
    }
}

/**
 * Validates an array field
 */
function validateArray(result, path, value, required = false, maxLength = null, itemValidator = null) {
    if (value === undefined || value === null) {
        if (required) {
            result.addError(path, 'Field is required');
        }
        return;
    }
    if (!Array.isArray(value)) {
        result.addError(path, 'Must be an array');
        return;
    }
    if (maxLength !== null && value.length > maxLength) {
        result.addError(path, `Array too long (max ${maxLength} items)`);
    }
    if (itemValidator) {
        value.forEach((item, index) => {
            itemValidator(result, `${path}[${index}]`, item);
        });
    }
}

/**
 * Validates an object field
 */
function validateObject(result, path, value, required = false, validator = null) {
    if (value === undefined || value === null) {
        if (required) {
            result.addError(path, 'Field is required');
        }
        return;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        result.addError(path, 'Must be an object');
        return;
    }
    if (validator) {
        validator(result, path, value);
    }
}

/**
 * Validates icon object
 */
function validateIcon(result, path, icon) {
    if (!icon) return;
    validateObject(result, path, icon, false, (r, p, obj) => {
        validateString(r, `${p}.kind`, obj.kind, true);
        if (!['emoji', 'mfd', 'url', 'file'].includes(obj.kind)) {
            r.addError(`${p}.kind`, 'Invalid icon kind');
        }
        validateString(r, `${p}.value`, obj.value, true);
    });
}

/**
 * Validates font object
 */
function validateFont(result, path, font) {
    if (!font) return;
    validateObject(result, path, font, false, (r, p, obj) => {
        validateString(r, `${p}.family`, obj.family);
        validateString(r, `${p}.weight`, obj.weight);
        validateString(r, `${p}.size`, obj.size);
        validateString(r, `${p}.color`, obj.color);
        validateString(r, `${p}.bgColor`, obj.bgColor);
        validateString(r, `${p}.position`, obj.position);
        if (obj.position && !VALID_FONT_POSITIONS.includes(obj.position)) {
            r.addError(`${p}.position`, 'Invalid font position');
        }
    });
}

/**
 * Validates bar config
 */
function validateBarConfig(result, path, bar) {
    if (!bar) return;
    validateObject(result, path, bar, false, (r, p, obj) => {
        validateNumber(r, `${p}.height`, obj.height, false, 1, 500, true);
        validateNumber(r, `${p}.width`, obj.width, false, 1, 2000, true);
        validateNumber(r, `${p}.gap`, obj.gap, false, 0, 100, true);
        validateNumber(r, `${p}.radius`, obj.radius, false, 0, 200, true);
        validateString(r, `${p}.orient`, obj.orient);
        if (obj.orient && !VALID_BAR_ORIENTS.includes(obj.orient)) {
            r.addError(`${p}.orient`, 'Invalid orientation');
        }
        validateString(r, `${p}.position`, obj.position);
        if (obj.position && !VALID_BAR_POSITIONS.includes(obj.position)) {
            r.addError(`${p}.position`, 'Invalid bar position');
        }
        validateString(r, `${p}.align`, obj.align);
        if (obj.align && !VALID_BAR_ALIGNS.includes(obj.align)) {
            r.addError(`${p}.align`, 'Invalid bar align');
        }
        validateString(r, `${p}.textAlign`, obj.textAlign);
        if (obj.textAlign && !VALID_TEXT_ALIGNS.includes(obj.textAlign)) {
            r.addError(`${p}.textAlign`, 'Invalid text align');
        }
        validateString(r, `${p}.iconPos`, obj.iconPos);
        if (obj.iconPos && !VALID_ICON_POSITIONS.includes(obj.iconPos)) {
            r.addError(`${p}.iconPos`, 'Invalid icon position');
        }
        validateObject(r, `${p}.icon`, obj.icon, false, (r2, p2, o2) => validateIcon(r2, p2, o2));
        validateObject(r, `${p}.active`, obj.active, false, (r2, p2, o2) => validateBarStyle(r2, p2, o2));
        validateObject(r, `${p}.inactive`, obj.inactive, false, (r2, p2, o2) => validateBarStyle(r2, p2, o2));
    });
}

function validateBarStyle(result, path, style) {
    validateString(result, `${path}.bg`, style.bg);
    validateString(result, `${path}.border`, style.border);
    validateObject(result, `${path}.font`, style.font, false, (r, p, o) => {
        validateString(r, `${p}.family`, o.family);
        validateString(r, `${p}.weight`, o.weight);
        validateString(r, `${p}.size`, o.size);
        validateString(r, `${p}.color`, o.color);
    });
}

/**
 * Validates device config
 */
function validateDevice(result, path, device) {
    validateObject(result, path, device, true, (r, p, obj) => {
        validateString(r, `${p}.id`, obj.id, true);
        validateString(r, `${p}.name`, obj.name, false, 128);
        validateString(r, `${p}.objType`, obj.objType, true);
        if (obj.objType && !VALID_DEVICE_TYPES.includes(obj.objType)) {
            r.addError(`${p}.objType`, 'Invalid device type');
        }
        validateArray(r, `${p}.stateIds`, obj.stateIds, true, 10, (r2, p2, item) => {
            validateString(r2, p2, item, true, 256);
        });
        // Ensure at least one stateId
        if (!obj.stateIds || obj.stateIds.length === 0) {
            r.addError(`${p}.stateIds`, 'At least one stateId is required');
        }
        validateNumber(r, `${p}.x`, obj.x, true, 0, 100);
        validateNumber(r, `${p}.y`, obj.y, true, 0, 100);
        // locked and lockedUntil are optional
        if (obj.locked !== undefined && typeof obj.locked !== 'boolean') {
            r.addError(`${p}.locked`, 'Must be boolean');
        }
        if (obj.lockedUntil !== undefined && (typeof obj.lockedUntil !== 'number' || obj.lockedUntil < 0)) {
            r.addError(`${p}.lockedUntil`, 'Must be a positive number');
        }
        validateObject(r, `${p}.icon`, obj.icon, false, (r2, p2, o2) => validateIcon(r2, p2, o2));
        validateObject(r, `${p}.valueFont`, obj.valueFont, false, (r2, p2, o2) => validateFont(r2, p2, o2));
        validateObject(r, `${p}.nameFont`, obj.nameFont, false, (r2, p2, o2) => validateFont(r2, p2, o2));
        if (obj.showValue !== undefined && typeof obj.showValue !== 'boolean') {
            r.addError(`${p}.showValue`, 'Must be boolean');
        }
        if (obj.showName !== undefined && typeof obj.showName !== 'boolean') {
            r.addError(`${p}.showName`, 'Must be boolean');
        }
        validateArray(r, `${p}.prefixes`, obj.prefixes, false, 10, (r2, p2, item) => validateString(r2, p2, item));
        validateArray(r, `${p}.postfixes`, obj.postfixes, false, 10, (r2, p2, item) => validateString(r2, p2, item));
        validateNumber(r, `${p}.warnBelow`, obj.warnBelow, false, -10000, 10000);
        validateNumber(r, `${p}.warnAbove`, obj.warnAbove, false, -10000, 10000);
    });
}

/**
 * Validates layer config
 */
function validateLayer(result, path, layer) {
    validateObject(result, path, layer, true, (r, p, obj) => {
        validateString(r, `${p}.id`, obj.id, true);
        validateString(r, `${p}.name`, obj.name, true, 64);
        validateObject(r, `${p}.icon`, obj.icon, false, (r2, p2, o2) => validateIcon(r2, p2, o2));
        validateArray(r, `${p}.devices`, obj.devices, false, MAX_DEVICES_PER_LAYER, (r2, p2, item) => validateDevice(r2, p2, item));
    });
}

/**
 * Validates guide config
 */
function validateGuide(result, path, guide) {
    validateObject(result, path, guide, true, (r, p, obj) => {
        validateString(r, `${p}.id`, obj.id, true);
        validateString(r, `${p}.type`, obj.type, true);
        if (obj.type && !VALID_GUIDE_TYPES.includes(obj.type)) {
            r.addError(`${p}.type`, 'Invalid guide type');
        }
        validateNumber(r, `${p}.position`, obj.position, true, 0, 100);
    });
}

/**
 * Validates template config
 */
function validateTemplate(result, path, template) {
    validateObject(result, path, template, true, (r, p, obj) => {
        validateString(r, `${p}.name`, obj.name, true, 64);
        validateObject(r, `${p}.data`, obj.data, true);
    });
}

/**
 * Main config validator
 */
function validateConfig(config) {
    const result = new ValidationResult();

    if (!config || typeof config !== 'object') {
        result.addError('root', 'Configuration must be an object');
        return result;
    }

    // Top-level fields
    validateString(result, 'screenBg', config.screenBg, false, 32);
    validateString(result, 'planBg', config.planBg, false, 32);
    validateNumber(result, 'backdropRadius', config.backdropRadius, false, 0, 200, true);
    validateString(result, 'scaleMode', config.scaleMode, false);
    if (config.scaleMode && !VALID_SCALE_MODES.includes(config.scaleMode)) {
        result.addError('scaleMode', 'Invalid scale mode');
    }

    validateObject(result, 'floorBar', config.floorBar, false, (r, p, o) => validateBarConfig(r, p, o));
    validateObject(result, 'layerBar', config.layerBar, false, (r, p, o) => validateBarConfig(r, p, o));

    // Floors array
    validateArray(result, 'floors', config.floors, false, MAX_FLOORS, (r, p, floor) => {
        validateObject(r, p, floor, true, (r2, p2, obj) => {
            validateString(r2, `${p2}.id`, obj.id, true);
            validateString(r2, `${p2}.name`, obj.name, true, 64);
            validateString(r2, `${p2}.slug`, obj.slug, false, 64);
            validateString(r2, `${p2}.image`, obj.image, false, 512);
            validateObject(r2, `${p2}.icon`, obj.icon, false, (r3, p3, o3) => validateIcon(r3, p3, o3));
            validateArray(r2, `${p2}.layers`, obj.layers, false, MAX_LAYERS_PER_FLOOR, (r3, p3, item) => validateLayer(r3, p3, item));
            validateArray(r2, `${p2}.guides`, obj.guides, false, MAX_GUIDES_PER_FLOOR, (r3, p3, item) => validateGuide(r3, p3, item));
        });
    });

    // Templates array
    validateArray(result, 'templates', config.templates, false, MAX_TEMPLATES, (r, p, item) => validateTemplate(r, p, item));

    return result;
}

/**
 * Sanitizes config by removing unknown fields and ensuring required defaults
 */
function sanitizeConfig(config) {
    if (!config || typeof config !== 'object') {
        return getDefaultConfig();
    }

    const sanitized = {
        floors: Array.isArray(config.floors) ? config.floors.map(sanitizeFloor) : [],
        templates: Array.isArray(config.templates) ? config.templates.map(sanitizeTemplate) : [],
        screenBg: typeof config.screenBg === 'string' ? config.screenBg : '#f7f9fc',
        planBg: typeof config.planBg === 'string' ? config.planBg : '#2a2f36',
        backdropRadius: Number.isInteger(config.backdropRadius) && config.backdropRadius >= 0 && config.backdropRadius <= 200 ? config.backdropRadius : 16,
        scaleMode: VALID_SCALE_MODES.includes(config.scaleMode) ? config.scaleMode : 'height',
        floorBar: config.floorBar && typeof config.floorBar === 'object' ? sanitizeBarConfig(config.floorBar) : null,
        layerBar: config.layerBar && typeof config.layerBar === 'object' ? sanitizeBarConfig(config.layerBar) : null
    };

    return sanitized;
}

function sanitizeFloor(floor) {
    if (!floor || typeof floor !== 'object') return null;
    return {
        id: typeof floor.id === 'string' ? floor.id : `floor_${Date.now()}`,
        name: typeof floor.name === 'string' ? floor.name : 'Unnamed Floor',
        slug: typeof floor.slug === 'string' ? floor.slug : '',
        image: typeof floor.image === 'string' ? floor.image : '',
        icon: floor.icon && typeof floor.icon === 'object' ? sanitizeIcon(floor.icon) : null,
        layers: Array.isArray(floor.layers) ? floor.layers.map(sanitizeLayer).filter(Boolean) : [],
        guides: Array.isArray(floor.guides) ? floor.guides.map(sanitizeGuide).filter(Boolean) : []
    };
}

function sanitizeLayer(layer) {
    if (!layer || typeof layer !== 'object') return null;
    return {
        id: typeof layer.id === 'string' ? layer.id : `layer_${Date.now()}`,
        name: typeof layer.name === 'string' ? layer.name : 'Unnamed Layer',
        icon: layer.icon && typeof layer.icon === 'object' ? sanitizeIcon(layer.icon) : null,
        devices: Array.isArray(layer.devices) ? layer.devices.map(sanitizeDevice).filter(Boolean) : []
    };
}

function sanitizeDevice(device) {
    if (!device || typeof device !== 'object') return null;
    return {
        id: typeof device.id === 'string' ? device.id : `dev_${Date.now()}`,
        name: typeof device.name === 'string' ? device.name : '',
        objType: VALID_DEVICE_TYPES.includes(device.objType) ? device.objType : 'switch',
        stateIds: Array.isArray(device.stateIds) ? device.stateIds.filter(id => typeof id === 'string') : [],
        x: typeof device.x === 'number' && device.x >= 0 && device.x <= 100 ? device.x : 50,
        y: typeof device.y === 'number' && device.y >= 0 && device.y <= 100 ? device.y : 50,
        locked: typeof device.locked === 'boolean' ? device.locked : false,
        lockedUntil: typeof device.lockedUntil === 'number' && device.lockedUntil > 0 ? device.lockedUntil : null,
        icon: device.icon && typeof device.icon === 'object' ? sanitizeIcon(device.icon) : null,
        valueFont: device.valueFont && typeof device.valueFont === 'object' ? sanitizeFont(device.valueFont) : null,
        nameFont: device.nameFont && typeof device.nameFont === 'object' ? sanitizeFont(device.nameFont) : null,
        showValue: typeof device.showValue === 'boolean' ? device.showValue : true,
        showName: typeof device.showName === 'boolean' ? device.showName : true,
        prefixes: Array.isArray(device.prefixes) ? device.prefixes.filter(p => typeof p === 'string') : [],
        postfixes: Array.isArray(device.postfixes) ? device.postfixes.filter(p => typeof p === 'string') : [],
        warnBelow: typeof device.warnBelow === 'number' ? device.warnBelow : null,
        warnAbove: typeof device.warnAbove === 'number' ? device.warnAbove : null
    };
}

function sanitizeIcon(icon) {
    if (!icon || typeof icon !== 'object') return null;
    const kind = ['emoji', 'mfd', 'url', 'file'].includes(icon.kind) ? icon.kind : 'emoji';
    return {
        kind,
        value: typeof icon.value === 'string' ? icon.value : ''
    };
}

function sanitizeFont(font) {
    if (!font || typeof font !== 'object') return null;
    return {
        family: typeof font.family === 'string' ? font.family : 'Arial',
        weight: typeof font.weight === 'string' ? font.weight : '400',
        size: typeof font.size === 'string' ? font.size : '12px',
        color: typeof font.color === 'string' ? font.color : '#ffffff',
        bgColor: typeof font.bgColor === 'string' ? font.bgColor : 'transparent',
        position: VALID_FONT_POSITIONS.includes(font.position) ? font.position : 'overlay'
    };
}

function sanitizeBarConfig(bar) {
    if (!bar || typeof bar !== 'object') return null;
    return {
        height: Number.isInteger(bar.height) && bar.height >= 1 && bar.height <= 500 ? bar.height : 40,
        width: Number.isInteger(bar.width) && bar.width >= 1 && bar.width <= 2000 ? bar.width : 120,
        gap: Number.isInteger(bar.gap) && bar.gap >= 0 && bar.gap <= 100 ? bar.gap : 8,
        radius: Number.isInteger(bar.radius) && bar.radius >= 0 && bar.radius <= 200 ? bar.radius : 100,
        orient: VALID_BAR_ORIENTS.includes(bar.orient) ? bar.orient : 'h',
        position: VALID_BAR_POSITIONS.includes(bar.position) ? bar.position : 'top',
        align: VALID_BAR_ALIGNS.includes(bar.align) ? bar.align : 'center',
        textAlign: VALID_TEXT_ALIGNS.includes(bar.textAlign) ? bar.textAlign : 'left',
        iconPos: VALID_ICON_POSITIONS.includes(bar.iconPos) ? bar.iconPos : 'left',
        icon: bar.icon && typeof bar.icon === 'object' ? sanitizeIcon(bar.icon) : null,
        active: bar.active && typeof bar.active === 'object' ? sanitizeBarStyle(bar.active) : { bg: '#0cbaba', border: '#0cbaba', font: { family: 'Roboto', weight: '500', size: '14px', color: '#ffffff' } },
        inactive: bar.inactive && typeof bar.inactive === 'object' ? sanitizeBarStyle(bar.inactive) : { bg: '#2a2f36', border: '#3a4048', font: { family: 'Roboto', weight: '500', size: '14px', color: '#e8eaed' } }
    };
}

function sanitizeBarStyle(style) {
    if (!style || typeof style !== 'object') return {};
    return {
        bg: typeof style.bg === 'string' ? style.bg : '#0cbaba',
        border: typeof style.border === 'string' ? style.border : '#0cbaba',
        font: style.font && typeof style.font === 'object' ? {
            family: typeof style.font.family === 'string' ? style.font.family : 'Roboto',
            weight: typeof style.font.weight === 'string' ? style.font.weight : '500',
            size: typeof style.font.size === 'string' ? style.font.size : '14px',
            color: typeof style.font.color === 'string' ? style.font.color : '#ffffff'
        } : { family: 'Roboto', weight: '500', size: '14px', color: '#ffffff' }
    };
}

function sanitizeTemplate(template) {
    if (!template || typeof template !== 'object') return null;
    return {
        name: typeof template.name === 'string' ? template.name : 'Unnamed Template',
        data: template.data && typeof template.data === 'object' ? template.data : {}
    };
}

function sanitizeGuide(guide) {
    if (!guide || typeof guide !== 'object') return null;
    return {
        id: typeof guide.id === 'string' ? guide.id : `guide_${Date.now()}`,
        type: VALID_GUIDE_TYPES.includes(guide.type) ? guide.type : 'h',
        position: typeof guide.position === 'number' && guide.position >= 0 && guide.position <= 100 ? guide.position : 50
    };
}

function getDefaultConfig() {
    return {
        floors: [],
        templates: [],
        screenBg: '#f7f9fc',
        planBg: '#2a2f36',
        backdropRadius: 16,
        scaleMode: 'height',
        floorBar: null,
        layerBar: null
    };
}

module.exports = {
    validateConfig,
    sanitizeConfig,
    getDefaultConfig,
    ValidationResult,
    VALID_DEVICE_TYPES,
    VALID_SCALE_MODES,
    MAX_CONFIG_SIZE,
    MAX_FLOORS,
    MAX_LAYERS_PER_FLOOR,
    MAX_DEVICES_PER_LAYER,
    MAX_GUIDES_PER_FLOOR,
    MAX_TEMPLATES
};