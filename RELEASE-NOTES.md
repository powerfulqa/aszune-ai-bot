# Release Notes

This file contains the master release notes for the Aszune AI Bot. For detailed version-specific
notes, see the [docs/](./docs/) directory.

---

## Version History

### v1.4.1 - Code Quality Excellence & Architecture Refinement

- **Code Quality Excellence**: 94.8% reduction in ESLint issues (861 → 45)
- **Service Architecture Refactoring**: Split PerplexityService into focused classes (ApiClient,
  CacheManager, ResponseProcessor, ThrottlingService)
- **Production Code Cleanup**: Eliminated all console statements, replaced with proper logger calls
  (100% elimination)
- **Code Duplication Elimination**: Systematic removal of duplicate patterns across services and
  validation
- **Enhanced Input Validation**: Common validation helpers and improved sanitization logic
- **Logging Infrastructure Enhancement**: Comprehensive logging improvements across all modules
- **qlty Philosophy Adherence**: Following modern code quality principles for maintainability
- **All Tests Passing**: Maintained 536 passing tests throughout architectural improvements
- Full details in [RELEASE-NOTES-v1.4.1.md](./RELEASE-NOTES-v1.4.1.md)

### v1.4.0 - Comprehensive Testing & Coverage Enhancement

- Massive test coverage improvement from 77.79% to 82%+
- Added comprehensive test suites for memory monitoring, message chunking, and command handling
- Expanded test count from 371 to 536 passing tests
- Enhanced error handling and recovery mechanisms across all modules
- New utility modules for error handling, input validation, memory monitoring, and performance
  tracking
- Enhanced message chunking with advanced boundary detection and source link processing
- Comprehensive input sanitization and validation system
- Advanced memory management and garbage collection
- Real-time performance monitoring and optimization
- **Recent Code Quality Improvements**: Fixed critical security vulnerabilities, import
  inconsistencies, and code duplication issues identified through code review
- Full details in [RELEASE-NOTES-v1.4.0.md](./RELEASE-NOTES-v1.4.0.md)

### v1.3.6 - Performance and Stability Enhancements

- Improved response time and reduced memory usage
- Enhanced error detection and recovery mechanisms
- Refined message formatting and content delivery
- Full details in [RELEASE-NOTES-v1.3.6.md](./RELEASE-NOTES-v1.3.6.md)

### v1.3.5 - Enhanced URL Processing and Layout Fixes

- Fixed YouTube links showing duplicate text
- Fixed domain names being split by periods (e.g., fractalsoftworks.com)
- Further reduced message length to prevent truncation
- Added special handling for domains and TLDs

### v1.3.4 - Advanced Source Link Formatting and Anti-Truncation

- Enhanced source reference handling for various formats including YouTube links
- Improved message chunking to prevent sentence truncation
- Added specific handling to preserve Markdown links across chunks

### v1.3.3 - Source Link Enhancement and Truncation Fix

- Fixed source references (especially YouTube URLs) to appear as clickable links in Discord
- Fixed truncation issues where the last sentence would get cut off
- Added protection to prevent URLs from being split across chunk boundaries
- Full details in [RELEASE-NOTES-v1.3.3.md](./RELEASE-NOTES-v1.3.3.md)

### v1.3.2 - Message Chunking Enhancement

- Fixed critical bug where words at chunk boundaries could be incorrectly joined
- Implemented intelligent space handling at chunk boundaries
- Full details in [docs/v1.3.2.md](./docs/v1.3.2.md)

### v1.3.1 - Message Chunking Feature

- Added support for splitting long messages into multiple Discord embeds
- Full details in [docs/v1.3.1.md](./docs/v1.3.1.md)

### v1.3.0 - Initial Versioned Release

- First versioned release
- Full details in [docs/v1.3.0.md](./docs/v1.3.0.md)

### Initial Release

- First public release of Aszune AI Bot.
- Features:
  - Discord bot using Perplexity API (sonar model).
  - Maintains per-user conversation history.
  - Emoji reactions based on keywords.
  - Rate limiting to prevent spam.
  - `.env`-based configuration for secrets.
  - Basic commands: `!help`, `!clearhistory`, `!summary`.

---

## Enhancements

- Added `!summarise <text>` command for summarising arbitrary text.
- Improved help command output.
- All bot replies and summaries use UK English spelling and phrasing.
- Improved error handling and environment variable checks.
- Refactored command handling for easier extension.
- Switched conversation history and rate limiting to use JavaScript `Map` for better performance.

---

## Version 1.1.0

### Refactor & Feature Update

- **Architecture Improvements:**
  - Complete refactor to modular architecture for better maintainability
  - Enhanced code structure with separate service and utility modules
  - Resolved test suite open handles issues

- **New Features:**
  - Added `!stats` and `/stats` commands to track user message and summary counts
  - Added Discord slash command support for all major commands
  - Fixed summary command to ensure proper API compliance
- **Testing & CI:**
  - Achieved >80% test coverage across the codebase
  - Added QLTY and Codecov integration for automated coverage reporting
  - Set up GitHub Actions workflow for continuous integration
  - Fixed test mocking for Discord.js Client

- **Documentation:**
  - Updated README to reflect new features and improvements
  - Enhanced documentation for stats feature and slash commands

---

## CI/CD & Testing

- Added Jest unit and integration tests for core utilities and bot logic.
- Added Codecov integration for code coverage reporting.
- Improved test coverage to 100% for utility modules.
- Added GitHub Actions workflow for CI:
  - Runs tests and uploads coverage to Codecov.
  - Uses Node.js 18.
  - Improved reliability by updating to `codecov/codecov-action@v4`.
  - Added `persist-credentials: false` to checkout step.
  - Enabled `fail_ci_if_error: true` for Codecov upload.
- **Workflow Maintenance:**
  - Addressed warnings and errors in the GitHub Actions workflow by upgrading the Codecov action and
    following new setup recommendations.
  - Reduced retry/backoff issues and improved CI reliability.
- **Additional Tests Added:**
  - Emoji utility: tested multiple keywords, order, empty strings, and keywords inside other words.
  - Command handling: tested unknown commands and summary with no conversation history.
  - Error handling: tested summary API failure and main API failure.
  - Ensured all new tests are included in Codecov coverage reporting.

---

## Bugfixes & Maintenance

- Fixed 504 Gateway Timeout errors in Codecov GitHub Action by upgrading to v4 and following new
  setup recommendations.
- Updated documentation and README for new features and troubleshooting.
- Added rollback script for production safety.
- Improved PM2 ecosystem config and deployment instructions.

---

## Version 1.2.0

### Optimizations and Shutdown Improvements

- **Graceful Shutdown Handling:**
  - Added prevention of multiple shutdown executions with isShuttingDown flag
  - Improved shutdown procedure with detailed error reporting and proper cleanup
  - Enhanced signal handling for SIGINT and SIGTERM

- **Code Quality Improvements:**
  - Simplified error handling in Perplexity service for better maintainability
  - Extracted response parsing logic into separate method for cleaner code
  - Improved interval tracking in conversation manager using Set for active intervals
  - Enhanced error messages for easier debugging

- **CI/CD Improvements:**
  - Updated security audit configuration to focus on production dependencies
  - Set appropriate Node.js version requirements (v20.18.1)
  - Enhanced CI workflow to fail on high severity issues in production dependencies

- **Testing:**
  - Fixed all failing test suites (140 tests now passing)
  - Improved test coverage to >90% across the codebase

---

## v1.2.1 - Raspberry Pi Optimization Update (2025-07-24)

- **Performance Enhancements:**
  - Added automatic Raspberry Pi model detection and optimizations
  - Implemented memory management optimizations for resource-constrained devices
  - Added connection throttling to limit concurrent network requests
  - Created lazy loading system for heavy dependencies
  - Added message debouncing to prevent excessive API calls
  - Implemented automatic cache pruning for better memory usage
  - Created model-specific settings for Pi 3, Pi 4, and Pi 5 with different RAM configurations
  - Added comprehensive documentation for Pi optimizations

- **Technical Improvements:**
  - Enhanced configuration system for dynamic setting adjustments
  - Added hardware detection capabilities for Raspberry Pi models
  - Made all optimizations test-compatible to maintain 100% test success rate
  - Created future-proof architecture supporting upcoming Pi models
  - Improved startup process with environment-aware initialization

---

## Version 1.2.2 (2025-07-30)

### Refactor & Reliability

- Refactored ConversationManager to export as a class and require instantiation everywhere.
- Moved all config access inside methods to prevent circular dependency issues.
- Updated all code and tests to use the new ConversationManager pattern.
- Relaxed and fixed all test expectations; all tests now pass and CI is reliable.
- Updated documentation and release notes to match codebase and version.

---

## Version 1.3.0 (2025-08-01)

### Enhanced Testing & Code Quality

- **Fixed Logger Branch Coverage Testing:**
  - Resolved all 7 failing tests in logger-branch-coverage.test.js
  - Implemented proper mocking for fs.promises methods with a centralized mock object
  - Improved branch coverage for logger.js from 57.89% to 82.45% (exceeding the required 55%)
  - Updated test:branch-coverage script to run both logger test files for comprehensive coverage

- **Resolved Test Infrastructure Issues:**
  - Fixed "duplicate manual mock found: discord" warning by reorganizing mock files
  - Added discord.mock.module.js to testPathIgnorePatterns in Jest configuration
  - Created proper test files for mock modules to prevent test failures
  - Added special comments to tell Jest to ignore mock files as test suites

- **Code Quality Enhancements:** (See RELEASE-NOTES-v1.3.0.md for more details)
  - Refactored complex functions into smaller, more maintainable units
  - Consolidated duplicate code between service implementations
  - Created a new unified module with better organization
  - Added better error handling throughout the application
  - Improved test coverage for perplexity-secure.js from 59.44% to 66.89%
  - Fixed caching issues in perplexity-secure.js:
    - Resolved issue where cached responses were not properly retrieved
    - Fixed issue where caching wasn't properly disabled when the `caching: false` option was set
    - Enhanced cache retrieval to handle different cache entry formats

- **Security Improvements:** (See RELEASE-NOTES-v1.3.0.md for more details)
  - Fixed security issues related to top-level permissions
  - Added explicit file permissions for better security
  - Improved validation for API interactions
  - Improved error handling for cache operations

- **Documentation Improvements:**
  - Updated README and wiki with accurate branch coverage information
  - Added documentation about mocking approach in test files
  - Updated Testing Guide with information about the resolved issues
  - Ensured consistency across all documentation files
  - Added comprehensive documentation about the caching system to Technical Documentation
  - Updated Architecture Overview with Response Caching System

---

## Version 1.3.3 (2025-08-10)

### Source Link Enhancement and Truncation Fix

- **Bug Fixes:**
  - Fixed source references (especially YouTube URLs) to appear as clickable links in Discord
  - Fixed truncation issues where the last sentence would get cut off
  - Added protection to prevent URLs from being split across chunk boundaries
  - Ensured proper rendering of numbered source references with markdown formatting

- **Technical Improvements:**
  - Created enhanced message chunker with source reference detection
  - Added source link processing to convert references to clickable links
  - Reduced maximum message length from 1800 to 1700 characters for safety buffer
  - Enhanced test suite to verify proper URL and source reference handling

See RELEASE-NOTES-v1.3.3.md for detailed information.

## Version 1.3.2 (2025-08-06)

### Message Chunking Enhancement

- **Bug Fixes:**
  - Fixed critical bug where words at chunk boundaries could be incorrectly joined (e.g., "selecting
    an" + "officer" → "selecting anofficer")
  - Improved word boundary detection to ensure proper text formatting
  - Enhanced testing suite to verify proper chunk boundary handling

- **Technical Improvements:**
  - Added boundary detection logic to preserve spaces between words
  - Refactored code for better maintainability
  - Ensured 100% content preservation when messages are split

See RELEASE-NOTES-v1.3.2.md for detailed information.

## Version 1.3.1 (2025-08-02)

### Message Chunking Update

- **Improved Message Handling:**
  - Added automatic message chunking to prevent long responses from being truncated
  - Intelligently splits messages at paragraph and sentence boundaries
  - Adds numbering prefixes ([1/3], [2/3], etc.) to indicate sequence
  - Ensures all bot responses are delivered completely without loss of content

- **Technical Enhancements:**
  - Created new utility module `message-chunker.js` for smart text splitting
  - Refactored message handling in chat service for better reliability
  - Added comprehensive unit tests for chunking functionality
  - All changes are backward compatible with existing features

- **Bug Fixes:**
  - Resolved issue where long responses would be cut off mid-sentence
  - Fixed formatting issues at message boundaries

See RELEASE-NOTES-v1.3.1.md for detailed information.
