const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Data Logging', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should log data object when provided to info', async () => {
    const data = { key: 'value', number: 123 };

    await context.logger.info('test message', data);

    expect(console.log).toHaveBeenCalledWith(data);
  });

  it('should log data object when provided to warn', async () => {
    const data = { warning: 'data' };

    await context.logger.warn('test message', data);

    expect(console.warn).toHaveBeenCalledWith(data);
  });

  it('should log data object when provided to debug', async () => {
    const data1 = { debug: 'data1' };
    const data2 = { debug: 'data2' };

    await context.logger.debug('test message', data1, data2);

    expect(console.log).toHaveBeenCalledWith(data1);
    expect(console.log).toHaveBeenCalledWith(data2);
  });

  it('should handle null data gracefully', async () => {
    await context.logger.info('test message', null);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should handle undefined data gracefully', async () => {
    await context.logger.info('test message', undefined);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should handle circular reference data gracefully', async () => {
    const circular = {};
    circular.self = circular;

    await context.logger.debug('test message', circular);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] test message'));
    expect(console.log).toHaveBeenCalledWith(expect.objectContaining({ self: expect.anything() }));
  });
});
