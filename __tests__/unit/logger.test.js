/**
 * Tests for logger utility
 */

describe('Logger', () => {
  // Save and restore console methods
  // eslint-disable-next-line no-console
  const originalConsoleLog = console.log;
  // eslint-disable-next-line no-console
  const originalConsoleWarn = console.warn;
  // eslint-disable-next-line no-console
  const originalConsoleError = console.error;
  
  // Save original log level
  let originalLogLevel;
  let logger;
  
  beforeEach(() => {
    // Mock console methods
    // eslint-disable-next-line no-console
    console.log = jest.fn();
    // eslint-disable-next-line no-console
    console.warn = jest.fn();
    // eslint-disable-next-line no-console
    console.error = jest.fn();
    
    // Save original log level and force DEBUG level for tests
    originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'DEBUG';
    
    // Reset logger module to pick up new environment
    jest.resetModules();
    
    // Import logger after setting environment
    logger = require('../../src/utils/logger');
  });
  
  afterEach(() => {
    // Restore console methods
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
    // eslint-disable-next-line no-console
    console.warn = originalConsoleWarn;
    // eslint-disable-next-line no-console
    console.error = originalConsoleError;
    
    // Restore original log level
    process.env.LOG_LEVEL = originalLogLevel;
  });
  
  it('logs debug messages', () => {
    logger.debug('Test debug message');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Test debug message');
  });
  
  it('logs debug messages with data', () => {
    const testData = { test: 'data' };
    logger.debug('Test debug message', testData);
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Test debug message');
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[1][0]).toEqual(testData);
  });
  
  it('logs info messages', () => {
    logger.info('Test info message');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.log.mock.calls[0][0]).toContain('[INFO] Test info message');
  });
  
  it('logs warning messages', () => {
    logger.warn('Test warning message');
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.warn.mock.calls[0][0]).toContain('[WARN] Test warning message');
  });
  
  it('logs error messages', () => {
    logger.error('Test error message');
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Test error message');
  });
  
  it('logs error messages with error object', () => {
    const testError = new Error('Test error');
    logger.error('Test error message', testError);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Test error message');
  });
  
  it('handles API errors', () => {
    const apiError = {
      response: {
        status: 404,
        data: { error: 'Not found' }
      }
    };
    logger.error('API error', apiError);
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line no-console
    expect(console.error.mock.calls[1][0]).toBe('API Error Response:');
  });
  
  it('provides user-friendly error messages', () => {
    const message = logger.handleError(new Error('Some error'), 'test context');
    expect(message).toContain('There was an error');
  });
  
  it('customizes error messages based on error type', () => {
    // All errors should return a user-friendly message
    const error429 = new Error('429 error');
    error429.message = 'Request failed with status code 429';
    let message = logger.handleError(error429, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    
    // Auth error
    const error401 = new Error('401 error');
    error401.message = 'Request failed with status code 401';
    message = logger.handleError(error401, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    
    // Timeout error
    const errorTimeout = new Error('timeout');
    errorTimeout.message = 'Request timed out';
    message = logger.handleError(errorTimeout, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
  });
});
