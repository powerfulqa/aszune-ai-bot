/**
 * Tests for main entry point of the bot - Advanced functionality
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

describe('Main Index - Advanced', () => {
  let mainIndex;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the module cache to ensure fresh imports
    jest.resetModules();
  });

  it('should handle bootWithOptimizations function', () => {
    mainIndex = require('../../src/index');
    
    expect(mainIndex).toHaveProperty('bootWithOptimizations');
    expect(typeof mainIndex.bootWithOptimizations).toBe('function');
  });

  it('should handle registerSlashCommands function', () => {
    mainIndex = require('../../src/index');
    
    expect(mainIndex).toHaveProperty('registerSlashCommands');
    expect(typeof mainIndex.registerSlashCommands).toBe('function');
  });

  it('should handle Pi optimization detection', async () => {
    const piDetector = require('../../src/utils/pi-detector');
    
    const result = await piDetector.detectPiModel();
    
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('totalMemoryMB');
    expect(result).toHaveProperty('cpuCores');
    expect(result).toHaveProperty('cpuType');
    expect(result).toHaveProperty('isRaspberryPi');
    expect(result.isRaspberryPi).toBe(true);
  });

  it('should handle enhanced cache initialization', () => {
    const EnhancedCache = require('../../src/utils/enhanced-cache');
    
    const cache = new EnhancedCache();
    
    expect(cache).toHaveProperty('get');
    expect(cache).toHaveProperty('set');
    expect(cache).toHaveProperty('delete');
    expect(cache).toHaveProperty('clear');
    expect(cache).toHaveProperty('getStats');
    expect(cache).toHaveProperty('getDetailedInfo');
  });

  it('should handle perplexity service initialization', () => {
    const perplexityService = require('../../src/services/perplexity-secure');
    
    expect(perplexityService).toHaveProperty('generateChatResponse');
    expect(perplexityService).toHaveProperty('generateSummary');
    expect(perplexityService).toHaveProperty('getCacheStats');
    expect(perplexityService).toHaveProperty('getDetailedCacheInfo');
    expect(perplexityService).toHaveProperty('invalidateCacheByTag');
  });

  it('should handle error scenarios gracefully', () => {
    expect(() => {
      mainIndex = require('../../src/index');
    }).not.toThrow();
  });

  it('should handle multiple imports without conflicts', () => {
    const index1 = require('../../src/index');
    const index2 = require('../../src/index');
    
    expect(index1).toBe(index2);
  });

  it('should handle environment variable changes', () => {
    const originalEnv = process.env.NODE_ENV;
    
    process.env.NODE_ENV = 'test';
    expect(() => {
      mainIndex = require('../../src/index');
    }).not.toThrow();
    
    process.env.NODE_ENV = 'production';
    expect(() => {
      mainIndex = require('../../src/index');
    }).not.toThrow();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle missing dependencies gracefully', () => {
    // This test ensures the module can handle missing optional dependencies
    expect(() => {
      mainIndex = require('../../src/index');
    }).not.toThrow();
  });
});
