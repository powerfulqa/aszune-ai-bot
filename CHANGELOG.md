# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Removed a sanitizer bug that silently stripped SQL keywords (`drop`, `create`, `update`, …) from
  every chat message, corrupting gaming vocabulary before it reached the AI or history
- Hardened the admin dashboard: Socket.IO handshake authentication, destructive operations gated
  behind `DASHBOARD_TOKEN` (read-only without it), config file allowlist + secret masking,
  command-injection fix (execFile with allowlisted args), and constant-time token comparison
- Removed the hardcoded default `TRACKING_ADMIN_KEY`; the tracking server now requires it and
  persists authorizations to SQLite (survives restarts)
- `npm audit` now **gates CI** (production, high severity); cleared 33 advisories (16 high) to zero

### Changed

- **Node.js floor raised to `>=22.19.0`** (Node 20 is EOL); added `.nvmrc` (24); CI now tests a
  Node 22 + 24 matrix and runs on current GitHub Actions (checkout/setup-node/codecov v7)
- **Tooling:** ESLint 8 → 10 with flat config (`eslint.config.js`); Jest 29 → 30; Prettier 3.9
- **Runtime deps:** discord.js 14.27, express 4 → 5, undici 7 → 8 (with an enforced request
  timeout), better-sqlite3 12 → 13, dotenv 16 → 17
- Added Dependabot; consolidated five divergent AI-agent instruction files into a single root
  `CLAUDE.md`
- **Migrated the AI backend to the Perplexity Agent API** (`/v1/agent`, `USE_AGENT_API=true`,
  `AGENT_PRESET` default `low`) with web search, ahead of the Chat Completions sunset
  (2026-09-27). The adapter was validated end-to-end against the live endpoint; the legacy
  Chat Completions path (`sonar`/`sonar-pro`) remains as a fallback via `USE_AGENT_API=false`

### Fixed

- Restored missing config keys (`CACHE.MAX_MEMORY_MB`/`DEFAULT_TTL_MS`, `COLORS.SUCCESS`/`WARNING`),
  the user-stats save interval (was 24h, now 5m), a duplicate emoji-reaction call, and a missing
  telemetry shutdown step
- Removed broken/stub npm scripts and stopped tracking generated test artifacts
- **Startup crash:** `ConversationManager.initializeIntervals` recursed infinitely outside test
  mode — the singleton export shadowed the prototype method — crash-looping the bot in production
  while the full test suite (guarded by `NODE_ENV=test`) stayed green
- **Dashboard:** System Info panel blank (`/api/system` served an un-awaited Promise); Network
  panel blank (`dashboard.detectGateway` did not exist → now `NetworkDetector.detectGateway`);
  REST-fed panels returned 401 because the client only sent the auth token on the Socket.IO
  handshake, never on REST fetches; reminder edit/delete failed with "Missing required fields"
  (missing/incorrect `userId`)
- Normalised the Agent API's `[web:N]` inline citation markers to `[N]`

## [2.0.0] - 2026-04-08

### Security

- Fix SQL injection in `database.js` `getPerformanceMetrics()` — parameterised query instead of
  string interpolation

### New Features

- **Intelligent Model Selection**: Auto-upgrade to `sonar-pro` for multi-turn conversations
- **Citation Support**: Compact domain-only source footer on AI responses
- **Search Domain Filter**: Configurable `SEARCH_DOMAIN_FILTER` for authoritative gaming sources
- **Search Recency Filter**: Auto-detect time-sensitive queries and prioritise recent results
- **Token Usage Tracking**: Log prompt/completion/total tokens from every API response

### Architecture

- Remove 625 lines of duplicate inline socket handlers from `web-dashboard.js`
- Wire up extracted handler modules (`configHandlers`, `logsHandlers`, `networkHandlers`,
  `reminderHandlers`, `serviceHandlers`)
- Replace all synchronous file I/O with async `fsPromises` equivalents
- Replace `execSync` with async `execPromise` for git SHA lookup
- Replace metrics `setInterval` with self-scheduling `setTimeout` to prevent overlap
- Cap `userStats` Map at `DEFAULT_MAX_ENTRIES` to prevent unbounded growth

### Bug Fixes

- Fix conversation cleanup using `CACHE.CLEANUP_INTERVAL_MS` (24h) instead of
  `CONVERSATION_INACTIVITY_TIMEOUT_MS` (15min) as threshold
- Fix `getTimeAgo()` month/year calculation using calendar-aware math instead of `diffDays / 30`
- Add debug logging to silent `.catch()` blocks in web dashboard
- Convert help command from string concatenation to template literal

### Tests

- Add 32 new tests for Perplexity API features (model selection, search options, citations, recency
  filter, token logging)
- Fix 3 pre-existing flaky time-ago tests
- **1,845 tests passing** across 182 suites, 0 failures

## [1.11.0] - 2026-01-07

### New Features

- **`/userinfo` Command**: Display comprehensive user information
  - Account creation date and age
  - Server join date and position
  - Current status and activity
  - Roles with permission highlights
  - Discord badges detection
  - Avatar display
- **`/serverinfo` Command**: Display detailed server statistics
  - Member breakdown (humans, bots, online)
  - Channel counts by type (text, voice, forum, stage)
  - Role statistics (total, hoisted, managed)
  - Boost status and tier
  - Emoji and sticker counts
  - Security settings
  - Server features (Community, Verified, etc.)

### Technical Improvements

- New embed builders following established architecture pattern
- Helper functions exported for reusability
- Proper error handling with ErrorHandler integration

### Documentation

- Added RELEASE-NOTES-v1.11.0.md
- Updated wiki Command-Reference.md
- Updated help command output

## [1.10.0] - 2025-01-17

### Code Quality Excellence

- **ESLint Improvements**: 94.8% reduction in lint issues across the codebase
- **Complexity Reduction**: Systematic refactoring of high-complexity functions
  - Dashboard modules reduced from 25+ to ≤15 complexity
  - Enhanced cache services with helper extraction patterns
  - Perplexity service streamlined with focused helper methods
- **Code Duplication**: Eliminated duplicate validation patterns across modules
- **Unused Imports**: Removed all unused import statements

### CI/CD Optimization

- **16× Faster Pipeline**: Intelligent skip detection for unchanged code paths
- **Smart Caching**: Dependency caching reduces build times
- **Parallel Execution**: Test suites run concurrently where possible

### Documentation Cleanup

- **Removed 60+ Obsolete Files**: Cleaned up agent handoffs, session summaries, implementation plans
- **Consolidated Architecture**: Merged scattered docs into focused reference files
- **Streamlined README**: Reduced from 1000+ lines to focused user documentation
- **Updated Wiki**: Simplified version history, cleaner navigation

### Testing

- **1,708+ Tests Passing**: Comprehensive test suite with 14 skipped
- **178 Test Suites**: Full coverage across all modules
- **Dual-Threshold Policy**: ≥80% critical files / ≥65% global baseline

## [1.9.0] - 2025-01-15

### Dashboard Feature Suite

- **Real-Time Log Viewer**: Live log streaming with filtering and export
- **Service Management**: systemd integration for service control
- **Configuration Editor**: Safe .env and config.js editing
- **Network Status**: Interface monitoring and connectivity checks
- **Reminder Management**: Web-based CRUD operations

## [1.8.0] - 2025-11-13

### Web Dashboard

- **Express + Socket.io Dashboard**: Real-time metrics at localhost:3000
- **Coverage Policy**: Dual-threshold ≥80% critical / ≥65% global
- **Complexity Reductions**: Function complexity aligned with ≤10 target

## [1.7.0] - 2025-10-05

### Major Features

- **🗄️ Database Integration**: Full SQLite database implementation for persistent data storage
  - **Conversation History**: User messages and bot responses stored persistently
  - **User Analytics**: Message counts and last activity timestamps tracked per user
  - **Automatic Setup**: Database and tables created automatically on first run
  - **Graceful Fallback**: Seamless operation even when database is unavailable
  - **Data Management**: Built-in user data clearing and bulk operations

### Database Service Features

- **SQLite Integration**: High-performance local database with better-sqlite3 driver
- **Smart Initialization**: Automatic database path resolution and table creation
- **User Statistics**: Tracks message counts, last activity, and engagement metrics
- **Message History**: Persistent storage with automatic cleanup (10 message limit per user)
- **Data Integrity**: Foreign key constraints and automatic cleanup triggers
- **Test Coverage**: Comprehensive test suite with 17 database-specific tests

### Technical Improvements

- **Service Architecture**: Clean separation between database operations and business logic
- **Error Handling**: Robust error handling with fallback mechanisms for database failures
- **Configuration**: Flexible database path configuration via environment variables
- **Memory Efficiency**: Automatic cleanup of old messages to maintain performance
- **Cross-Platform**: Works consistently across Windows, Linux, and Raspberry Pi

### Testing & Quality

- **Database Tests**: 122 comprehensive tests covering all database operations across 6 modular test
  files
- **Integration Tests**: Full conversation flow testing with persistent storage
- **Mocking Strategy**: Proper database service mocking for other test suites
- **Error Scenarios**: Testing of database failures and recovery mechanisms
- **Performance**: Load testing with message limits and cleanup operations
- **Test Architecture**: Split monolithic test file into maintainable modular components

### Bug Fixes

- **Chat Validation**: Fixed 3 previously failing chat validation branch tests
- **Mock Completeness**: Enhanced mock implementations for comprehensive test coverage
- **Service Dependencies**: Resolved circular dependency issues with database integration
- **Error Messages**: Improved error categorization and user-friendly messaging

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

<!-- Note: v1.11.0 and v2.0.0 are documented above but were never git-tagged, so they have no
     compare links. The latest tag is v1.10.0. -->

[Unreleased]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.10.0...HEAD
[1.10.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.6.5...v1.7.0
[1.6.5]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.6.0...v1.6.5
[1.6.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.6...v1.4.0
[1.3.6]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.5...v1.3.6
[1.3.5]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/powerfulqa/aszune-ai-bot/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/powerfulqa/aszune-ai-bot/releases/tag/v1.1.0
