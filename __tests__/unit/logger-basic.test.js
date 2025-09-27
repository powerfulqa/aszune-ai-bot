/**
 * Tests for logger utility - Basic functionality
 */
const logger = require('../../src/utils/logger');

describe('Logger - Basic', () => {
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

  it('logs error messages with data', () => {
    const testData = { error: 'data' };
    logger.error('Test error message', testData);
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error.mock.calls[0][0]).toContain('[ERROR] Test error message');
    expect(console.error.mock.calls[1][0]).toEqual(testData);
  });

  it('handles empty messages', () => {
    logger.debug('');
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
  });

  it('handles null messages', () => {
    logger.debug(null);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
  });

  it('handles undefined messages', () => {
    logger.debug(undefined);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
  });

  it('handles messages with special characters', () => {
    logger.debug('Message with !@#$%^&*()_+-=[]{}|;:,.<>?');
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain(
      '[DEBUG] Message with !@#$%^&*()_+-=[]{}|;:,.<>?'
    );
  });

  it('handles messages with unicode characters', () => {
    logger.debug('Message with 世界 🌍');
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Message with 世界 🌍');
  });
});
