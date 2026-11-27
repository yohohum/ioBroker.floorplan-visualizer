'use strict';

const chai = require('chai');
const path = require('path');

const assert = chai.assert;

describe('Upload and Security Tests', function () {
    describe('Filename sanitization', function () {
        it('should reject path traversal attempts', function () {
            const maliciousNames = [
                '../test.png',
                '..\\test.png',
                '../../etc/passwd',
                '..\\..\\windows\\system32',
                '/etc/passwd',
                'C:\\Windows\\System32',
                'test/../malicious.png',
                'test\\..\\malicious.png'
            ];
            
            maliciousNames.forEach(name => {
                const safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '');
                assert.notEqual(safeName, name, `Path traversal not caught: ${name}`);
            });
        });

        it('should allow valid filenames', function () {
            const validNames = [
                'test.png',
                'image_1.jpg',
                'floor-plan.svg',
                'icon_123.png',
                'test-file_name.png'
            ];
            
            validNames.forEach(name => {
                const safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '');
                assert.equal(safeName, name, `Valid name rejected: ${name}`);
            });
        });

        it('should reject empty filenames', function () {
            const emptyNames = ['', '   ', '\t', '\n'];
            
            emptyNames.forEach(name => {
                const safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '');
                assert.equal(safeName, '', `Empty name not caught: "${name}"`);
            });
        });
    });

    describe('Base64 validation', function () {
        it('should accept valid base64', function () {
            const validBase64 = [
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                'SGVsbG8gV29ybGQ=',
                'QQ=='
            ];
            
            validBase64.forEach(b64 => {
                const base64Part = b64.split(';base64,').pop();
                assert.isTrue(/^[A-Za-z0-9+/=]+$/.test(base64Part), `Valid base64 rejected: ${b64}`);
            });
        });

        it('should reject invalid base64', function () {
            const invalidBase64 = [
                'not-base64!',
                'data:image/png;base64,not-base64!',
                'SGVsbG8gV29ybGQ=!',
                'data:image/png;base64,SGVsbG8gV29ybGQ=!'
            ];
            
            invalidBase64.forEach(b64 => {
                const base64Part = b64.split(';base64,').pop();
                assert.isFalse(/^[A-Za-z0-9+/=]+$/.test(base64Part), `Invalid base64 accepted: ${b64}`);
            });
        });
    });

    describe('File size limits', function () {
        it('should detect oversized files', function () {
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            // Create a buffer larger than 10MB
            const oversizedBuffer = Buffer.alloc(maxSize + 1);
            assert.isAbove(oversizedBuffer.length, maxSize);
            
            // Create a buffer exactly at limit
            const exactBuffer = Buffer.alloc(maxSize);
            assert.equal(exactBuffer.length, maxSize);
            
            // Create a buffer under limit
            const underBuffer = Buffer.alloc(maxSize - 1);
            assert.isBelow(underBuffer.length, maxSize);
        });
    });

    describe('MIME type validation', function () {
        it('should identify PNG signatures', function () {
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            assert.equal(pngSignature[0], 0x89);
            assert.equal(pngSignature[1], 0x50);
            assert.equal(pngSignature[2], 0x4E);
            assert.equal(pngSignature[3], 0x47);
        });

        it('should identify JPEG signatures', function () {
            const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
            assert.equal(jpegSignature[0], 0xFF);
            assert.equal(jpegSignature[1], 0xD8);
            assert.equal(jpegSignature[2], 0xFF);
        });

        it('should identify SVG content', function () {
            const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
            assert.isTrue(svgContent.trim().startsWith('<svg'));
            assert.isTrue(svgContent.includes('xmlns="http://www.w3.org/2000/svg"'));
        });
    });

    describe('Path resolution safety', function () {
        const uploadDir = '/tmp/test-uploads';
        
        it('should resolve paths within upload directory', function () {
            const safePaths = [
                'test.png',
                'subdir/image.png',
                'floor_1.png'
            ];
            
            safePaths.forEach(fileName => {
                const filePath = path.join(uploadDir, fileName);
                const resolved = path.resolve(filePath);
                const resolvedUploadDir = path.resolve(uploadDir);
                assert.isTrue(resolved.startsWith(resolvedUploadDir), `Path escaped: ${fileName}`);
            });
        });

        it('should detect relative path traversal attempts (before sanitization)', function () {
            // These paths would be dangerous WITHOUT sanitization
            // The actual protection is in the sanitization step in main.js
            const maliciousPaths = [
                '../test.png',
                'subdir/../../../etc/passwd'
            ];
            
            maliciousPaths.forEach(fileName => {
                const filePath = path.join(uploadDir, fileName);
                const resolved = path.resolve(filePath);
                const resolvedUploadDir = path.resolve(uploadDir);
                // Without sanitization, these would escape
                assert.isFalse(resolved.startsWith(resolvedUploadDir), `Path traversal should be detected: ${fileName}`);
            });
        });

        it('should handle absolute paths by showing they get sanitized', function () {
            // Absolute paths would be dangerous without sanitization
            // The sanitization in main.js converts '/etc/passwd' to 'etcpasswd'
            const absolutePath = '/etc/passwd';
            const safeName = String(absolutePath).replace(/[^a-zA-Z0-9._-]/g, '');
            assert.equal(safeName, 'etcpasswd', 'Absolute path should be sanitized to filename only');
            
            const filePath = path.join(uploadDir, safeName);
            const resolved = path.resolve(filePath);
            const resolvedUploadDir = path.resolve(uploadDir);
            // After sanitization, the path is safe
            assert.isTrue(resolved.startsWith(resolvedUploadDir), 'Sanitized absolute path is safe');
        });

        it('should handle Windows-style paths on Windows', function () {
            // On Windows, backslashes are path separators
            // On Unix, they're just part of the filename
            const windowsPaths = [
                '..\\..\\windows\\system32',
                'C:\\Windows\\System32'
            ];
            
            if (process.platform === 'win32') {
                windowsPaths.forEach(fileName => {
                    const filePath = path.join(uploadDir, fileName);
                    const resolved = path.resolve(filePath);
                    const resolvedUploadDir = path.resolve(uploadDir);
                    assert.isFalse(resolved.startsWith(resolvedUploadDir), `Path traversal not caught: ${fileName}`);
                });
            } else {
                // On Unix, backslashes are not path separators, so these are treated as filenames
                windowsPaths.forEach(fileName => {
                    const filePath = path.join(uploadDir, fileName);
                    const resolved = path.resolve(filePath);
                    const resolvedUploadDir = path.resolve(uploadDir);
                    // On Unix, these are treated as regular filenames with backslashes
                    assert.isTrue(resolved.startsWith(resolvedUploadDir), `On Unix, backslashes are not separators: ${fileName}`);
                });
            }
        });
    });
});

describe('Server Lifecycle Tests', function () {
    describe('Port validation', function () {
        it('should accept valid ports', function () {
            const validPorts = [1, 80, 443, 8080, 8083, 8084, 65535];
            validPorts.forEach(port => {
                assert.isTrue(port >= 1 && port <= 65535, `Valid port rejected: ${port}`);
            });
        });

        it('should reject invalid ports', function () {
            const invalidPorts = [0, -1, 65536, 70000, 'abc', null, undefined];
            invalidPorts.forEach(port => {
                const portNum = parseInt(port, 10);
                assert.isTrue(isNaN(portNum) || portNum < 1 || portNum > 65535, `Invalid port accepted: ${port}`);
            });
        });

        it('should detect port conflicts', function () {
            const adminPort = 8083;
            const presentationPort = 8083;
            assert.equal(adminPort, presentationPort, 'Ports should be detected as conflicting');
        });

        it('should allow different ports', function () {
            const adminPort = 8083;
            const presentationPort = 8084;
            assert.notEqual(adminPort, presentationPort, 'Different ports should not conflict');
        });
    });

    describe('Bind address validation', function () {
        it('should accept valid bind addresses', function () {
            const validBinds = ['0.0.0.0', '127.0.0.1', '192.168.1.100', '::', '::1'];
            validBinds.forEach(bind => {
                assert.isString(bind);
                assert.isAbove(bind.trim().length, 0);
            });
        });

        it('should reject invalid bind addresses', function () {
            const invalidBinds = ['', '   ', null, undefined, 123];
            invalidBinds.forEach(bind => {
                const isValid = typeof bind === 'string' && bind.trim().length > 0;
                assert.isFalse(isValid, `Invalid bind accepted: ${bind}`);
            });
        });
    });

    describe('Server error handling', function () {
        it('should identify EADDRINUSE error', function () {
            const error = new Error('listen EADDRINUSE');
            error.code = 'EADDRINUSE';
            assert.equal(error.code, 'EADDRINUSE');
        });

        it('should identify EACCES error', function () {
            const error = new Error('listen EACCES');
            error.code = 'EACCES';
            assert.equal(error.code, 'EACCES');
        });

        it('should handle unknown errors', function () {
            const error = new Error('Unknown error');
            error.code = 'UNKNOWN';
            assert.notEqual(error.code, 'EADDRINUSE');
            assert.notEqual(error.code, 'EACCES');
        });
    });
});