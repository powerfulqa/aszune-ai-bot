const { prepareLoggerTest } = require('./logger-critical-coverage.test.setup');

describe('Error Method Context', () => {
  let context;

  beforeEach(() => {
    context = prepareLoggerTest();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreConsole();
  });

  it('should handle error method with request details', async () => {
    const mockError = {
      response: {
        status: 500,
        data: { error: 'Server error' },
      },
    };

    await context.logger.error('API call failed', mockError);

    expect(console.error).toHaveBeenCalledWith(
      'API Error Response:',
      expect.objectContaining({
        type: 'API Error Response',
        status: 500,
        data: { error: 'Server error' },
      })
    );
  });

  it('should handle errors without response', async () => {
    const mockError = {
      request: { url: '/api/test' },
    };

    await context.logger.error('API call failed', mockError);

    expect(console.error).toHaveBeenCalledWith('No response received from API:', mockError.request);
  });

  it('should handle errors without stack trace', async () => {
    const mockError = {
      message: 'Simple error',
    };

    await context.logger.error('Operation failed', mockError);

    expect(console.error).toHaveBeenCalledWith('Error:', 'Simple error');
  });

  it('should handle simple data objects as errors', async () => {
    const dataError = { code: 'ERROR_CODE', details: 'Something went wrong' };

    await context.logger.error('Data error', dataError);

    expect(console.error).toHaveBeenCalledWith(dataError);
  });

  it('should handle general errors with stack traces', async () => {
    const error = new Error('Test error');

    await context.logger.error('General error', error);

    expect(console.error).toHaveBeenCalledWith('Error:', 'Test error');
    expect(console.error).toHaveBeenCalledWith('Stack:', error.stack);
  });
});
