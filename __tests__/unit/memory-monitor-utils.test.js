/**
 * Memory monitor utility functions tests
 * Tests getMemoryUsage, getStatus, and other utility functions
 */

const memoryMonitor = require('../../src/utils/memory-monitor');
const { ErrorHandler } = require('../../src/utils/error-handler');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config');
jest.mock('../../src/utils/error-handler');

describe('Memory Monitor - Utils', () => {
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

  it('should return memory usage information', () => {
    const usage = memoryMonitor.getMemoryUsage();

    expect(usage).toHaveProperty('rss');
    expect(usage).toHaveProperty('heapTotal');
    expect(usage).toHaveProperty('heapUsed');
    expect(usage).toHaveProperty('external');
    expect(usage).toHaveProperty('heapUsedPercent');
  });

  it('should calculate memory usage percentage correctly', () => {
    const usage = memoryMonitor.getMemoryUsage();
    const expectedPercent = Math.round(((50 * 1024 * 1024) / memoryMonitor.memoryLimit) * 100);

    expect(usage.heapUsedPercent).toBe(expectedPercent);
  });

  it('should handle memory usage errors', () => {
    process.memoryUsage.mockImplementation(() => {
      throw new Error('Memory usage failed');
    });

    const errorSpy = jest.spyOn(ErrorHandler, 'handleError');
    const usage = memoryMonitor.getMemoryUsage();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      'getting memory usage'
    );
    expect(usage).toEqual({});
  });

  it('should return status information', () => {
    memoryMonitor.initialized = true;
    memoryMonitor.isLowMemory = true;
    memoryMonitor.lastGcTime = 1234567890;

    const status = memoryMonitor.getStatus();

    expect(status).toHaveProperty('initialized');
    expect(status).toHaveProperty('isLowMemory');
    expect(status).toHaveProperty('lastGcTime');
    expect(status).toHaveProperty('memoryLimit');
    expect(status).toHaveProperty('criticalMemory');
    expect(status).toHaveProperty('checkIntervalMs');
  });

  it('should handle configuration-based initialization', () => {
    memoryMonitor.initialize();

    // In test mode, intervals are not created to prevent Jest from hanging
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('should handle memory threshold detection', () => {
    // Setup high memory usage
    process.memoryUsage.mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: memoryMonitor.memoryLimit + 1024 * 1024,
      external: 10 * 1024 * 1024,
    });

    memoryMonitor.checkMemoryUsage();

    expect(memoryMonitor.isLowMemory).toBe(true);
  });
});
