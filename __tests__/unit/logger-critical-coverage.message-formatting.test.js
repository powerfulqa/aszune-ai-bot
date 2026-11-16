const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Message Formatting Edge Cases', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
    jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should handle very long messages', async () => {
    const longMessage = 'a'.repeat(10000);

    await context.logger.info(longMessage);

    expect(console.log).toHaveBeenCalledWith(`[2026-11-16T12:00:00.000Z] [INFO] ${longMessage}`);
  });

  it('should handle messages with special characters', async () => {
    const specialMessage = 'Message with 🚀 emoji and \n newlines \t tabs';

    await context.logger.info(specialMessage);

    expect(console.log).toHaveBeenCalledWith(`[2026-11-16T12:00:00.000Z] [INFO] ${specialMessage}`);
  });

  it('should handle empty string messages', async () => {
    await context.logger.info('');

    expect(console.log).toHaveBeenCalledWith('[2026-11-16T12:00:00.000Z] [INFO] ');
  });

  it('should handle numeric messages', async () => {
    await context.logger.info(12345);

    expect(console.log).toHaveBeenCalledWith('[2026-11-16T12:00:00.000Z] [INFO] 12345');
  });
});
