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
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(context.mockClient.login).toHaveBeenCalledWith('test-token');
  });
});
