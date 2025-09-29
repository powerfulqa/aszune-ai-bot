/**
 * Logger Critical Coverage Tests - Log Level Filtering
 */

const fs = require('fs').promises;

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    stat: jest.fn(),
    appendFile: jest.fn(),
    rename: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock config
jest.mock('../../src/config/config', () => ({
  LOGGING: {
    DEFAULT_MAX_SIZE_MB: 10,
    MAX_LOG_FILES: 5
  }
}));

describe('Logger - Log Level Filtering', () => {
  let originalEnv;
  let originalConsole;

  const setupTestEnvironment = () => {
    originalEnv = { ...process.env };
    originalConsole = { ...console };
    
    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  };

  const setupFsMocks = () => {
    fs.mkdir.mockResolvedValue();
    fs.stat.mockResolvedValue({ size: 1000000 });
    fs.appendFile.mockResolvedValue();
    fs.rename.mockResolvedValue();
    fs.readdir.mockResolvedValue(['bot.log.2023-01-01', 'bot.log.2023-01-02']);
    fs.unlink.mockResolvedValue();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupTestEnvironment();
    setupFsMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.assign(console, originalConsole);
  });

  it('should skip debug logs when log level is INFO', () => {
    process.env.PI_LOG_LEVEL = 'INFO';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');
    
    testLogger.debug('debug message');
    
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should skip info logs when log level is WARN', () => {
    process.env.PI_LOG_LEVEL = 'WARN';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');
    
    testLogger.info('info message');
    
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should skip warn logs when log level is ERROR', () => {
    process.env.PI_LOG_LEVEL = 'ERROR';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');
    
    testLogger.warn('warn message');
    
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should process all log levels when set to DEBUG', () => {
    process.env.PI_LOG_LEVEL = 'DEBUG';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');
    
    testLogger.debug('debug message');
    testLogger.info('info message');
    testLogger.warn('warn message');
    testLogger.error('error message');
    
    expect(console.log).toHaveBeenCalledTimes(2); // debug and info
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('should handle invalid log level gracefully', () => {
    process.env.PI_LOG_LEVEL = 'INVALID_LEVEL';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');
    
    // Should default to INFO level
    testLogger.debug('debug message');
    testLogger.info('info message');
    
    expect(console.log).toHaveBeenCalledTimes(1); // Only info should show
  });
});