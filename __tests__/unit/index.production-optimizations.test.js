const { setupIndexContext } = require('./index.test.setup');

describe('Pi Optimizations in Production', () => {
  let context;

  afterEach(() => {
    if (context) {
      context.resetEnv();
      context.restoreProcess();
    }
  });

  it.skip('should initialize Pi optimizations in production mode', () => {
    context = setupIndexContext();
    expect(context).toBeDefined();
  });
});
