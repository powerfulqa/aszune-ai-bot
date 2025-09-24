/**
 * Memory checking functionality tests
 * Tests memory usage monitoring and garbage collection
 */

const memoryMonitor = require('../../src/utils/memory-monitor');
const { ErrorHandler } = require('../../src/utils/error-handler');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config');
jest.mock('../../src/utils/error-handler');

describe('Memory Monitor - Checking', () => {
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
      external: 10 * 1024 * 1024, // 10MB
    });

    // Mock global.gc
    global.gc = jest.fn();

    // Mock setInterval and clearInterval
    global.setInterval = jest.fn().mockReturnValue({ unref: jest.fn() });
    global.clearInterval = jest.fn();

    // Reset memory monitor state
    memoryMonitor.initialized = true;
  });

  afterEach(() => {
    // Restore original functions
    process.memoryUsage = originalMemoryUsage;
    global.gc = originalGc;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  it('should trigger garbage collection when memory exceeds limit', () => {
    // Setup high memory usage
    process.memoryUsage.mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: memoryMonitor.memoryLimit + 1024 * 1024, // Exceed limit
      external: 10 * 1024 * 1024,
    });

    const forceGcSpy = jest.spyOn(memoryMonitor, 'forceGarbageCollection');
    memoryMonitor.checkMemoryUsage();

    expect(forceGcSpy).toHaveBeenCalled();
    expect(memoryMonitor.isLowMemory).toBe(true);
  });

  it('should clear low memory flag when memory usage drops', () => {
    // Setup low memory state
    memoryMonitor.isLowMemory = true;

    // Setup low memory usage
    process.memoryUsage.mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: memoryMonitor.memoryLimit * 0.7, // Below 80% of limit
      external: 10 * 1024 * 1024,
    });

    memoryMonitor.checkMemoryUsage();

    expect(memoryMonitor.isLowMemory).toBe(false);
  });

  it('should handle critical memory threshold', () => {
    // Setup critical memory usage
    process.memoryUsage.mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: memoryMonitor.criticalMemory + 1024 * 1024, // Exceed critical
      external: 10 * 1024 * 1024,
    });

    const errorSpy = jest.spyOn(ErrorHandler, 'handleError');
    memoryMonitor.checkMemoryUsage();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      'Memory usage exceeded critical threshold'
    );
  });

  it('should handle memory check errors gracefully', () => {
    // Setup memory usage to throw error
    process.memoryUsage.mockImplementation(() => {
      throw new Error('Memory check failed');
    });

    const errorSpy = jest.spyOn(ErrorHandler, 'handleError');
    memoryMonitor.checkMemoryUsage();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      'Memory check failed'
    );
  });

  it('should force garbage collection when not recently called', () => {
    memoryMonitor.lastGcTime = 0;

    memoryMonitor.forceGarbageCollection();

    expect(global.gc).toHaveBeenCalled();
    expect(memoryMonitor.lastGcTime).toBeGreaterThan(0);
  });

  it('should not force garbage collection if recently called', () => {
    memoryMonitor.lastGcTime = Date.now() - 1000; // 1 second ago

    memoryMonitor.forceGarbageCollection();

    expect(global.gc).not.toHaveBeenCalled();
  });

  it('should handle garbage collection when gc is not available', () => {
    memoryMonitor.lastGcTime = 0;
    global.gc = undefined;

    memoryMonitor.forceGarbageCollection();

    expect(memoryMonitor.lastGcTime).toBeGreaterThan(0);
  });

  it('should handle garbage collection errors', () => {
    memoryMonitor.lastGcTime = 0;
    global.gc = jest.fn().mockImplementation(() => {
      throw new Error('GC failed');
    });

    const errorSpy = jest.spyOn(ErrorHandler, 'handleError');
    memoryMonitor.forceGarbageCollection();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      'Garbage collection failed'
    );
  });
});
