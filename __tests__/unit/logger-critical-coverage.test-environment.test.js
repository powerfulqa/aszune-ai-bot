const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Test Environment Handling', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should not write to file in test environment', async () => {
    process.env.NODE_ENV = 'test';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');

    await testLogger.info('test message');

    expect(context.fs.appendFile).not.toHaveBeenCalled();
  });

  it('should not create directory in test environment', () => {
    process.env.NODE_ENV = 'test';
    delete require.cache[require.resolve('../../src/utils/logger')];
    require('../../src/utils/logger');

    expect(context.fs.mkdir).not.toHaveBeenCalled();
  });
});
