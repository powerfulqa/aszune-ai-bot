/**
 * Jest setup file - runs before tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = 'test-key';
process.env.DISCORD_BOT_TOKEN = 'test-token';

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Reset modules between tests
beforeEach(() => {
  jest.resetModules();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Global test timeouts
jest.setTimeout(10000);

// Create output directory for JUnit test results
const fs = require('fs');
const path = require('path');

// Define JUnit output directory
const junitOutputDir = process.env.JEST_JUNIT_OUTPUT_DIR || './test-results';

// Create the directory if it doesn't exist
try {
  if (!fs.existsSync(junitOutputDir)) {
    fs.mkdirSync(junitOutputDir, { recursive: true });
    console.log(`Created JUnit output directory: ${junitOutputDir}`);
  }
} catch (error) {
  console.error(`Error creating JUnit output directory: ${error.message}`);
}
