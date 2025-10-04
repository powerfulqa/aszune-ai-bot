# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.5] - 2025-10-04

### Critical Bug Fixes

- **FIXED**: Cache command undefined values issue
  - **Root Cause**: Missing method implementations in CacheManager and incorrect property references
  - **Resolution**: Added `getStats()`, `getDetailedInfo()`, `invalidateByTag()` methods to
    CacheManager
  - **Impact**: `/cache` command now displays proper values instead of "Memory Usage: undefined /
    undefined"

### Service Architecture Improvements

- **Enhanced CacheManager**: Complete method implementation with comprehensive error handling
- **PerplexityService Integration**: Fixed property references from `this.cache` to
  `this.cacheManager`
- **Field Compatibility**: Added complete field coverage for Discord command requirements
- **Error Resilience**: Improved fallback mechanisms with proper default values

### Technical Enhancements

- **Service Delegation**: Enforced proper service layer architecture patterns
- **Method Contracts**: Established consistent API contracts across cache services
- **Documentation**: Added comprehensive cache service architecture documentation
- **Testing**: Enhanced error scenario testing and field validation

### Display Improvements

- **Cache Statistics**: All cache fields now display meaningful values
- **Memory Usage**: Proper display format (e.g., "0 B / 50 MB")
- **Configuration**: Shows strategy and uptime (e.g., "Strategy: hybrid, Uptime: 28s")
- **Performance Metrics**: Hit rate, operations count, and eviction statistics

### Lessons Learned Integration

- **Updated Copilot Instructions**: Added v1.6.5 architectural patterns and requirements
- **Service Patterns**: Documented critical property naming and delegation requirements
- **Field Requirements**: Established complete field compatibility matrix for Discord commands

## [1.6.0] - 2025-10-01

### Major Features Added

- **Analytics Integration**: Complete Discord analytics system with `/analytics`, `/dashboard`,
  `/resources` commands
  - **DiscordAnalytics Service**: Server engagement metrics, usage patterns, and trend analysis
  - **PerformanceDashboard Service**: Real-time system monitoring and health assessment
  - **ResourceOptimizer Service**: Performance optimization analysis and automated recommendations
- **Proprietary License System**: Migrated from MIT to proprietary license with built-in enforcement
  - **License Validation**: Automated license checking and usage tracking
  - **Multiple License Tiers**: Personal (free), Community ($29/month), Commercial ($299/month),
    Enterprise (custom)
  - **License Server**: Express.js-based license management with web dashboard
- **Raspberry Pi License Integration**: Automated Pi setup with license server deployment
- **Enhanced Security Monitor**: Comprehensive security threat detection and monitoring
- **Performance Tracker**: Advanced performance monitoring and optimization recommendations

### Code Quality & Security

- Enhanced code quality with 40% reduction in lint errors (22 → 13)
- **CRITICAL SECURITY FIX**: Timing attack vulnerability in license server API authentication
- Advanced method decomposition for better maintainability across analytics modules
- Comprehensive input validation and null safety improvements
- Professional code structure with single-responsibility helper methods

### New Files & Components

- `LICENSE` - New proprietary license terms and enforcement
- `src/utils/license-validator.js` - License validation system
- `src/utils/license-server.js` - License management server with timing-safe authentication
- `src/utils/discord-analytics.js` - Complete Discord server analytics (refactored v1.6.0)
- `src/utils/performance-dashboard.js` - Real-time performance monitoring (enhanced v1.6.0)
- `src/utils/resource-optimizer.js` - System optimization analysis (refactored v1.6.0)
- `src/utils/security-monitor.js` - Security threat detection
- `src/utils/performance-tracker.js` - Performance tracking and reporting
- `src/utils/enhanced-conversation-context.js` - Enhanced conversation management
- `docs/LICENSE-SERVER-SETUP.md` - License server deployment guide
- `docs/RASPBERRY-PI-LICENSE-SETUP.md` - Pi-specific license setup
- `scripts/pi-license-setup.sh` - Automated Pi license server deployment

### Testing & Quality Assurance

- **991 Total Tests**: Comprehensive test suite covering all new analytics functionality
- **100% Success Rate**: All tests passing including new analytics integration tests
- Added comprehensive test coverage for all new analytics commands and services
- Enhanced error handling and edge case testing for analytics features

### Breaking Changes

- **License Change**: Migrated from MIT to proprietary license (affects distribution rights)
- **Package.json**: License field changed from "MIT" to "UNLICENSED"
- **Usage Tracking**: Built-in license validation requires proper licensing for continued use

### Fixed

- **CRITICAL**: Test failures in bot initialization and shutdown processes
- **CRITICAL**: Resource optimizer null input handling and method complexity
- Undefined variable references in test suites across analytics components
- Method complexity violations in analytics and performance modules
- Package.json license format compliance and consistency

### Changed

- **Major Architecture**: Added complete analytics and monitoring infrastructure
- **Command System**: Extended with analytics commands (`/analytics`, `/dashboard`, `/resources`)
- **License Model**: Transformed from open-source to proprietary software with tiered licensing
- Refactored analytics modules with helper methods for better organization
- Enhanced license server with modular route setup and timing-safe comparisons
- Improved system architecture with comprehensive monitoring capabilities

### Security

- **License Enforcement**: Built-in usage tracking and license validation
- **Secure Authentication**: Timing-safe API key validation in license server
- **Comprehensive Monitoring**: Security threat detection and automated alerting
- Enhanced input validation and error boundary handling across all new services

### Migration Notes

- **Existing Users**: 7-day grace period for license registration
- **No Code Changes**: All existing functionality preserved with backward compatibility
- **New Features Optional**: Analytics commands are additive, no breaking changes to core
  functionality

## [1.5.0] - 2025-09-29

### Added

- qlty code quality tooling integration with 8 unified plugins
- Comprehensive security scanning with Gitleaks, Trivy, and Semgrep
- Code complexity and duplication monitoring with automated thresholds
- Standard project documentation (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md)
- Markdownlint configuration for consistent documentation formatting
- Unified code quality configuration in `.qlty/qlty.toml`
- 7 new npm scripts for quality workflow automation
- Enhanced CI/CD pipeline with automated quality gates
- Professional documentation standards and contribution guidelines

### Changed

- Moved linting configurations to `.qlty/configs/` directory for centralized management
- Enhanced .gitignore with qlty-specific exclusions
- Updated all project documentation to reflect quality standards
- Improved development workflow with integrated quality tooling

### Security

- Multi-layered security scanning preventing secret commits
- Automated vulnerability detection in dependencies
- Static application security testing (SAST) integration

## [1.4.1] - 2025-09-28

### Added

- Service-oriented architecture with focused, single-responsibility classes
- Enhanced input validation with common helper methods
- Comprehensive logging infrastructure across all modules
- Dedicated service classes: ApiClient, CacheManager, ResponseProcessor, ThrottlingService

### Changed

- Split PerplexityService into focused service classes for better maintainability
- Eliminated all console statements in production code, replaced with proper logger calls
- Enhanced validation logic with improved sanitization handling
- Systematic removal of code duplication patterns

### Fixed

- 94.8% reduction in ESLint issues (861 → 45)
- Unused variables across test suite
- Code duplication across services and validation modules

## [1.4.0] - 2025-01-22

### Added

- Comprehensive test coverage enhancement from 77.79% to 82%+
- 380+ new passing tests with extensive error handling coverage
- Enhanced memory monitoring, message chunking, and performance tracking
- Advanced input validation and sanitization system
- Real-time performance monitoring and optimization
- Comprehensive error handling and recovery mechanisms

### Changed

- Enhanced test count from 371 to 536 passing tests
- Improved utility modules for error handling, input validation, and memory monitoring
- Enhanced message chunking with advanced boundary detection

### Security

- Fixed critical security vulnerabilities
- Enhanced input sanitization and validation
- Improved error handling to prevent information leakage

## [1.3.6] - 2025-08-15

### Changed

- Improved response time and reduced memory usage
- Enhanced error detection and recovery mechanisms
- Refined message formatting and content delivery

## [1.3.5] - 2025-08-12

### Fixed

- YouTube links showing duplicate text
- Domain names being split by periods
- Message truncation issues

### Changed

- Reduced message length to prevent truncation
- Added special handling for domains and TLDs

## [1.3.4] - 2025-08-11

### Added

- Enhanced source reference handling for various formats including YouTube links
- Specific handling to preserve Markdown links across chunks

### Fixed

- Message chunking to prevent sentence truncation

## [1.3.3] - 2025-08-10

### Added

- Enhanced message chunker with source reference detection
- Source link processing to convert references to clickable links

### Fixed

- Source references (especially YouTube URLs) to appear as clickable links in Discord
- Truncation issues where the last sentence would get cut off
- URLs being split across chunk boundaries

### Security

- Added protection to prevent URLs from being split across chunk boundaries

## [1.3.2] - 2025-08-06

### Added

- Smart message chunking system with paragraph and sentence boundary detection
- Clear numbering system for multi-part messages
- Word boundary preservation in message chunks

## [1.3.1] - 2025-08-02

### Added

- Automatic message chunking for long responses
- Full content delivery without truncation
- Enhanced URL and source reference handling

## [1.3.0] - 2025-08-01

### Added

- Enhanced testing infrastructure with comprehensive branch coverage
- Improved code quality and maintainability
- Better error handling throughout the application
- Consolidated duplicate code removal

### Changed

- Refactored ConversationManager to use class-based instantiation
- Fixed circular dependency issues by moving config access inside methods
- Updated all code and tests to use new ConversationManager pattern

### Fixed

- Logger branch coverage tests improving coverage from 57.89% to 82.45%
- Duplicate manual mock warnings in test infrastructure
- All test failures with improved reliability

### Security

- Fixed security issues related to file permissions
- Added explicit file permissions (0o644 for files, 0o755 for directories)
- Improved validation for API interactions

## [1.2.2] - 2025-07-30

### Added

- Comprehensive Pi optimization documentation
- Future-proof architecture supporting upcoming Pi models

### Changed

- Enhanced configuration system for dynamic setting adjustments
- Improved startup process with environment-aware initialization

## [1.2.1] - 2025-07-24

### Added

- Automatic Raspberry Pi model detection and optimizations
- Memory management optimizations for resource-constrained devices
- Connection throttling to limit concurrent network requests
- Lazy loading system for heavy dependencies
- Message debouncing to prevent excessive API calls
- Automatic cache pruning for better memory usage
- Model-specific settings for Pi 3, Pi 4, and Pi 5

## [1.2.0] - 2025-07-20

### Added

- Graceful shutdown handling with protection against multiple executions
- Enhanced signal handling for SIGINT and SIGTERM
- Improved interval tracking in conversation manager

### Changed

- Simplified error handling in Perplexity service
- Extracted response parsing logic into separate methods
- Updated security audit configuration for production dependencies
- Enhanced CI workflow to fail on high severity issues

### Fixed

- All failing test suites (140 tests now passing)
- Improved test coverage to >90% across the codebase

## [1.1.0] - 2025-07-15

### Added

- Complete refactor to modular architecture under `src/` directory
- Stats tracking with `!stats` and `/stats` commands
- Slash command support for modern Discord experience
- Comprehensive testing with Jest
- CI/CD pipeline with GitHub Actions
- Code coverage reporting with Codecov

### Changed

- Robust command handler for easier extension and maintenance
- JavaScript `Map` objects for conversation history and rate limiting
- Enhanced error handling and environment variable validation

[Unreleased]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.6...v1.4.0
[1.3.6]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.5...v1.3.6
[1.3.5]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/chrishaycock/aszune-ai-bot/releases/tag/v1.1.0
