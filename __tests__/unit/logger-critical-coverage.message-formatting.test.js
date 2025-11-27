const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Message Formatting Edge Cases', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should handle very long messages', async () => {
    const longMessage = 'a'.repeat(10000);

    await context.logger.info(longMessage);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(longMessage));
  });

  it('should handle messages with special characters', async () => {
    const specialMessage = 'Message with 🚀 emoji and \n newlines \t tabs';

    await context.logger.info(specialMessage);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(specialMessage));
  });

  it('should handle empty string messages', async () => {
    await context.logger.info('');

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] /)
    );
  });

  it('should handle numeric messages', async () => {
    await context.logger.info(12345);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('12345'));
  });
});
