# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- qlty code quality tooling integration
- Comprehensive security scanning with gitleaks and semgrep  
- Code complexity and duplication monitoring
- Standard project documentation (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md)
- Markdownlint configuration for consistent documentation formatting
- Unified code quality configuration in `.qlty/qlty.toml`

### Changed
- Moved linting configurations to `.qlty/configs/` directory
- Enhanced .gitignore with qlty-specific exclusions

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

[Unreleased]: https://github.com/chrishaycock/aszune-ai-bot/compare/v1.4.1...HEAD
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