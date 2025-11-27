const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Log Level Filtering', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
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

    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('should handle invalid log level gracefully', () => {
    process.env.PI_LOG_LEVEL = 'INVALID_LEVEL';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');

    testLogger.debug('debug message');
    testLogger.info('info message');

    expect(console.log).toHaveBeenCalledTimes(1);
  });
});
