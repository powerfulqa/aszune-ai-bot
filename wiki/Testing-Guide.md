# Testing Guide

## Overview

Aszune AI Bot has a comprehensive test suite covering all critical functionality with over 90% code coverage. The tests are designed to verify that all components work correctly and handle edge cases appropriately.

## Test Structure

Tests are organized into:

1. **Unit Tests**: Testing individual components in isolation
2. **Integration Tests**: Testing how components work together
3. **Edge Case Tests**: Testing unusual or error conditions

## Key Test Files

- `__tests__/unit/perplexity-service.test.js`: Tests for the Perplexity API integration
- `__tests__/unit/chat-service.test.js`: Tests for the chat handling logic
- `__tests__/unit/conversation-manager.test.js`: Tests for conversation history management
- `__tests__/integration/bot.test.js`: Integration tests for the bot's message handling
- `__tests__/integration/error.test.js`: Tests for error handling scenarios
- `__tests__/unit/index.test.js`: Tests for the main application entry point

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage reporting
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
- Current metrics:
  - index.js: 80% branch coverage
  - logger.js: 57.89% branch coverage (with logger.test.js only)
  - logger.js: ~80% branch coverage (with both logger.test.js and logger-branch-coverage.test.js)

> Note: We now use both sets of tests in the branch coverage testing to achieve higher coverage.

### Branch Coverage Configuration

We use separate Jest configurations for branch coverage testing:

1. **index-branch-coverage.jest.config.js**
   - Tests index.js with __tests__/unit/index-branch-coverage.test.js
   - Focuses on testing conditional branches in the application initialization

2. **logger-branch-coverage.jest.config.js**
   - Tests logger.js with both __tests__/unit/logger.test.js and __tests__/unit/logger-branch-coverage.test.js
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

> Note: All tests in logger-branch-coverage.test.js now pass, and we're using both sets of tests to achieve higher branch coverage (82.45%).

## Recent Test Improvements

The test suite was recently enhanced with several improvements:

1. **Fixed Error Handling in Perplexity Service**: Standardized error messages for API failures
2. **Improved Singleton Pattern**: Ensured consistent usage of the singleton pattern in services
3. **Enhanced Resource Management**: Properly cleaned up timers in test environments
4. **Fixed Promise Rejection Handling**: Improved handling of unhandled promise rejections in tests
5. **Implemented Branch Coverage Testing**: Added specialized tests and configurations for branch coverage
6. **Focused Coverage Reporting**: Created separate Jest configurations for testing specific components
7. **Resolved Circular Dependencies**: Improved module mocking to avoid circular dependencies
8. **Simplified Command Data Format**: Removed SlashCommandBuilder dependency for more reliable tests
9. **Enhanced Mock Implementations**: Updated mock implementations for Discord client and conversation manager
10. **Added Test Exclusion Patterns**: Properly configured test path ignore patterns for utility files
11. **Improved Error Handling Tests**: Added missing test cases for error scenarios during bot shutdown
12. **Improved Mock Configuration**: Added comprehensive mocks for configuration and external services
13. **Fixed Logger Branch Coverage Tests**: Resolved all failing tests in logger-branch-coverage.test.js
14. **Improved fs.promises Mocking**: Created centralized mock object for file system operations
15. **Resolved Duplicate Mock Warnings**: Fixed the "duplicate manual mock found: discord" warning
16. **Enhanced Jest Configuration**: Added proper test path ignore patterns for mock files

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
