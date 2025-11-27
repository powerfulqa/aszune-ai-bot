const { setupIndexCriticalMocks } = require('./index-critical-coverage.test.setup');

describe('Login Error Handling', () => {
  let context;

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('should handle Discord login failures in production', () => {
    context = setupIndexCriticalMocks();
    process.env.NODE_ENV = 'production';
    context.mockClient.login.mockRejectedValueOnce(new Error('Login failed'));

    context.index = context.loadIndex();

    // Production login failures are expected to trigger shutdown flow before exit
  });

  it('should handle Discord login failures in test mode', () => {
    context = setupIndexCriticalMocks();
    process.env.NODE_ENV = 'test';
    context.mockClient.login.mockRejectedValueOnce(new Error('Login failed'));

    expect(() => {
      context.index = context.loadIndex();
    }).not.toThrow();
  });
});
