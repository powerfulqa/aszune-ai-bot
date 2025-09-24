const performanceMonitor = require('../../src/utils/performance-monitor');
const logger = require('../../src/utils/logger');
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

describe('Performance Monitor - Functions', () => {
  let originalEnv;
  let originalSetInterval;
  let mockSetInterval;
  let mockClearInterval;
  let intervalCallback;
  let intervalId = 123;

  beforeEach(() => {
    // Save original environment and setup test environment
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Mock setInterval and clearInterval
    originalSetInterval = global.setInterval;
    mockSetInterval = jest.fn((callback, interval) => {
      intervalCallback = callback;
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

  describe('throttle functions', () => {
    it('should throttle function calls based on interval', (done) => {
      const mockFunction = jest.fn();
      const throttledFunction = performanceMonitor.throttle(mockFunction, 100);

      // Call function multiple times quickly
      throttledFunction();
      throttledFunction();
      throttledFunction();

      // Should only be called once due to throttling
      setTimeout(() => {
        expect(mockFunction).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });

    it('should allow function calls after throttle interval', (done) => {
      const mockFunction = jest.fn();
      const throttledFunction = performanceMonitor.throttle(mockFunction, 50);

      throttledFunction();

      setTimeout(() => {
        throttledFunction();
        expect(mockFunction).toHaveBeenCalledTimes(2);
        done();
      }, 100);
    });

    it('should debounce function calls', (done) => {
      const mockFunction = jest.fn();
      const debouncedFunction = performanceMonitor.debounce(mockFunction, 100);

      // Call function multiple times quickly
      debouncedFunction();
      debouncedFunction();
      debouncedFunction();

      // Should only be called once after debounce delay
      setTimeout(() => {
        expect(mockFunction).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('_getCpuInfo', () => {
    it('should return CPU information', () => {
      const cpuInfo = performanceMonitor._getCpuInfo();
      
      expect(cpuInfo).toHaveProperty('cores');
      expect(cpuInfo).toHaveProperty('loadAverage');
      expect(cpuInfo.cores).toBe(2);
      expect(cpuInfo.loadAverage).toEqual([0.5, 0.6, 0.7]);
    });
  });

  describe('_checkPerformance', () => {
    it('should log performance metrics', () => {
      performanceMonitor._checkPerformance();
      
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performance metrics:')
      );
    });

    it('should handle errors gracefully', () => {
      // Mock process.memoryUsage to throw error
      process.memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory access error');
      });

      expect(() => performanceMonitor._checkPerformance()).not.toThrow();
    });
  });
});
