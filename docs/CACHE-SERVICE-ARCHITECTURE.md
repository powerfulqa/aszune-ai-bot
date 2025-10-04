# Cache Service Architecture Documentation

**Version**: 1.6.5+  
**Last Updated**: October 4, 2025  
**Status**: Production Ready

## 🏗️ Architecture Overview

The Aszune AI Bot uses a multi-layered cache architecture designed for performance, reliability, and
maintainability. This document outlines the critical patterns and requirements learned from the
v1.6.5 cache command fixes.

## 📋 Service Layer Hierarchy

```
Discord Commands (/cache, /analytics, etc.)
        ↓
PerplexityService (Main API Service)
        ↓
CacheManager (Service Layer)
        ↓
EnhancedCache (Core Implementation)
        ↓
File System / Memory Storage
```

## 🔧 Core Components

### 1. PerplexityService (`src/services/perplexity-secure.js`)

**Role**: Main API service that coordinates cache operations  
**Key Responsibility**: Delegates cache operations to CacheManager

```javascript
class PerplexityService {
  constructor() {
    // ✅ CRITICAL: Use descriptive property names
    this.cacheManager = new CacheManager(); // NOT this.cache
  }

  // ✅ REQUIRED: Delegate all cache operations
  getCacheStats() {
    return this.cacheManager.getStats();
  }

  getDetailedCacheInfo() {
    return this.cacheManager.getDetailedInfo();
  }

  invalidateCacheByTag(tag) {
    return this.cacheManager.invalidateByTag(tag);
  }
}
```

### 2. CacheManager (`src/services/cache-manager.js`)

**Role**: Service layer for cache management  
**Key Responsibility**: Provides Discord-compatible API with comprehensive error handling

```javascript
class CacheManager {
  constructor() {
    this.cache = new EnhancedCache({
      maxSize: config.CACHE.DEFAULT_MAX_ENTRIES,
      maxMemory: config.CACHE.MAX_MEMORY_MB * 1024 * 1024,
      evictionStrategy: EVICTION_STRATEGIES.HYBRID,
    });
  }

  // ✅ REQUIRED: Must implement all methods expected by Discord commands
  getStats() {
    try {
      return this.cache.getStats();
    } catch (error) {
      // ✅ CRITICAL: Return complete object with all expected fields
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        hitRate: 0,
        entryCount: 0,
        memoryUsage: 0,
        memoryUsageFormatted: '0 B',
        maxMemory: 0,
        maxMemoryFormatted: '0 B',
        maxSize: 0,
        uptime: 0,
        uptimeFormatted: '0s',
        evictionStrategy: 'hybrid',
        error: errorResponse.message,
      };
    }
  }

  getDetailedInfo() {
    try {
      return this.cache.getDetailedInfo();
    } catch (error) {
      return {
        error: errorResponse.message,
        stats: this.getStats(),
        entries: [],
      };
    }
  }

  invalidateByTag(tag) {
    try {
      return this.cache.invalidateByTag(tag);
    } catch (error) {
      return 0;
    }
  }
}
```

### 3. EnhancedCache (`src/utils/enhanced-cache.js`)

**Role**: Core cache implementation with advanced features  
**Key Responsibility**: Provides low-level cache operations and statistics

```javascript
class EnhancedCache {
  getStats() {
    const hitRate =
      this.metrics.hits + this.metrics.misses > 0
        ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
        : 0;

    return {
      ...this.metrics, // hits, misses, sets, deletes, evictions
      hitRate: Math.round(hitRate * 100) / 100,
      uptime: Date.now() - this.metrics.startTime,
      uptimeFormatted: this.formatUptime(uptime),
      entryCount: this.entries.size,
      memoryUsage: this.metrics.totalMemory,
      memoryUsageFormatted: this.formatBytes(this.metrics.totalMemory),
      maxSize: this.maxSize,
      maxMemory: this.maxMemory,
      maxMemoryFormatted: this.formatBytes(this.maxMemory),
      evictionStrategy: this.evictionStrategy,
    };
  }
}
```

## ⚠️ Critical Requirements

### Discord Command Field Compatibility

All cache statistics **MUST** include these exact fields to prevent "undefined" values in Discord
embeds:

| Field                  | Type   | Description             | Required |
| ---------------------- | ------ | ----------------------- | -------- |
| `hits`                 | number | Cache hit count         | ✅       |
| `misses`               | number | Cache miss count        | ✅       |
| `hitRate`              | number | Hit rate percentage     | ✅       |
| `sets`                 | number | Set operations count    | ✅       |
| `deletes`              | number | Delete operations count | ✅       |
| `evictions`            | number | Eviction count          | ✅       |
| `memoryUsageFormatted` | string | Formatted memory usage  | ✅       |
| `maxMemoryFormatted`   | string | Formatted max memory    | ✅       |
| `entryCount`           | number | Current entry count     | ✅       |
| `maxSize`              | number | Maximum entries allowed | ✅       |
| `evictionStrategy`     | string | Eviction strategy name  | ✅       |
| `uptimeFormatted`      | string | Formatted uptime        | ✅       |

### Service Delegation Patterns

#### ✅ Correct Implementation

```javascript
// Service -> CacheManager -> EnhancedCache
class PerplexityService {
  getCacheStats() {
    return this.cacheManager.getStats(); // Proper delegation
  }
}
```

#### ❌ Common Mistakes

```javascript
// Direct cache access (BREAKS)
getCacheStats() {
  return this.cache.getStats(); // Property doesn't exist!
}

// Bypassing service layer (DANGEROUS)
getCacheStats() {
  return new EnhancedCache().getStats(); // Loses configuration and error handling
}
```

## 🧪 Testing Patterns

### Service Integration Tests

```javascript
describe('Cache Service Integration', () => {
  test('should return complete stats object', () => {
    const service = new PerplexityService();
    const stats = service.getCacheStats();

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
});
```

### Error Scenario Testing

```javascript
test('should handle cache errors gracefully', () => {
  // Mock cache to throw error
  service.cacheManager.cache.getStats = jest.fn().mockImplementation(() => {
    throw new Error('Cache error');
  });

  const stats = service.getCacheStats();

  // ✅ Should return fallback with all fields
  expect(stats.error).toBeDefined();
  expect(stats.hits).toBe(0);
  expect(stats.memoryUsageFormatted).toBe('0 B');
});
```

## 🚨 Common Pitfalls & Solutions

### 1. Property Name Inconsistency

```javascript
// ❌ Problem: Inconsistent property naming
this.cache = new CacheManager();
this.cacheService = new CacheManager();
this.cacheManager = new CacheManager();

// ✅ Solution: Use consistent, descriptive names
this.cacheManager = new CacheManager(); // Always use this pattern
```

### 2. Incomplete Error Handling

```javascript
// ❌ Problem: Partial error response
catch (error) {
  return { error: error.message }; // Missing required fields!
}

// ✅ Solution: Complete fallback object
catch (error) {
  return {
    error: errorResponse.message,
    hits: 0, misses: 0, // ... all required fields
  };
}
```

### 3. Missing Method Implementation

```javascript
// ❌ Problem: Service doesn't implement expected methods
class CacheManager {
  // Missing getStats(), getDetailedInfo(), invalidateByTag()
}

// ✅ Solution: Implement all required methods
class CacheManager {
  getStats() {
    /* implementation */
  }
  getDetailedInfo() {
    /* implementation */
  }
  invalidateByTag(tag) {
    /* implementation */
  }
}
```

## 📈 Performance Considerations

### Memory Usage Optimization

- Cache statistics are calculated on-demand to minimize memory overhead
- Formatted strings are generated during retrieval, not stored
- Eviction strategies prevent unbounded memory growth

### Response Time Targets

- `getStats()`: < 1ms (synchronous calculation)
- `getDetailedInfo()`: < 5ms (includes entry enumeration)
- `invalidateByTag()`: < 10ms (depends on tag distribution)

### Error Handling Performance

- Fallback objects are pre-defined to minimize creation overhead
- Error logging is async to prevent blocking cache operations
- Circuit breaker patterns prevent cascade failures

## 🔄 Migration Guide

### From v1.6.4 to v1.6.5+

If you have custom cache implementations, ensure they follow the new patterns:

1. **Update property names**: `this.cache` → `this.cacheManager`
2. **Add missing methods**: Implement `getStats()`, `getDetailedInfo()`, `invalidateByTag()`
3. **Complete field coverage**: Return all required fields in error scenarios
4. **Service delegation**: Never bypass the service layer

### Breaking Changes

- None - all changes are additive and maintain backward compatibility

## 📚 References

- [Enhanced Cache Implementation](../src/utils/enhanced-cache.js)
- [Cache Manager Service](../src/services/cache-manager.js)
- [Perplexity Service Integration](../src/services/perplexity-secure.js)
- [Discord Commands Implementation](../src/commands/index.js)
- [Release Notes v1.6.5](./RELEASE-NOTES-v1.6.5.md)

---

**Next Steps**: Consider implementing cache metrics dashboard and automated performance monitoring
based on these architectural patterns.
