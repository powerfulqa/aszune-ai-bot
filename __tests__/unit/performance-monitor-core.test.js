const performanceMonitor = require('../../src/utils/performance-monitor');
const os = require('os');
const config = require('../../src/config/config');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('os');
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
  },
  PERFORMANCE: {
    MIN_VALID_INTERVAL_MS: 100,
    BACKOFF_MAX_MS: 30000,
    BACKOFF_MIN_MS: 1000,
    CHECK_INTERVAL_MS: 5000,
  },
}));

describe('Performance Monitor - Core', () => {
  let originalEnv;
  let originalSetInterval;
  let mockSetInterval;
  let mockClearInterval;
  let intervalId = 123;

  beforeEach(() => {
    // Save original environment and setup test environment
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Mock setInterval and clearInterval
    originalSetInterval = global.setInterval;
    mockSetInterval = jest.fn((_callback, _interval) => {
      return intervalId;
    });
    mockClearInterval = jest.fn();

    global.setInterval = mockSetInterval;
    global.clearInterval = mockClearInterval;

    // Mock process.memoryUsage
    process.memoryUsage = jest.fn().mockReturnValue({ rss: 100 * 1024 * 1024 }); // 100MB

    // Mock os functions
    os.totalmem = jest.fn().mockReturnValue(1024 * 1024 * 1024); // 1GB
    os.cpus = jest.fn().mockReturnValue([
      { model: 'Test CPU', speed: 1000 },
      { model: 'Test CPU', speed: 1000 },
    ]);
    os.loadavg = jest.fn().mockReturnValue([0.5, 0.6, 0.7]);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    global.setInterval = originalSetInterval;

    // Clean up any intervals
    if (performanceMonitor.intervalId) {
      performanceMonitor.shutdown();
    }
  });

  describe('initialize', () => {
    it('should start monitoring in production environment', () => {
      process.env.NODE_ENV = 'production';
      performanceMonitor.initialize();

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        config.PERFORMANCE.CHECK_INTERVAL_MS
      );
      expect(performanceMonitor.intervalId).toBe(intervalId);
    });

    it('should not start monitoring in test environment', () => {
      process.env.NODE_ENV = 'test';
      performanceMonitor.initialize();

      expect(mockSetInterval).not.toHaveBeenCalled();
      expect(performanceMonitor.intervalId).toBeNull();
    });

    it('should not start monitoring if already initialized', () => {
      process.env.NODE_ENV = 'production';
      performanceMonitor.initialize();
      performanceMonitor.initialize(); // Second call

      expect(mockSetInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('shutdown', () => {
    it('should clear interval and reset state', () => {
      process.env.NODE_ENV = 'production';
      performanceMonitor.initialize();
      performanceMonitor.shutdown();

      expect(mockClearInterval).toHaveBeenCalledWith(intervalId);
      expect(performanceMonitor.intervalId).toBeNull();
    });

    it('should handle shutdown when not initialized', () => {
      performanceMonitor.shutdown();
      expect(mockClearInterval).not.toHaveBeenCalled();
    });
  });
});
