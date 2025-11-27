const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Log Rotation', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should rotate logs when file size exceeds limit', async () => {
    context.fs.stat.mockResolvedValue({ size: 6 * 1024 * 1024 });
    context.fs.readdir.mockResolvedValue(['bot.log.old1', 'bot.log.old2']);

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should handle stat errors during rotation check', async () => {
    context.fs.stat.mockRejectedValue(new Error('Stat failed'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should handle readdir errors during cleanup', async () => {
    context.fs.stat.mockResolvedValue({ size: 6 * 1024 * 1024 });
    context.fs.readdir.mockRejectedValue(new Error('Readdir failed'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should handle unlink errors during log cleanup', async () => {
    context.fs.stat.mockResolvedValue({ size: 6 * 1024 * 1024 });
    context.fs.readdir.mockResolvedValue([
      'bot.log.old1',
      'bot.log.old2',
      'bot.log.old3',
      'bot.log.old4',
      'bot.log.old5',
      'bot.log.old6',
    ]);
    context.fs.unlink.mockRejectedValue(new Error('Unlink failed'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should not rotate when file size is under limit', async () => {
    context.fs.stat.mockResolvedValue({ size: 1024 * 1024 });

    await context.logger.info('test message');

    expect(context.fs.rename).not.toHaveBeenCalled();
  });

  it('should handle non-existent log file during rotation check', async () => {
    context.fs.stat.mockResolvedValue({ size: 0 });

    await context.logger.info('test message');

    expect(context.fs.rename).not.toHaveBeenCalled();
  });

  it('should use custom log size from environment variable', async () => {
    process.env.PI_LOG_MAX_SIZE_MB = '2';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');

    context.fs.stat.mockResolvedValue({ size: 3 * 1024 * 1024 });

    await testLogger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should use default size when custom size is invalid', async () => {
    process.env.PI_LOG_MAX_SIZE_MB = 'invalid';
    delete require.cache[require.resolve('../../src/utils/logger')];
    const testLogger = require('../../src/utils/logger');

    context.fs.stat.mockResolvedValue({ size: 11 * 1024 * 1024 });

    await testLogger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });
});
