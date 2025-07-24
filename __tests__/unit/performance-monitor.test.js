const performanceMonitor = require('../../src/utils/performance-monitor');
const logger = require('../../src/utils/logger');
const os = require('os');
const config = require('../../src/config/config');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('os');
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true
  }
}));

describe('Performance Monitor', () => {
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
      {
        times: {
          user: 100,
          nice: 0,
          sys: 50,
          idle: 500,
          irq: 0
        }
      }
    ]);

    // Reset performance monitor
    performanceMonitor.checkInterval = null;
    performanceMonitor.highLoadCount = 0;
    performanceMonitor.lastCpuInfo = null;
    performanceMonitor.throttleFactor = 1;
    performanceMonitor.enabled = true;
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    global.setInterval = originalSetInterval;
    global.clearInterval = global.clearInterval;
    jest.resetAllMocks();
  });

  describe('initialize', () => {
    it('should start monitoring in production environment', () => {
      performanceMonitor.initialize();
      
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('initialized'));
    });
    
    it('should not start monitoring when disabled', () => {
      performanceMonitor.enabled = false;
      performanceMonitor.initialize();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    });
    
    it('should not start monitoring in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      performanceMonitor.initialize();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('non-production'));
    });
  });

  describe('shutdown', () => {
    it('should clear the interval when shutdown is called', () => {
      performanceMonitor.checkInterval = intervalId;
      performanceMonitor.shutdown();
      
      expect(mockClearInterval).toHaveBeenCalledWith(intervalId);
      expect(performanceMonitor.checkInterval).toBeNull();
    });
    
    it('should do nothing if already stopped', () => {
      performanceMonitor.checkInterval = null;
      performanceMonitor.shutdown();
      
      expect(mockClearInterval).not.toHaveBeenCalled();
    });
  });

  describe('throttle functions', () => {
    it('getThrottleFactor should return current factor when enabled', () => {
      performanceMonitor.throttleFactor = 2.5;
      expect(performanceMonitor.getThrottleFactor()).toBe(2.5);
    });
    
    it('getThrottleFactor should return 1 when disabled', () => {
      performanceMonitor.enabled = false;
      performanceMonitor.throttleFactor = 2.5;
      expect(performanceMonitor.getThrottleFactor()).toBe(1);
    });
    
    it('throttleTime should multiply by throttle factor when enabled', () => {
      performanceMonitor.throttleFactor = 2;
      expect(performanceMonitor.throttleTime(1000)).toBe(2000);
    });
    
    it('throttleTime should not throttle below minimum valid interval', () => {
      performanceMonitor.throttleFactor = 2;
      performanceMonitor.minValidInterval = 300;
      expect(performanceMonitor.throttleTime(200)).toBe(200);
    });
    
    it('throttleTask should apply delay based on throttle factor', async () => {
      performanceMonitor.throttleFactor = 2;
      performanceMonitor.currentBackoff = 500;
      
      const mockTask = jest.fn().mockResolvedValue('result');
      const originalSetTimeout = global.setTimeout;
      
      try {
        global.setTimeout = jest.fn((callback) => {
          callback();
          return 999;
        });
        
        const result = await performanceMonitor.throttleTask(mockTask);
        
        expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
        expect(mockTask).toHaveBeenCalled();
        expect(result).toBe('result');
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  });

  describe('_getCpuInfo', () => {
    it('should calculate idle and total CPU time', () => {
      const result = performanceMonitor._getCpuInfo();
      
      expect(result).toEqual({
        idle: 500, // From the mock
        total: 650  // 100 + 0 + 50 + 500 + 0
      });
    });
  });

  describe('_checkPerformance', () => {
    beforeEach(() => {
      performanceMonitor._calculateCpuUsage = jest.fn().mockReturnValue(0.5); // 50% CPU usage
      performanceMonitor._adjustThrottling = jest.fn();
    });
    
    it('should calculate CPU usage and update state', () => {
      const initialCpuInfo = { idle: 400, total: 600 };
      const updatedCpuInfo = { idle: 500, total: 750 };
      
      performanceMonitor.lastCpuInfo = initialCpuInfo;
      performanceMonitor._getCpuInfo = jest.fn().mockReturnValue(updatedCpuInfo);
      
      performanceMonitor._checkPerformance();
      
      expect(performanceMonitor._calculateCpuUsage).toHaveBeenCalledWith(initialCpuInfo, updatedCpuInfo);
      expect(performanceMonitor.lastCpuInfo).toBe(updatedCpuInfo);
      expect(performanceMonitor._adjustThrottling).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', () => {
      performanceMonitor._getCpuInfo = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      performanceMonitor._checkPerformance();
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking performance'),
        expect.any(Error)
      );
    });
  });
});
