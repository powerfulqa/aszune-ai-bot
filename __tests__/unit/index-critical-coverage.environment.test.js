const { setupIndexCriticalMocks } = require('./index-critical-coverage.test.setup');

describe('Production Environment with Pi Optimizations', () => {
  let context;

  beforeEach(() => {
    context = setupIndexCriticalMocks();
    process.env.NODE_ENV = 'production';
    context.index = context.loadIndex();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('should initialize Pi optimizations in production environment', () => {
    expect(context.mockMemoryMonitor.initialize).toHaveBeenCalled();
    expect(context.mockPerformanceMonitor.initialize).toHaveBeenCalled();
  });
});

describe('Development Environment', () => {
  let context;

  beforeEach(() => {
    context = setupIndexCriticalMocks();
    process.env.NODE_ENV = 'development';
    context.index = context.loadIndex();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('should not initialize Pi optimizations in development', () => {
    expect(context.mockMemoryMonitor.initialize).not.toHaveBeenCalled();
    expect(context.mockPerformanceMonitor.initialize).not.toHaveBeenCalled();
  });
});
