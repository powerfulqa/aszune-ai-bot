# Testing Guide

## Overview

Aszune AI Bot has a comprehensive test suite with 140 tests covering all critical functionality with over 90% code coverage. The tests are designed to verify that all components work correctly and handle edge cases appropriately.

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
npm run test:coverage

# Run a specific test file
npx jest path/to/test-file.js

# Run tests with verbose output
npx jest --verbose

# Run tests and watch for changes
npx jest --watch
```

## Recent Test Improvements

The test suite was recently enhanced with several improvements:

1. **Fixed Error Handling in Perplexity Service**: Standardized error messages for API failures
2. **Improved Singleton Pattern**: Ensured consistent usage of the singleton pattern in services
3. **Enhanced Resource Management**: Properly cleaned up timers in test environments
4. **Fixed Promise Rejection Handling**: Improved handling of unhandled promise rejections in tests
5. **Resolved Circular Dependencies**: Improved module mocking to avoid circular dependencies
6. **Simplified Command Data Format**: Removed SlashCommandBuilder dependency for more reliable tests
7. **Enhanced Mock Implementations**: Updated mock implementations for Discord client and conversation manager
8. **Added Test Exclusion Patterns**: Properly configured test path ignore patterns for utility files
9. **Improved Error Handling Tests**: Added missing test cases for error scenarios during bot shutdown
5. **Improved Mock Configuration**: Added comprehensive mocks for configuration and external services

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
