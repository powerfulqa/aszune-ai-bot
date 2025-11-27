const { setupIndexContext } = require('./index.test.setup');

describe('Reminder Service Initialization', () => {
  let context;

  afterEach(() => {
    if (context) {
      context.resetEnv();
      context.restoreProcess();
    }
  });

  it('skips reminder initialization in unit tests', async () => {
    context = setupIndexContext();

    expect(context.conversationManager.destroy).toBeDefined();
    // Actual reminder logic is covered in reminder-service.* suites
  });
});
