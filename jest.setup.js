/**
 * Jest setup file - runs before tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = 'test-key';
process.env.DISCORD_BOT_TOKEN = 'test-token';

// Mock process.exit to prevent test termination
jest.spyOn(process, 'exit').mockImplementation((code) => {
  // In test environment, just log the exit code instead of actually exiting
  console.log(`process.exit(${code}) called in test environment - ignoring`);
  // Don't throw an error, just return undefined to prevent actual exit
  return undefined;
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
