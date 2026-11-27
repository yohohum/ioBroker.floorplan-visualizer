# Changelog

## 15.3.0 (2026-11-27)
### Changed
- **BREAKING**: Complete rewrite following ioBroker Adapter Development Skill
- Migrated admin UI from HTML config to jsonConfig with full i18n support (11 languages)
- Updated minimum Node.js version to 18.0.0
- Updated dependencies: @iobroker/adapter-core ^3.0.0, express ^4.18.2, socket.io ^4.7.2
- Added comprehensive test infrastructure (@iobroker/testing, unit, package, integration tests)
- Added GitHub Actions CI/CD workflow (test-and-release.yml)
- Added ESLint configuration and TypeScript type checking
- Improved adapter lifecycle management and error handling
- Added proper state definitions with semantic roles

### Fixed
- Version synchronization between package.json and io-package.json
- Admin configuration now uses jsonConfig (compatible with Admin 6+)
- Translations now available for all 11 required languages (en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn)

### Security
- Added authentication for admin API (Bearer token)
- Separated admin and presentation API endpoints
- Restricted presentation API to allowlisted state IDs only
- Added CORS origin restrictions
- Added path traversal protection for file uploads
- Added input validation and size limits for uploads
- Removed wildcard CORS (`*`)

### Added
- Comprehensive CHANGELOG.md
- .editorconfig for consistent code style
- Updated .gitignore and .npmignore
- Test setup with mocha configuration
- Security regression tests for API endpoints

## 15.2.0 (2026-10-08)
### Added
- Per-floor guides (each floor has its own guides)
- Floor slug/identifier field for URLs (`?floor=floor_<slug>`)
- Automatic migration of global guides to first floor

### Fixed
- Flicker when switching layers and floors
- Delete all guides now operates within current floor only

## 15.1.0 (2026-10-08)
### Added
- Context menu for guides (right-click)
- "Delete guide" and "Delete all guides" actions

### Fixed
- Blocked default browser context menu on plan area

## 15.0.0 (2026-10-08) — Stable release
### Added
- Three scaling modes (by height, by width, no scaling)
- Backdrop with precise 3% padding from window edges
- Floor/layer buttons inside backdrop with configurable positioning
- Switch lock with automatic restoration
- Guides with object snapping
- Multi-selection and alignment
- Object templates
- Full button panel customization

### Fixed
- Flicker when changing lock state
- Object positioning when changing scale

## 14.0.0
### Added
- Floor and layer icons
- Layer renaming
- Rooms and functions in ioBroker object tree

## 13.0.0
### Added
- Guides
- Arrow key movement
- Object alignment

## 12.0.0
### Added
- Universal icon picker
- Panel button settings

## 1.0.0 — 11.0.0
### Added
- Initial versions with basic features