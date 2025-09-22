const memoryMonitor = require('../../src/utils/memory-monitor');
const logger = require('../../src/utils/logger');
const config = require('../../src/config/config');
const { ErrorHandler } = require('../../src/utils/error-handler');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config');
jest.mock('../../src/utils/error-handler');

describe('Memory Monitor', () => {
  let originalMemoryUsage;
  let originalGc;
  let originalSetInterval;
  let originalClearInterval;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Store original functions
    originalMemoryUsage = process.memoryUsage;
    originalGc = global.gc;
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    
    // Mock process.memoryUsage
    process.memoryUsage = jest.fn().mockReturnValue({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      heapUsed: 50 * 1024 * 1024, // 50MB
      external: 10 * 1024 * 1024 // 10MB
    });
    
    // Mock global.gc
    global.gc = jest.fn();
    
    // Mock timers
    jest.useFakeTimers();
    global.setInterval = jest.fn().mockReturnValue({
      unref: jest.fn()
    });
    global.clearInterval = jest.fn();
    
    // Reset memory monitor state
    memoryMonitor.initialized = false;
    memoryMonitor.isLowMemory = false;
    memoryMonitor.lastGcTime = 0;
    if (memoryMonitor.checkInterval) {
      clearInterval(memoryMonitor.checkInterval);
      memoryMonitor.checkInterval = null;
    }
  });

  afterEach(() => {
    // Restore original functions
    process.memoryUsage = originalMemoryUsage;
    global.gc = originalGc;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    
    // Clean up
    if (memoryMonitor.checkInterval) {
      // Just set to null since we're using mocks
      memoryMonitor.checkInterval = null;
    }
    memoryMonitor.initialized = false;
    
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(memoryMonitor.initialized).toBe(false);
      expect(memoryMonitor.memoryLimit).toBeDefined();
      expect(memoryMonitor.criticalMemory).toBeDefined();
      expect(memoryMonitor.checkIntervalMs).toBeDefined();
      expect(memoryMonitor.checkInterval).toBeNull();
      expect(memoryMonitor.lastGcTime).toBe(0);
      expect(memoryMonitor.isLowMemory).toBe(false);
    });

    it('should use environment variables when available', () => {
      const originalEnv = process.env.PI_MEMORY_LIMIT;
      const originalCriticalEnv = process.env.PI_MEMORY_CRITICAL;
      
      process.env.PI_MEMORY_LIMIT = '200';
      process.env.PI_MEMORY_CRITICAL = '300';
      
      // Create a new instance to test environment variable usage
      const MemoryMonitor = require('../../src/utils/memory-monitor');
      
      // Restore environment
      process.env.PI_MEMORY_LIMIT = originalEnv;
      process.env.PI_MEMORY_CRITICAL = originalCriticalEnv;
    });
  });

  describe('initialize', () => {
    it('should initialize the memory monitor', () => {
      memoryMonitor.initialize();
      
      expect(memoryMonitor.initialized).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith('Initializing memory monitor...');
      expect(logger.debug).toHaveBeenCalledWith('Memory monitor initialized');
    });

    it('should not initialize if already initialized', () => {
      memoryMonitor.initialized = true;
      memoryMonitor.initialize();
      
      expect(logger.debug).toHaveBeenCalledTimes(0);
    });

    it('should set up periodic checks', () => {
      memoryMonitor.initialize();
      
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        memoryMonitor.checkIntervalMs
      );
    });

    it('should call checkMemoryUsage on initialization', () => {
      const checkSpy = jest.spyOn(memoryMonitor, 'checkMemoryUsage');
      memoryMonitor.initialize();
      
      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shut down the memory monitor', () => {
      memoryMonitor.initialized = true;
      memoryMonitor.checkInterval = setInterval(() => {}, 1000);
      
      memoryMonitor.shutdown();
      
      expect(memoryMonitor.initialized).toBe(false);
      expect(memoryMonitor.checkInterval).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Memory monitor shut down');
    });

    it('should not shut down if not initialized', () => {
      memoryMonitor.initialized = false;
      memoryMonitor.shutdown();
      
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should clear interval if it exists', () => {
      memoryMonitor.initialized = true;
      memoryMonitor.checkInterval = { unref: jest.fn() };
      
      memoryMonitor.shutdown();
      
      expect(memoryMonitor.checkInterval).toBeNull();
    });
  });

  describe('checkMemoryUsage', () => {
    beforeEach(() => {
      memoryMonitor.initialized = true;
    });

    it('should check memory usage normally', () => {
      memoryMonitor.checkMemoryUsage();
      
      expect(process.memoryUsage).toHaveBeenCalled();
    });

    it('should trigger GC when memory limit exceeded', () => {
      process.memoryUsage.mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: memoryMonitor.memoryLimit + 1024 * 1024, // Exceed limit
        external: 10 * 1024 * 1024
      });
      
      const forceGcSpy = jest.spyOn(memoryMonitor, 'forceGarbageCollection');
      memoryMonitor.checkMemoryUsage();
      
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('High memory usage detected'));
      expect(memoryMonitor.isLowMemory).toBe(true);
      expect(forceGcSpy).toHaveBeenCalled();
    });

    it('should reset low memory flag when memory normalizes', () => {
      memoryMonitor.isLowMemory = true;
      process.memoryUsage.mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: memoryMonitor.memoryLimit * 0.7, // Below 80% of limit
        external: 10 * 1024 * 1024
      });
      
      memoryMonitor.checkMemoryUsage();
      
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Memory usage has normalized'));
      expect(memoryMonitor.isLowMemory).toBe(false);
    });

    it('should log critical memory warning', () => {
      process.memoryUsage.mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: memoryMonitor.criticalMemory + 1024 * 1024, // Exceed critical
        external: 10 * 1024 * 1024
      });
      
      memoryMonitor.checkMemoryUsage();
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL MEMORY USAGE'));
    });

    it('should handle errors gracefully', () => {
      process.memoryUsage.mockImplementation(() => {
        throw new Error('Memory check failed');
      });
      
      // Mock ErrorHandler.handleError to return an object with message
      ErrorHandler.handleError.mockReturnValue({
        message: 'Memory check failed',
        criticalMemory: false
      });
      
      memoryMonitor.checkMemoryUsage();
      
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Memory check error'));
    });
  });

  describe('forceGarbageCollection', () => {
    beforeEach(() => {
      memoryMonitor.initialized = true;
    });

    it('should run garbage collection if global.gc is available', () => {
      global.gc = jest.fn();
      memoryMonitor.lastGcTime = 0;
      
      memoryMonitor.forceGarbageCollection();
      
      expect(global.gc).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Running global.gc()');
    });

    it('should not run GC if cooldown period has not passed', () => {
      global.gc = jest.fn();
      memoryMonitor.lastGcTime = Date.now() - 1000; // 1 second ago
      
      memoryMonitor.forceGarbageCollection();
      
      expect(global.gc).not.toHaveBeenCalled();
    });

    it('should create memory pressure to encourage GC', () => {
      global.gc = undefined;
      memoryMonitor.lastGcTime = 0;
      
      memoryMonitor.forceGarbageCollection();
      
      expect(logger.debug).toHaveBeenCalledWith('Memory cleanup attempted');
    });

    it('should handle errors during garbage collection', () => {
      global.gc = jest.fn().mockImplementation(() => {
        throw new Error('GC failed');
      });
      memoryMonitor.lastGcTime = 0;
      
      // Mock ErrorHandler.handleError to return an object with message
      ErrorHandler.handleError.mockReturnValue({
        message: 'GC failed',
        isLowMemory: false
      });
      
      memoryMonitor.forceGarbageCollection();
      
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Garbage collection error'));
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage stats', () => {
      const usage = memoryMonitor.getMemoryUsage();
      
      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('external');
      expect(usage).toHaveProperty('percentUsed');
      expect(usage).toHaveProperty('isLowMemory');
      expect(typeof usage.percentUsed).toBe('number');
    });

    it('should calculate percent used correctly', () => {
      const usage = memoryMonitor.getMemoryUsage();
      const expectedPercent = Math.round((50 * 1024 * 1024) / memoryMonitor.memoryLimit * 100);
      
      expect(usage.percentUsed).toBe(expectedPercent);
    });

    it('should handle errors and return empty object', () => {
      process.memoryUsage.mockImplementation(() => {
        throw new Error('Memory usage failed');
      });
      
      // Mock ErrorHandler.handleError to return an object with message
      ErrorHandler.handleError.mockReturnValue({
        message: 'Memory usage failed'
      });
      
      const usage = memoryMonitor.getMemoryUsage();
      
      expect(usage).toEqual({});
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Memory usage error'));
    });
  });

  describe('getStatus', () => {
    it('should return complete status information', () => {
      memoryMonitor.initialized = true;
      memoryMonitor.isLowMemory = true;
      memoryMonitor.lastGcTime = 1234567890;
      
      const status = memoryMonitor.getStatus();
      
      expect(status).toHaveProperty('initialized', true);
      expect(status).toHaveProperty('memoryUsage');
      expect(status).toHaveProperty('memoryLimit');
      expect(status).toHaveProperty('criticalMemory');
      expect(status).toHaveProperty('lastGcTime', 1234567890);
      expect(status).toHaveProperty('isLowMemory', true);
    });
  });

  describe('Integration', () => {
    it('should work with periodic checks', () => {
      memoryMonitor.initialize();
      
      // Just verify that setInterval was called with the right parameters
      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        memoryMonitor.checkIntervalMs
      );
      
      // Verify memory usage was called at least once (on initialization)
      expect(process.memoryUsage).toHaveBeenCalled();
    });

    it('should handle memory pressure scenario', () => {
      memoryMonitor.initialize();
      
      // Simulate high memory usage
      process.memoryUsage.mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: memoryMonitor.memoryLimit + 1024 * 1024,
        external: 10 * 1024 * 1024
      });
      
      memoryMonitor.checkMemoryUsage();
      
      expect(memoryMonitor.isLowMemory).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
