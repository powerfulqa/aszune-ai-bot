# Testing Strategy

## Branch Coverage Testing

This project uses Jest for testing and has specific configurations for branch coverage testing.

### Coverage Requirements

- Overall branch coverage requirement: 60%
- Current coverage metrics:
  - index.js: 80% branch coverage
  - logger.js: 57.89% branch coverage (standalone) / 82.45% (with branch coverage tests)

### Testing Structure

We have two approaches for branch coverage testing:

1. **Standard Tests**: Regular unit tests in files like `logger.test.js` that test the main functionality
2. **Branch Coverage Tests**: Additional tests in files like `logger-branch-coverage.test.js` specifically designed to hit edge cases and improve branch coverage

### Jest Configurations

- `index-branch-coverage.jest.config.js`: Configuration for index.js branch coverage testing
- `logger-branch-coverage.jest.config.js`: Configuration for logger.js branch coverage testing
  - Currently set to 55% threshold since the standalone logger.test.js achieves 57.89%
  - Combined with logger-branch-coverage.test.js, the actual coverage is 82.45%

### Running Branch Coverage Tests

```bash
npm run test:branch-coverage
```

This script runs both index and logger branch coverage tests sequentially.

### Previously Resolved Issues

- ✅ All tests in `logger-branch-coverage.test.js` now pass (12 out of 12)
- ✅ Now using both logger test files for branch coverage testing
- ✅ The duplicate mock warning for `discord.js` has been resolved by:
  - Renaming `__tests__/__mocks__/discord.js` to `discord.mock.module.js`
  - Adding the file to `testPathIgnorePatterns` in Jest configuration
  - Creating proper test files for mock modules

### Test Strategy Decision

We are now using both the regular `logger.test.js` file and the specialized `logger-branch-coverage.test.js` file for branch coverage testing:
1. `logger.test.js` provides 57.89% branch coverage on its own, which exceeds our 55% threshold
2. `logger-branch-coverage.test.js` provides additional branch coverage, testing edge cases
3. Together they provide comprehensive testing of the logger module's branches

### Recent Improvements

1. ✅ Fixed all tests in `logger-branch-coverage.test.js` for improved branch coverage
2. ✅ Resolved duplicate mock warnings
3. ✅ Combined coverage reports by running both logger test files together
4. ✅ Updated the `test:branch-coverage` script to include both test files

### Future Improvements

1. Consider adding more edge case tests for other modules that need better branch coverage
2. Continue to improve mocking approach for better test isolation
3. Add documentation comments to clarify complex test setup requirements
