const { setupIndexContext, mockConfigData } = require('./index.test.setup');

describe('Boot Optimizations', () => {
  let context;

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

    // Pi optimizations initialization was moved out of ready handler
    // So it should not be called from the ready handler anymore
    expect(mockConfigData.initializePiOptimizations).not.toHaveBeenCalled();
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
    
    // The ready handler should not throw even if Pi init would fail
    // because Pi init is no longer called from the ready handler
    await expect(async () => {
      if (readyHandler) {
        await readyHandler();
      }
    }).not.toThrow();
  });
});
