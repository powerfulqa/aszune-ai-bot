const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('File Write Error Handling', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
    jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should handle file write errors gracefully', async () => {
    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith('[2026-11-16T12:00:00.000Z] [INFO] test message');
  });

  it('should continue logging to console when file write fails', async () => {
    context.fs.appendFile.mockRejectedValue(new Error('Write failed'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith('[2026-11-16T12:00:00.000Z] [INFO] test message');
  });

  it('should handle directory creation failure', async () => {
    context.fs.mkdir.mockRejectedValue(new Error('Permission denied'));

    await context.logger.info('test message');

    expect(console.log).toHaveBeenCalledWith('[2026-11-16T12:00:00.000Z] [INFO] test message');
  });
});
