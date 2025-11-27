const { setupIndexContext, mockConfigData, loggerMock } = require('./index.test.setup');

describe('Boot Optimizations', () => {
  let context;

  afterEach(() => {
    if (context) {
      context.resetEnv();
      context.restoreProcess();
      context.resetConfig();
    }
  });

  it('does not call initializePiOptimizations when ready handler fires', async () => {
    mockConfigData.PI_OPTIMIZATIONS = { ENABLED: true };
    mockConfigData.CACHE = {
      CLEANUP_INTERVAL_MS: 300000,
      CLEANUP_INTERVAL_DAYS: 1,
      MAX_AGE_DAYS: 7,
    };
    mockConfigData.initializePiOptimizations = jest.fn().mockResolvedValue();

    context = setupIndexContext();

    const readyHandler = context.getReadyHandler();
    if (readyHandler) {
      await readyHandler();
    }

    expect(mockConfigData.initializePiOptimizations).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalledWith(
      'Initializing Raspberry Pi optimizations...'
    );
    expect(loggerMock.info).not.toHaveBeenCalledWith('Pi optimizations initialized successfully');
  });

  it('skips logging when Pi init throws during ready handler', async () => {
    mockConfigData.PI_OPTIMIZATIONS = { ENABLED: true };
    mockConfigData.CACHE = {
      CLEANUP_INTERVAL_MS: 300000,
      CLEANUP_INTERVAL_DAYS: 1,
      MAX_AGE_DAYS: 7,
    };
    mockConfigData.initializePiOptimizations = jest
      .fn()
      .mockRejectedValue(new Error('Pi init failed'));

    context = setupIndexContext();

    const readyHandler = context.getReadyHandler();
    if (readyHandler) {
      await readyHandler();
    }

    expect(loggerMock.error).not.toHaveBeenCalledWith(
      'Failed to initialize Pi optimizations:',
      expect.any(Error)
    );
  });
});
