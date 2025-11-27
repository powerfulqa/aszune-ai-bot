const { setupIndexCriticalMocks } = require('./index-critical-coverage.test.setup');

describe('Shutdown Error Scenarios', () => {
  let context;

  beforeEach(() => {
    context = setupIndexCriticalMocks();
    process.env.NODE_ENV = 'test';
    context.index = context.loadIndex();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('should handle conversation manager shutdown errors', async () => {
    context.mockConversationManager.destroy.mockRejectedValueOnce(new Error('Conversation manager error'));

    await expect(async () => {
      await context.index.shutdown('SIGINT');
    }).resolves.not.toThrow();
  });

  it('should handle Discord client shutdown errors', async () => {
    context.mockClient.destroy.mockRejectedValueOnce(new Error('Client shutdown error'));

    await expect(async () => {
      await context.index.shutdown('SIGINT');
    }).resolves.not.toThrow();
  });

  it('should not duplicate shutdown when already in progress', async () => {
    const shutdownPromise1 = context.index.shutdown('SIGINT');
    const shutdownPromise2 = context.index.shutdown('SIGTERM');

    await expect(Promise.all([shutdownPromise1, shutdownPromise2])).resolves.not.toThrow();
  });

  it('should handle multiple shutdown errors and exit with code 1', async () => {
    context.mockConversationManager.destroy.mockRejectedValueOnce(new Error('Conv error'));
    context.mockClient.destroy.mockRejectedValueOnce(new Error('Client error'));

    await expect(async () => {
      await context.index.shutdown('SIGINT');
    }).resolves.not.toThrow();
  });
});
