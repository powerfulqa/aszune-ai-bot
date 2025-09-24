/**
 * Tests for logger utility - Advanced functionality
 */
const logger = require('../../src/utils/logger');

describe('Logger - Advanced', () => {
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

  it('respects log level filtering', () => {
    process.env.PI_LOG_LEVEL = 'INFO';
    
    logger.debug('This should not be logged');
    logger.info('This should be logged');
    logger.warn('This should be logged');
    logger.error('This should be logged');
    
    expect(console.log).toHaveBeenCalledTimes(2); // info and debug (if debug is enabled)
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('handles log level ERROR only', () => {
    process.env.PI_LOG_LEVEL = 'ERROR';
    
    logger.debug('This should not be logged');
    logger.info('This should not be logged');
    logger.warn('This should not be logged');
    logger.error('This should be logged');
    
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('handles log level WARN and above', () => {
    process.env.PI_LOG_LEVEL = 'WARN';
    
    logger.debug('This should not be logged');
    logger.info('This should not be logged');
    logger.warn('This should be logged');
    logger.error('This should be logged');
    
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('handles log level INFO and above', () => {
    process.env.PI_LOG_LEVEL = 'INFO';
    
    logger.debug('This should not be logged');
    logger.info('This should be logged');
    logger.warn('This should be logged');
    logger.error('This should be logged');
    
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('handles log level DEBUG (all messages)', () => {
    process.env.PI_LOG_LEVEL = 'DEBUG';
    
    logger.debug('This should be logged');
    logger.info('This should be logged');
    logger.warn('This should be logged');
    logger.error('This should be logged');
    
    expect(console.log).toHaveBeenCalledTimes(2); // debug and info
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('handles invalid log level gracefully', () => {
    process.env.PI_LOG_LEVEL = 'INVALID';
    
    logger.debug('This should be logged');
    logger.info('This should be logged');
    logger.warn('This should be logged');
    logger.error('This should be logged');
    
    // Should default to DEBUG level
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('handles complex data objects', () => {
    const complexData = {
      nested: {
        object: {
          with: {
            arrays: [1, 2, 3],
            strings: 'test',
            numbers: 42,
            booleans: true,
            nulls: null,
            undefined: undefined
          }
        }
      }
    };
    
    logger.debug('Complex data test', complexData);
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log.mock.calls[1][0]).toEqual(complexData);
  });

  it('handles circular references in data', () => {
    const circularData = { name: 'test' };
    circularData.self = circularData;
    
    logger.debug('Circular data test', circularData);
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log.mock.calls[1][0]).toEqual(circularData);
  });

  it('handles very long messages', () => {
    const longMessage = 'A'.repeat(10000);
    logger.debug(longMessage);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
    expect(console.log.mock.calls[0][0]).toContain(longMessage);
  });

  it('handles messages with newlines', () => {
    const multilineMessage = 'Line 1\nLine 2\nLine 3';
    logger.debug(multilineMessage);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Line 1\nLine 2\nLine 3');
  });

  it('handles messages with tabs', () => {
    const tabMessage = 'Text\twith\ttabs';
    logger.debug(tabMessage);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Text\twith\ttabs');
  });

  it('handles messages with carriage returns', () => {
    const crMessage = 'Text\rwith\rcarriage\rreturns';
    logger.debug(crMessage);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG] Text\rwith\rcarriage\rreturns');
  });

  it('handles multiple data arguments', () => {
    const data1 = { test: 'data1' };
    const data2 = { test: 'data2' };
    const data3 = { test: 'data3' };
    
    logger.debug('Multiple data test', data1, data2, data3);
    expect(console.log).toHaveBeenCalledTimes(4); // message + 3 data objects
    expect(console.log.mock.calls[1][0]).toEqual(data1);
    expect(console.log.mock.calls[2][0]).toEqual(data2);
    expect(console.log.mock.calls[3][0]).toEqual(data3);
  });
});
