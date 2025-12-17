# Release Notes - v1.10.0

**Release Date:** December 2025

## Overview

Version 1.10.0 is a significant quality and maintainability release focused on code quality
improvements, test reliability, and documentation cleanup. This release represents extensive
refactoring work to reduce code complexity, eliminate duplication, and improve the overall codebase
health.

## Highlights

- 🔧 **78% Reduction in Code Quality Issues** - Comprehensive QLTY compliance improvements
- 🧪 **1,708+ Tests Passing** - Expanded test coverage with improved reliability
- 📊 **70%+ Coverage Thresholds** - Raised from 64% with improved critical path coverage
- 🏗️ **Reduced Code Complexity** - Function complexity reduced across 20+ high-complexity functions
- 📝 **Documentation Cleanup** - Removed 50+ obsolete docs, streamlined wiki

## Code Quality Improvements

### Complexity Reduction

Systematically reduced cyclomatic complexity in high-complexity functions:

- **web-dashboard.js**: Extracted 15+ helper methods for handlers
- **enhanced-cache.js**: Object dispatch pattern for eviction strategies
- **commands/index.js**: Extracted command matching and mock interaction helpers
- **perplexity-secure.js**: Simplified lazy loading with centralized test mocks
- **input-validator.js**: Data-driven validation patterns
- **network-detector.js**: Shared IP detection helper functions

### Code Duplication Elimination

- Created shared utility modules: `db-query-helpers.js`, `system-info.js`, `alert-factory.js`,
  `config-validators.js`, `reminder-filters.js`
- Consolidated reminder handler logic across web-dashboard and handler modules
- Extracted validation helpers to reduce repetitive patterns
- Unified error handling patterns across services

### Function Parameter Optimization

- Reduced function parameters using options objects pattern
- `createAlert()`: 7 params → options object
- `getUserHistory()`: 6 params → options object
- `createReminder()`: 6 params → 4 params

## Testing Improvements

### Test Infrastructure

- **In-Memory SQLite**: All database tests now use in-memory SQLite for faster, isolated testing
- **Parallel Test Sharding**: CI pipeline optimized with parallel test execution
- **Coverage Merging**: Proper coverage aggregation across sharded test runs
- **Console Silencing**: Cleaner CI output with suppressed console logs during tests

### Coverage Improvements

- Raised coverage thresholds from 64% to 70%
- Added comprehensive tests for:
  - `perplexity-secure.js` (44.7% → 81.36%)
  - `cache-manager.js` (97% coverage, 40 new tests)
  - `message-formatter.js` (58.6% → 97.1%)
  - `validation-helpers.js` (68 new tests)
  - `time-parser.js` (72 new tests)
  - `reminder-service.js` (21 new tests)

### Test Suite Organization

- Split large test files to comply with `max-lines-per-function` ESLint rule
- Extracted shared setup helpers for consistent test configuration
- Added centralized mock modules for Discord, database, and services

## CI/CD Enhancements

- **Optimized Pipeline**: Reduced build times with parallel test sharding
- **Critical Coverage Gate**: Executes first to prevent unnecessary full-suite runs
- **Automatic Formatting**: Prettier auto-fix integrated into CI
- **QLTY Integration**: Automated code quality checks with maintainability scoring

## Dashboard Improvements

### Production Stability

- Removed all fake/hardcoded demo data from production pages
- Fixed Socket.IO integration for real-time data across all pages
- Improved PM2 service management reliability
- Added Discord connection status indicator

### Bug Fixes

- Fixed git pull button HTTP status handling
- Resolved restart loop issues with systemd + PM2 conflicts
- Fixed reminder creation immediate table refresh
- Improved network status detection (DietPi support, DHCP/Static)

### Instance Tracking & Authorization

- Added server-side instance authorization (approve/revoke) via the tracking server.
- Services page shows **Authorized Instances** vs **Unauthorized Instances** and supports admin
  actions.
- Fixed Services page instance count so it updates without requiring an expand/click.
- Prevented duplicate instance registrations (telemetry now defers to the primary instance tracker).
- Improved location display: hostname/local fallback when geo-IP lookups fail; supports
  `BOT_LOCATION` override.

## Breaking Changes

None - fully backward compatible with v1.9.x.

## Migration Guide

No migration steps required. Simply update to v1.10.0.

## Dependencies

- Updated `express` 4.21.2 → 4.22.0 (CVE-2024-61569 fix)
- All other dependencies remain compatible

## Statistics

| Metric              | v1.9.0 | v1.10.0 | Change |
| ------------------- | ------ | ------- | ------ |
| Tests               | 1,231  | 1,722   | +491   |
| Tests Passing       | 1,228  | 1,708   | +480   |
| Coverage Threshold  | 64%    | 70%     | +6%    |
| ESLint Issues       | ~400   | ~20     | -95%   |
| Code Quality Issues | 37     | 9       | -78%   |

## Contributors

This release includes contributions from multiple development sessions focused on code quality and
maintainability improvements.

## License

This project is **Source Available - All Rights Reserved**.

- ✅ Free to view and learn from the code
- ❌ No copying, forking, or downloading without permission
- ❌ No use in your own projects without permission
- ❌ No running or deploying without permission

**All uses beyond viewing require explicit written permission.** To request permission,
[open an issue](https://github.com/powerfulqa/aszune-ai-bot/issues) on GitHub.

See [LICENSE](../LICENSE) for full terms.

## Full Changelog

See the [commit history](https://github.com/powerfulqa/aszune-ai-bot/compare/v1.9.0...v1.10.0) for
the complete list of changes.
