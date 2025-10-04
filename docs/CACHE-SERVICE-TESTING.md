# Cache Service Testing Guide

**Version**: 1.6.5+  
**Last Updated**: October 4, 2025  
**Related**: [Cache Service Architecture](./CACHE-SERVICE-ARCHITECTURE.md)

## 🧪 Testing Strategy Overview

This guide outlines the comprehensive testing approach for the cache service architecture, based on
lessons learned from the v1.6.5 cache command fixes.

## 📋 Test Categories

### 1. Unit Tests

#### CacheManager Service Tests

```javascript
describe('CacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  describe('getStats()', () => {
    test('should return complete stats object', () => {
      const stats = cacheManager.getStats();

      // ✅ CRITICAL: Test all required fields
      expect(stats).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        hitRate: expect.any(Number),
        sets: expect.any(Number),
        deletes: expect.any(Number),
        evictions: expect.any(Number),
        memoryUsageFormatted: expect.any(String),
        maxMemoryFormatted: expect.any(String),
        entryCount: expect.any(Number),
        maxSize: expect.any(Number),
        evictionStrategy: expect.any(String),
        uptimeFormatted: expect.any(String),
      });
    });

    test('should handle cache errors gracefully', () => {
      // Mock internal cache to throw error
      cacheManager.cache.getStats = jest.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });

      const stats = cacheManager.getStats();

      // ✅ Should return complete fallback object
      expect(stats.error).toBeDefined();
      expect(stats.hits).toBe(0);
      expect(stats.memoryUsageFormatted).toBe('0 B');
      expect(stats.evictionStrategy).toBe('hybrid');
    });
  });

  describe('getDetailedInfo()', () => {
    test('should return stats and entries array', () => {
      const info = cacheManager.getDetailedInfo();

      expect(info).toMatchObject({
        stats: expect.any(Object),
        entries: expect.any(Array),
      });
    });
  });
});
```

#### PerplexityService Integration Tests

```javascript
describe('PerplexityService Cache Integration', () => {
  let service;

  beforeEach(() => {
    service = new PerplexityService();
  });

  test('should delegate getCacheStats to cacheManager', () => {
    const mockStats = {
      hits: 10,
      misses: 5,
      hitRate: 66.67,
      memoryUsageFormatted: '1.2 MB',
    };

    jest.spyOn(service.cacheManager, 'getStats').mockReturnValue(mockStats);

    const result = service.getCacheStats();

    expect(service.cacheManager.getStats).toHaveBeenCalled();
    expect(result).toEqual(mockStats);
  });

  test('should handle cacheManager errors in getCacheStats', () => {
    jest.spyOn(service.cacheManager, 'getStats').mockImplementation(() => {
      throw new Error('CacheManager error');
    });

    const result = service.getCacheStats();

    expect(result.error).toBeDefined();
    expect(result.hits).toBe(0);
  });
});
```

### 2. Integration Tests

#### Discord Command Integration

```javascript
describe('Discord Cache Command Integration', () => {
  let mockInteraction;
  let commandHandler;

  beforeEach(() => {
    mockInteraction = {
      reply: jest.fn(),
      user: { id: 'test-user' },
      commandName: 'cache',
    };

    commandHandler = new CommandHandler();
  });

  test('should display cache statistics without undefined values', async () => {
    await commandHandler.handleSlashCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [
        {
          title: 'Cache Statistics',
          fields: [
            {
              name: 'Performance',
              value: expect.stringMatching(/Hit Rate: \d+%\nHits: \d+\nMisses: \d+/),
              inline: true,
            },
            {
              name: 'Operations',
              value: expect.stringMatching(/Sets: \d+\nDeletes: \d+\nEvictions: \d+/),
              inline: true,
            },
            {
              name: 'Memory Usage',
              value: expect.stringMatching(/\d+ B \/ \d+ MB\nEntries: \d+ \/ \d+/),
              inline: true,
            },
            {
              name: 'Configuration',
              value: expect.stringMatching(/Strategy: \w+\nUptime: .+/),
              inline: true,
            },
          ],
        },
      ],
    });

    // ✅ Verify no "undefined" values in response
    const embedFields = mockInteraction.reply.mock.calls[0][0].embeds[0].fields;
    embedFields.forEach((field) => {
      expect(field.value).not.toContain('undefined');
    });
  });
});
```

### 3. Error Scenario Tests

#### Service Layer Error Handling

```javascript
describe('Cache Service Error Scenarios', () => {
  test('should handle missing cacheManager property', () => {
    const service = new PerplexityService();
    service.cacheManager = undefined;

    const stats = service.getCacheStats();

    expect(stats.error).toBeDefined();
    expect(stats).toMatchObject({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      entryCount: 0,
      memoryUsage: 0,
      memoryUsageFormatted: '0 B',
      maxMemoryFormatted: '0 B',
      maxSize: 0,
      uptime: 0,
      uptimeFormatted: '0s',
      evictionStrategy: 'hybrid',
    });
  });

  test('should handle EnhancedCache initialization failure', () => {
    // Mock EnhancedCache constructor to throw
    const OriginalEnhancedCache = require('../src/utils/enhanced-cache').EnhancedCache;
    require('../src/utils/enhanced-cache').EnhancedCache = jest.fn().mockImplementation(() => {
      throw new Error('Initialization failed');
    });

    const cacheManager = new CacheManager();
    const stats = cacheManager.getStats();

    expect(stats.error).toBeDefined();

    // Restore original
    require('../src/utils/enhanced-cache').EnhancedCache = OriginalEnhancedCache;
  });
});
```

### 4. Performance Tests

#### Response Time Validation

```javascript
describe('Cache Service Performance', () => {
  test('getStats should complete within 1ms', async () => {
    const service = new PerplexityService();

    const start = process.hrtime.bigint();
    service.getCacheStats();
    const end = process.hrtime.bigint();

    const durationMs = Number(end - start) / 1000000;
    expect(durationMs).toBeLessThan(1);
  });

  test('should handle concurrent cache operations', async () => {
    const service = new PerplexityService();

    const promises = Array(100)
      .fill()
      .map(() => Promise.resolve(service.getCacheStats()));

    const results = await Promise.all(promises);

    results.forEach((stats) => {
      expect(stats).toMatchObject({
        hits: expect.any(Number),
        memoryUsageFormatted: expect.any(String),
      });
    });
  });
});
```

## 📊 Test Coverage Requirements

### Minimum Coverage Targets

- **Line Coverage**: 85%+
- **Branch Coverage**: 80%+
- **Function Coverage**: 90%+
- **Statement Coverage**: 85%+

### Critical Path Coverage

- All error handling paths must be tested
- All Discord command field mappings must be verified
- Service delegation patterns must be validated
- Fallback scenarios must be covered

## 🚨 Common Test Failures

### 1. Incomplete Mock Objects

```javascript
// ❌ WRONG - Missing required fields
const mockStats = { hits: 10, misses: 5 };

// ✅ CORRECT - Complete mock object
const mockStats = {
  hits: 10,
  misses: 5,
  hitRate: 66.67,
  sets: 8,
  deletes: 2,
  evictions: 1,
  memoryUsageFormatted: '1.2 MB',
  maxMemoryFormatted: '50 MB',
  entryCount: 15,
  maxSize: 100,
  evictionStrategy: 'hybrid',
  uptimeFormatted: '30s',
};
```

### 2. Property Reference Errors

```javascript
// ❌ WRONG - Testing incorrect property
expect(service.cache.getStats).toHaveBeenCalled();

// ✅ CORRECT - Testing actual property
expect(service.cacheManager.getStats).toHaveBeenCalled();
```

### 3. String Matching Issues

```javascript
// ❌ WRONG - Brittle exact matching
expect(field.value).toBe('Hit Rate: 66.67%\nHits: 10\nMisses: 5');

// ✅ CORRECT - Flexible pattern matching
expect(field.value).toMatch(/Hit Rate: \d+(\.\d+)?%\nHits: \d+\nMisses: \d+/);
```

## 🔧 Test Utilities

### Mock Factory Functions

```javascript
// Test utility for creating complete cache stats
function createMockCacheStats(overrides = {}) {
  return {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    entryCount: 0,
    memoryUsage: 0,
    memoryUsageFormatted: '0 B',
    maxMemory: 52428800,
    maxMemoryFormatted: '50 MB',
    maxSize: 100,
    uptime: 30000,
    uptimeFormatted: '30s',
    evictionStrategy: 'hybrid',
    ...overrides,
  };
}

// Test utility for Discord interaction mocks
function createMockInteraction(commandName = 'cache') {
  return {
    commandName,
    reply: jest.fn(),
    user: { id: 'test-user-123' },
    channel: { id: 'test-channel-123' },
    guild: { id: 'test-guild-123' },
  };
}
```

### Assertion Helpers

```javascript
// Helper to verify complete cache stats object
function expectCompleteCacheStats(stats) {
  const requiredFields = [
    'hits',
    'misses',
    'hitRate',
    'sets',
    'deletes',
    'evictions',
    'memoryUsageFormatted',
    'maxMemoryFormatted',
    'entryCount',
    'maxSize',
    'evictionStrategy',
    'uptimeFormatted',
  ];

  requiredFields.forEach((field) => {
    expect(stats).toHaveProperty(field);
    expect(stats[field]).toBeDefined();
    expect(stats[field]).not.toBe('undefined');
  });
}

// Helper to verify Discord embed doesn't contain undefined
function expectNoUndefinedInEmbed(embed) {
  const embedStr = JSON.stringify(embed);
  expect(embedStr).not.toContain('undefined');
  expect(embedStr).not.toMatch(/:\s*undefined/);
}
```

## 📝 Test Documentation Requirements

### Test Descriptions

- Use descriptive test names that explain the expected behavior
- Include context about why the test is important (e.g., "prevents v1.6.4 regression")
- Document any complex setup or mocking requirements

### Error Test Documentation

```javascript
test('should handle EnhancedCache getStats() throwing error (v1.6.5 regression test)', () => {
  // Context: This test prevents the undefined values issue that occurred in v1.6.4
  // when the internal cache implementation threw errors during stats retrieval

  // Setup: Mock the internal cache to simulate failure
  service.cacheManager.cache.getStats = jest.fn().mockImplementation(() => {
    throw new Error('Internal cache error');
  });

  // Execute & Verify: Should return complete fallback object
  const stats = service.getCacheStats();
  expectCompleteCacheStats(stats);
  expect(stats.error).toContain('Please try again later');
});
```

## 🎯 Continuous Integration

### Automated Test Execution

```bash
# Run all cache-related tests
npm test -- --testNamePattern="cache"

# Run with coverage
npm test -- --coverage --testNamePattern="cache"

# Run performance tests
npm test -- --testNamePattern="performance.*cache"
```

### Quality Gates

- All tests must pass before merging
- Coverage thresholds must be maintained
- No undefined values allowed in test outputs
- Performance benchmarks must be met

---

**Next Steps**: Consider implementing automated visual regression testing for Discord embed layouts
and cache statistics display formatting.
