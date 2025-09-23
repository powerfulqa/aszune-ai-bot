# Testing Guide

## Overview

Aszune AI Bot has a comprehensive test suite covering all critical functionality with 82%+ code
coverage. The tests are designed to verify that all components work correctly and handle edge cases
appropriately.

## Test Structure

Tests are organized into:

1. **Unit Tests**: Testing individual components in isolation
2. **Integration Tests**: Testing how components work together
3. **Edge Case Tests**: Testing unusual or error conditions

## Key Test Files

### Core Service Tests

- `__tests__/unit/perplexity-service.test.js`: Tests for the Perplexity API integration
- `__tests__/unit/chat-service.test.js`: Tests for the chat handling logic
- `__tests__/unit/conversation-manager.test.js`: Tests for conversation history management
- `__tests__/unit/message-chunker.test.js`: Tests for message splitting functionality

### Integration Tests

- `__tests__/integration/bot.test.js`: Integration tests for the bot's message handling
- `__tests__/integration/error.test.js`: Tests for error handling scenarios
- `__tests__/unit/index.test.js`: Tests for the main application entry point

### v1.4.0 New Test Suites

- `__tests__/unit/memory-monitor.test.js`: Complete test coverage for memory monitoring and garbage
  collection
- `__tests__/unit/message-chunking/index.test.js`: Enhanced message chunking functionality tests
- `__tests__/unit/message-chunking/chunk-boundary-handler.test.js`: Intelligent chunk boundary
  detection tests
- `__tests__/unit/commands.test.js`: Comprehensive command handling tests (enhanced in v1.4.0)

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage reporting
npm run test:coverage

# Test specific message chunking functionality
cd scripts && node test-chunking.js
# or on Windows
scripts\test-chunking.bat
# or on Unix/Linux
bash scripts/test-chunking.sh
npm run coverage

# Run branch coverage tests
npm run test:branch-coverage

# Run a specific test file
npx jest path/to/test-file.js

# Run tests with verbose output
npx jest --verbose

# Run tests and watch for changes
npx jest --watch
```

## Branch Coverage Testing

The project implements special configurations for testing branch coverage of critical components:

### Branch Coverage Requirements

- Overall branch coverage threshold: 60%
- Current metrics (as of v1.3.0):
  - index.js: 80% branch coverage
  - logger.js: 82.45% branch coverage (combined from both test sets)

> Note: In v1.3.0, we fixed all logger branch coverage tests that were previously failing. Coverage
> improved from 57.89% to 82.45%, exceeding our requirements.

### Branch Coverage Configuration

We use separate Jest configurations for branch coverage testing:

1. **index-branch-coverage.jest.config.js**
   - Tests index.js with **tests**/unit/index-branch-coverage.test.js
   - Focuses on testing conditional branches in the application initialization

2. **logger-branch-coverage.jest.config.js**
   - Tests logger.js with both **tests**/unit/logger.test.js and
     **tests**/unit/logger-branch-coverage.test.js
   - Sets a threshold of 55% branch coverage for logger.js individually
   - logger.test.js alone achieves 57.89% branch coverage
   - Combined with logger-branch-coverage.test.js, achieves approximately 80% branch coverage

### Running Branch Coverage Tests

```bash
# Run all branch coverage tests
npm run test:branch-coverage

# Run index.js branch coverage only
npx jest --config=index-branch-coverage.jest.config.js __tests__/unit/index-branch-coverage.test.js

# Run logger.js branch coverage only (both test files)
npx jest --config=logger-branch-coverage.jest.config.js "__tests__/unit/logger*.test.js"

# Run just the standard logger tests
npx jest --config=logger-branch-coverage.jest.config.js __tests__/unit/logger.test.js

# Run just the specialized branch coverage tests
npx jest --config=logger-branch-coverage.jest.config.js __tests__/unit/logger-branch-coverage.test.js
```

> Note: All tests in logger-branch-coverage.test.js now pass as of v1.3.0, and we're using both sets
> of tests to achieve higher branch coverage (82.45%).

## Recent Test Improvements (v1.3.0)

The test suite was significantly enhanced in v1.3.0 with several improvements:

1. **Fixed Error Handling in Perplexity Service**: Standardized error messages for API failures
2. **Improved Singleton Pattern**: Ensured consistent usage of the singleton pattern in services
3. **Enhanced Resource Management**: Properly cleaned up timers in test environments
4. **Fixed Promise Rejection Handling**: Improved handling of unhandled promise rejections in tests
5. **Implemented Branch Coverage Testing**: Added specialized tests and configurations for branch
   coverage
6. **Focused Coverage Reporting**: Created separate Jest configurations for testing specific
   components
7. **Resolved Circular Dependencies**: Improved module mocking to avoid circular dependencies
8. **Simplified Command Data Format**: Removed SlashCommandBuilder dependency for more reliable
   tests
9. **Enhanced Mock Implementations**: Updated mock implementations for Discord client and
   conversation manager
10. **Added Test Exclusion Patterns**: Properly configured test path ignore patterns for utility
    files
11. **Improved Error Handling Tests**: Added missing test cases for error scenarios during bot
    shutdown
12. **Improved Mock Configuration**: Added comprehensive mocks for configuration and external
    services
13. **Fixed Logger Branch Coverage Tests (v1.3.0)**: Resolved all failing tests in
    logger-branch-coverage.test.js
14. **Improved fs.promises Mocking (v1.3.0)**: Created centralized mock object for file system
    operations
15. **Resolved Duplicate Mock Warnings (v1.3.0)**: Fixed the "duplicate manual mock found: discord"
    warning by reorganizing mock files
16. **Enhanced Jest Configuration (v1.3.0)**: Added proper test path ignore patterns for mock files
17. **Mock File Organization (v1.3.0)**: Created proper test files for mock modules to prevent test
    failures
18. **Improved File Structure (v1.3.0)**: Added special comments to mock files to tell Jest to
    ignore them as test suites

## Writing New Tests

When adding new features, please follow these guidelines for creating tests:

1. **Test both success and failure paths**
2. **Mock external dependencies**
3. **Use descriptive test names**
4. **Keep tests independent**
5. **Clean up resources after tests**

## CI/CD Integration

Tests are automatically run as part of the CI/CD pipeline. The workflow:

1. Runs all tests with coverage reporting
2. Uploads coverage data to Codecov and QLTY
3. Fails the build if any tests fail

Test reports can be viewed on the GitHub Actions page for each build.

## Mocking Improvements in v1.3.0

Version 1.3.0 significantly improved how mocks are handled:

1. **Reorganized Mock Files**: Renamed and restructured mock files to prevent duplicate mock
   warnings
   - `discord.js` was renamed to `discord.mock.module.js`
   - Added proper test files for each mock to ensure they work correctly

2. **Centralized fs.promises Mocking**: Created a unified approach to mocking file system operations
   - Consolidated mocking patterns for consistent test behavior
   - Fixed inconsistent mocking that was causing test failures

3. **Jest Configuration Updates**:
   - Added `discord.mock.module.js` to `testPathIgnorePatterns` in Jest configuration
   - Added special comments to mock files to prevent Jest from treating them as test suites
   - Updated test scripts to run both logger test files for comprehensive coverage

These changes have eliminated warnings and test failures related to mocking, making the test suite
more reliable.
