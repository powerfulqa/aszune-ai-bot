/**
 * Core memory monitor tests
 * Tests initialization, shutdown, and basic functionality
 */

const memoryMonitor = require('../../src/utils/memory-monitor');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config');
jest.mock('../../src/utils/error-handler');

describe('Memory Monitor - Core', () => {
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

    // Clean up memory monitor
    if (memoryMonitor.checkInterval) {
      clearInterval(memoryMonitor.checkInterval);
      memoryMonitor.checkInterval = null;
    }
    memoryMonitor.initialized = false;
  });

  it('should have correct default values', () => {
    expect(memoryMonitor.initialized).toBe(false);
    expect(memoryMonitor.memoryLimit).toBeDefined();
    expect(memoryMonitor.criticalMemory).toBeDefined();
    expect(memoryMonitor.checkIntervalMs).toBeDefined();
    expect(memoryMonitor.checkInterval).toBeNull();
    expect(memoryMonitor.lastGcTime).toBe(0);
    expect(memoryMonitor.isLowMemory).toBe(false);
  });

  it('should initialize successfully', () => {
    memoryMonitor.initialize();

    expect(memoryMonitor.initialized).toBe(true);
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), memoryMonitor.checkIntervalMs);
  });

  it('should not initialize if already initialized', () => {
    memoryMonitor.initialized = true;
    memoryMonitor.initialize();

    expect(setInterval).not.toHaveBeenCalled();
  });

  it('should setup memory check interval on initialization', () => {
    memoryMonitor.initialize();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), memoryMonitor.checkIntervalMs);
  });

  it('should shutdown successfully when initialized', () => {
    memoryMonitor.initialized = true;
    memoryMonitor.checkInterval = setInterval(() => {}, 1000);

    memoryMonitor.shutdown();

    expect(memoryMonitor.initialized).toBe(false);
    expect(memoryMonitor.checkInterval).toBeNull();
  });

  it('should handle shutdown when not initialized', () => {
    memoryMonitor.initialized = false;

    memoryMonitor.shutdown();

    expect(memoryMonitor.initialized).toBe(false);
  });

  it('should clear interval on shutdown', () => {
    memoryMonitor.initialized = true;
    memoryMonitor.checkInterval = { unref: jest.fn() };

    memoryMonitor.shutdown();

    expect(memoryMonitor.checkInterval).toBeNull();
  });
});
