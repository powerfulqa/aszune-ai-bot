const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('File Write Error Handling', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should handle file write errors gracefully', async () => {
    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should continue logging to console when file write fails', async () => {
    context.fs.appendFile.mockRejectedValue(new Error('Write failed'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });

  it('should handle directory creation failure', async () => {
    context.fs.mkdir.mockRejectedValue(new Error('Permission denied'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] test message'));
  });
});
