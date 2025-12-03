/**
 * Tests for main entry point of the bot - Basic functionality
 */
jest.mock('../../src/utils/logger');
jest.mock('discord.js', () => require('../__mocks__/discord.mock.module.js'));
jest.mock('../../src/utils/pi-detector', () => ({
  detectPiModel: jest.fn().mockResolvedValue({
    model: 'Pi 4 Model B',
    totalMemoryMB: 4096,
    cpuCores: 4,
    cpuType: 'ARMv7',
    isRaspberryPi: true,
  }),
  optimizeSettings: jest.fn(),
}));

jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));

// Mock web-dashboard to prevent Socket.IO from starting during tests
jest.mock('../../src/services/web-dashboard', () => ({
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  getMetrics: jest.fn().mockReturnValue({}),
  isRunning: jest.fn().mockReturnValue(false),
}));

// Mock the enhanced cache module to avoid config dependency issues
jest.mock('../../src/utils/enhanced-cache', () => {
  const mockInstance = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
    getDetailedInfo: jest.fn().mockReturnValue({ entries: [], memoryUsage: 0 }),
  };

  const mockClass = jest.fn().mockImplementation(() => mockInstance);

  // Export both the class and the EVICTION_STRATEGIES
  mockClass.EVICTION_STRATEGIES = {
    LRU: 'LRU',
    LFU: 'LFU',
    TTL: 'TTL',
    SIZE_BASED: 'SIZE_BASED',
    HYBRID: 'HYBRID',
  };

  return mockClass;
});

// Mock the perplexity-secure service to avoid config dependency issues
jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
  generateSummary: jest.fn(),
  getCacheStats: jest.fn(),
  getDetailedCacheInfo: jest.fn(),
  invalidateCacheByTag: jest.fn(),
}));

describe('Main Index - Basic', () => {
  let mainIndex;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the module cache to ensure fresh imports
    jest.resetModules();
  });

  it('should export required functions', () => {
    mainIndex = require('../../src/index');

    expect(mainIndex).toHaveProperty('client');
    expect(mainIndex).toHaveProperty('handleChatMessage');
    expect(mainIndex).toHaveProperty('shutdown');
    expect(mainIndex).toHaveProperty('unhandledRejectionHandler');
    expect(mainIndex).toHaveProperty('uncaughtExceptionHandler');
  });

  it('should initialize client properly', () => {
    mainIndex = require('../../src/index');

    expect(mainIndex.client).toBeDefined();
    expect(typeof mainIndex.client).toBe('object');
  });

  it('should have handleChatMessage function', () => {
    mainIndex = require('../../src/index');

    expect(typeof mainIndex.handleChatMessage).toBe('function');
  });

  it('should have shutdown function', () => {
    mainIndex = require('../../src/index');

    expect(typeof mainIndex.shutdown).toBe('function');
  });

  it('should have error handler functions', () => {
    mainIndex = require('../../src/index');

    expect(typeof mainIndex.unhandledRejectionHandler).toBe('function');
    expect(typeof mainIndex.uncaughtExceptionHandler).toBe('function');
  });

  it('should handle module loading without errors', () => {
    expect(() => {
      mainIndex = require('../../src/index');
    }).not.toThrow();
  });
});
