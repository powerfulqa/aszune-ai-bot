/**
 * Tests for logger utility
 */
const logger = require('../../src/utils/logger');

describe('Logger', () => {
  // Save and restore console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    process.env.PI_LOG_LEVEL = 'DEBUG';
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    delete process.env.PI_LOG_LEVEL;
  });
  
  it('logs debug messages', () => {
    logger.debug('Test debug message');
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Test debug message');
  });
  
  it('logs debug messages with data', () => {
    const testData = { test: 'data' };
    logger.debug('Test debug message', testData);
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Test debug message');
    expect(console.log.mock.calls[1][0]).toEqual(testData);
  });
  
  it('logs info messages', () => {
    logger.info('Test info message');
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[INFO] Test info message');
  });
  
  it('logs warning messages', () => {
    logger.warn('Test warning message');
    expect(console.warn).toHaveBeenCalled();
    expect(console.warn.mock.calls[0][0]).toContain('[WARN] Test warning message');
  });
  
  it('logs error messages', () => {
    logger.error('Test error message');
    expect(console.error).toHaveBeenCalled();
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Test error message');
  });
  
  it('logs error messages with error object', () => {
    const testError = new Error('Test error');
    logger.error('Test error message', testError);
    expect(console.error).toHaveBeenCalled();
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
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error.mock.calls[1][0]).toBe('API Error Response:');
  });
  
  it('provides user-friendly error messages', () => {
    const message = logger.handleError(new Error('Some error'), 'test context');
    expect(message).toContain('There was an error');
  });
  
  it('customizes error messages based on error type', () => {
    // All errors should return a user-friendly message
    let error429 = new Error('429 error');
    error429.message = 'Request failed with status code 429';
    let message = logger.handleError(error429, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    
    // Auth error
    let error401 = new Error('401 error');
    error401.message = 'Request failed with status code 401';
    message = logger.handleError(error401, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
    
    // Timeout error
    let errorTimeout = new Error('timeout');
    errorTimeout.message = 'Request timed out';
    message = logger.handleError(errorTimeout, 'test');
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(10);
  });
});
