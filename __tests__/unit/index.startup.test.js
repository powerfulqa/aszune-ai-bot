const { setupIndexContext } = require('./index.test.setup');

describe('Bot Main Entry Point Initialization', () => {
  let context;

  beforeEach(() => {
    context = setupIndexContext();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('should create a Discord client and log in', async () => {
    // Startup is a promise chain with no timers: flush it without a real wait.
    jest.useFakeTimers();
    await jest.advanceTimersByTimeAsync(0);
    expect(context.mockClient.login).toHaveBeenCalledWith('test-token');
  });
});
