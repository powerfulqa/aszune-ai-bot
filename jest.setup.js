/**
 * Jest setup file - runs before tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = 'test-key';
process.env.DISCORD_BOT_TOKEN = 'test-token';

// Baseline env values to restore after each test
const BASE_TEST_ENV = {
  NODE_ENV: 'test',
  PERPLEXITY_API_KEY: 'test-key',
  DISCORD_BOT_TOKEN: 'test-token',
};

// Silence console output during tests to reduce CI noise
// Tests that intentionally trigger errors will still pass, just without console spam
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Only silence in CI or when explicitly requested
if (process.env.CI || process.env.SILENCE_CONSOLE) {
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

// Expose original console for tests that need to verify console output
global.originalConsole = originalConsole;

// Mock Web APIs required by undici
global.File = class File extends Blob {
  constructor(fileBits, fileName, options = {}) {
    super(fileBits, options);
    this.name = fileName;
    this.lastModified = options.lastModified || Date.now();
  }
};

// Mock process.exit to prevent test termination
jest.spyOn(process, 'exit').mockImplementation((code) => {
  // In test environment, just log the exit code instead of actually exiting
  // Don't throw an error, just return undefined to prevent actual exit
  return undefined;
});

// Reset modules between tests
beforeEach(() => {
  jest.resetModules();
});

// Restore env/timers so tests can't leak state into subsequent suites
afterEach(() => {
  process.env.NODE_ENV = BASE_TEST_ENV.NODE_ENV;
  process.env.PERPLEXITY_API_KEY = BASE_TEST_ENV.PERPLEXITY_API_KEY;
  process.env.DISCORD_BOT_TOKEN = BASE_TEST_ENV.DISCORD_BOT_TOKEN;

  // Ensure no test leaves fake timers enabled
  try {
    jest.useRealTimers();
  } catch {
    // Ignore if timers weren't mocked
  }
});

// Clean up after all tests - disabled due to hanging issues
// afterAll(async () => {
//   jest.restoreAllMocks();
// }, 2000);

// Global test timeouts
jest.setTimeout(10000);
