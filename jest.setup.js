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
