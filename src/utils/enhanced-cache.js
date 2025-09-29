/**
 * Enhanced Caching System
 * Provides intelligent caching with advanced eviction strategies and metrics
 */
const config = require('../config/config');
const { ErrorHandler } = require('./error-handler');

/**
 * Cache eviction strategies
 */
const EVICTION_STRATEGIES = {
  LRU: 'lru', // Least Recently Used
  LFU: 'lfu', // Least Frequently Used
  TTL: 'ttl', // Time To Live
  SIZE_BASED: 'size', // Size-based eviction
  HYBRID: 'hybrid', // Combination of strategies
};

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 0;
    this.ttl = ttl; // Time to live in milliseconds
    this.size = this.calculateSize();
    this.tags = new Set(); // For tag-based invalidation
  }

  /**
   * Calculate approximate size of the entry
   * @returns {number} Size in bytes
   */
  calculateSize() {
    try {
      const keySize = JSON.stringify(this.key).length * 2; // UTF-16
      const valueSize = JSON.stringify(this.value).length * 2; // UTF-16
      const metadataSize = 100; // Approximate metadata overhead
      return keySize + valueSize + metadataSize;
    } catch (error) {
      return 1000; // Default size if calculation fails
    }
  }

  /**
   * Check if entry is expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    if (this.ttl === null || this.ttl === undefined) return false;
    if (this.ttl === 0) return true; // Zero TTL means immediate expiration
    return Date.now() - this.createdAt > this.ttl;
  }

  /**
   * Update access statistics
   */
  touch() {
    this.lastAccessed = Date.now();
    this.accessCount++;
  }

  /**
   * Add tag to entry
   * @param {string} tag - Tag to add
   */
  addTag(tag) {
    this.tags.add(tag);
  }

  /**
   * Remove tag from entry
   * @param {string} tag - Tag to remove
   */
  removeTag(tag) {
    this.tags.delete(tag);
  }
}

/**
 * Gets cache configuration with defaults
 * @param {object} config - The configuration object to extract cache settings from
 * @returns {object} Cache configuration with defaults applied
 */
function getCacheConfigWithDefaults(config) {
  // Use optional chaining and provide defaults instead of throwing errors
  const cacheConfig = config?.CACHE || {};

  return {
    DEFAULT_MAX_ENTRIES: cacheConfig.DEFAULT_MAX_ENTRIES ?? 1000,
    DEFAULT_MAX_SIZE: cacheConfig.DEFAULT_MAX_SIZE ?? 1000, // Per-entry size limit
    MAX_MEMORY_MB: cacheConfig.MAX_MEMORY_MB ?? 50,
    DEFAULT_TTL_MS: cacheConfig.DEFAULT_TTL_MS ?? 300000, // 5 minutes
    CLEANUP_INTERVAL_MS: cacheConfig.CLEANUP_INTERVAL_MS ?? 60000, // 1 minute
  };
}

/**
 * Enhanced Cache Manager
 * Provides intelligent caching with TTL, LRU eviction, and memory management
 */
class EnhancedCache {
  constructor(options = {}) {
    // Validate config and set cache parameters with resilient defaults
    const validatedConfig = getCacheConfigWithDefaults(config);

    this.maxEntries = options.maxEntries || validatedConfig.DEFAULT_MAX_ENTRIES;
    this.maxSize = options.maxSize || validatedConfig.DEFAULT_MAX_SIZE; // Per-entry size limit
    this.maxMemory = options.maxMemory || validatedConfig.MAX_MEMORY_MB * 1024 * 1024;
    this.evictionStrategy = options.evictionStrategy || EVICTION_STRATEGIES.HYBRID;
    this.defaultTtl = options.defaultTtl || validatedConfig.DEFAULT_TTL_MS;
    this.cleanupInterval = options.cleanupInterval || validatedConfig.CLEANUP_INTERVAL_MS;

    // Cache storage
    this.entries = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.frequencyMap = new Map(); // For LFU tracking
    this.cleanupTimer = null; // Store cleanup interval ID

    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalMemory: 0,
      startTime: Date.now(),
    };

    // Start cleanup interval (not in test environment and cleanupInterval > 0)
    if (process.env.NODE_ENV !== 'test' && this.cleanupInterval > 0) {
      this.startCleanup();
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    try {
      const entry = this.entries.get(key);

      if (!entry) {
        this.metrics.misses++;
        return null;
      }

      // Check if expired
      if (entry.isExpired()) {
        this.delete(key);
        this.metrics.misses++;
        return null;
      }

      // Update access statistics
      entry.touch();
      this.updateAccessOrder(key);
      this.updateFrequency(key);

      this.metrics.hits++;
      return entry.value;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache get operation', { key });
      ErrorHandler.logError(errorResponse, { operation: 'cacheGet', key });
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Cache options
   * @returns {boolean} Success status
   */
  set(key, value, options = {}) {
    try {
      const ttl = options.ttl !== undefined ? options.ttl : this.defaultTtl;
      const tags = options.tags || [];

      // Remove existing entry if present
      if (this.entries.has(key)) {
        this.delete(key);
      }

      // Create new entry
      const entry = new CacheEntry(key, value, ttl);

      // Add tags
      tags.forEach((tag) => entry.addTag(tag));

      // Check if entry exceeds per-entry size limit
      if (this.maxSize && entry.size > this.maxSize) {
        this.metrics.sets++;
        return true; // Don't store oversized entries
      }

      // Check if entry is immediately expired (TTL = 0)
      if (entry.isExpired()) {
        this.metrics.sets++;
        return true; // Don't store expired entries
      }

      // Check if we need to evict entries
      this.ensureSpace(entry);

      // Add to cache
      this.entries.set(key, entry);
      this.updateAccessOrder(key);
      this.updateFrequency(key);
      this.updateMemoryMetrics();

      this.metrics.sets++;
      return true;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache set operation', {
        key,
        valueType: typeof value,
        options,
      });
      ErrorHandler.logError(errorResponse, { operation: 'cacheSet', key, options });
      return false;
    }
  }

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   * @returns {boolean} Success status
   */
  delete(key) {
    try {
      const entry = this.entries.get(key);
      if (!entry) return false;

      this.entries.delete(key);
      this.accessOrder.delete(key);
      this.frequencyMap.delete(key);
      this.updateMemoryMetrics();

      this.metrics.deletes++;
      return true;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache delete operation', { key });
      ErrorHandler.logError(errorResponse, { operation: 'cacheDelete', key });
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    try {
      this.entries.clear();
      this.accessOrder.clear();
      this.frequencyMap.clear();
      this.metrics.totalMemory = 0;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache clear operation');
      ErrorHandler.logError(errorResponse, { operation: 'cacheClear' });
    }
  }

  /**
   * Invalidate entries by tag
   * @param {string} tag - Tag to invalidate
   * @returns {number} Number of entries invalidated
   */
  invalidateByTag(tag) {
    try {
      let invalidated = 0;

      for (const [key, entry] of this.entries.entries()) {
        if (entry.tags.has(tag)) {
          this.delete(key);
          invalidated++;
        }
      }

      return invalidated;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache tag invalidation', { tag });
      ErrorHandler.logError(errorResponse, { operation: 'cacheTagInvalidation', tag });
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache metrics
   */
  getStats() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    const hitRate =
      this.metrics.hits + this.metrics.misses > 0
        ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
        : 0;

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      entryCount: this.entries.size,
      memoryUsage: this.metrics.totalMemory,
      memoryUsageFormatted: this.formatBytes(this.metrics.totalMemory),
      maxSize: this.maxSize,
      maxEntries: this.maxEntries,
      maxMemory: this.maxMemory,
      maxMemoryFormatted: this.formatBytes(this.maxMemory),
      evictionStrategy: this.evictionStrategy,
    };
  }

  /**
   * Get detailed cache information
   * @returns {Object} Detailed cache info
   */
  getDetailedInfo() {
    const stats = this.getStats();
    const entries = [];

    for (const [key, entry] of this.entries.entries()) {
      entries.push({
        key,
        value: entry.value,
        age: Date.now() - entry.createdAt,
        lastAccessed: entry.lastAccessed,
        accessCount: entry.accessCount,
        size: entry.size,
        tags: Array.from(entry.tags),
        isExpired: entry.isExpired(),
      });
    }

    return {
      stats,
      entries: entries.toSorted((a, b) => b.lastAccessed - a.lastAccessed), // Sort by most recent access
    };
  }

  /**
   * Ensure there's space for a new entry
   * @param {CacheEntry} newEntry - New entry to add
   */
  ensureSpace(newEntry) {
    // Check if we're under limits
    if (
      this.entries.size < this.maxEntries &&
      this.metrics.totalMemory + newEntry.size <= this.maxMemory
    ) {
      return; // No eviction needed
    }

    // If we're at or will exceed the limit, evict before adding
    if (
      this.entries.size >= this.maxEntries ||
      this.metrics.totalMemory + newEntry.size > this.maxMemory
    ) {
      // Perform eviction based on strategy
      switch (this.evictionStrategy) {
      case EVICTION_STRATEGIES.LRU:
        this.evictLRU();
        break;
      case EVICTION_STRATEGIES.LFU:
        this.evictLFU();
        break;
      case EVICTION_STRATEGIES.TTL:
        this.evictExpired();
        break;
      case EVICTION_STRATEGIES.SIZE_BASED:
        this.evictBySize();
        break;
      case EVICTION_STRATEGIES.HYBRID:
      default:
        this.evictHybrid();
        break;
      }
    }
  }

  /**
   * Evict least recently used entries
   */
  evictLRU() {
    // Evict enough entries to make room for new ones
    const entriesToEvict = Math.max(1, Math.ceil(this.maxEntries * 0.1)); // At least 1, or 10%
    const sortedByAccess = Array.from(this.accessOrder.entries()).toSorted((a, b) => a[1] - b[1]);

    for (let i = 0; i < entriesToEvict && i < sortedByAccess.length; i++) {
      const key = sortedByAccess[i][0];
      this.delete(key);
      this.metrics.evictions++;
    }
  }

  /**
   * Evict least frequently used entries
   */
  evictLFU() {
    const entriesToEvict = Math.ceil(this.maxEntries * 0.1); // Evict 10%
    const sortedByFrequency = Array.from(this.frequencyMap.entries()).toSorted(
      (a, b) => a[1] - b[1]
    );

    for (let i = 0; i < entriesToEvict && i < sortedByFrequency.length; i++) {
      const key = sortedByFrequency[i][0];
      this.delete(key);
      this.metrics.evictions++;
    }
  }

  /**
   * Evict expired entries
   */
  evictExpired() {
    const keysToDelete = [];

    for (const [key, entry] of this.entries.entries()) {
      if (entry.isExpired()) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.delete(key);
      this.metrics.evictions++;
    });
  }

  /**
   * Evict by memory size
   */
  evictBySize() {
    const targetMemory = this.maxMemory * 0.8; // Reduce to 80% of max

    while (this.metrics.totalMemory > targetMemory && this.entries.size > 0) {
      // Find largest entry
      let largestKey = null;
      let largestSize = 0;

      for (const [key, entry] of this.entries.entries()) {
        if (entry.size > largestSize) {
          largestSize = entry.size;
          largestKey = key;
        }
      }

      if (largestKey) {
        this.delete(largestKey);
        this.metrics.evictions++;
      } else {
        break; // Prevent infinite loop
      }
    }
  }

  /**
   * Hybrid eviction strategy
   */
  evictHybrid() {
    // First, remove expired entries
    this.evictExpired();

    // If still over limits, use LRU
    if (this.entries.size >= this.maxSize || this.metrics.totalMemory >= this.maxMemory) {
      this.evictLRU();
    }
  }

  /**
   * Update access order for LRU
   * @param {string} key - Cache key
   */
  updateAccessOrder(key) {
    // Use a counter to ensure proper ordering for LRU
    this.accessCounter = (this.accessCounter || 0) + 1;
    this.accessOrder.set(key, this.accessCounter);
  }

  /**
   * Update frequency map for LFU
   * @param {string} key - Cache key
   */
  updateFrequency(key) {
    const current = this.frequencyMap.get(key) || 0;
    this.frequencyMap.set(key, current + 1);
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    let totalMemory = 0;
    for (const entry of this.entries.values()) {
      totalMemory += entry.size;
    }
    this.metrics.totalMemory = totalMemory;
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    if (process.env.NODE_ENV === 'test') {
      return; // Don't start cleanup in test environment
    }

    if (this.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.cleanupInterval);
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    try {
      this.evictExpired();
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache cleanup');
      ErrorHandler.logError(errorResponse, { operation: 'cacheCleanup' });
    }
  }

  /**
   * Format uptime in human-readable format
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format bytes in human-readable format
   * @param {number} bytes - Bytes
   * @returns {string} Formatted size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = {
  EnhancedCache,
  EVICTION_STRATEGIES,
  CacheEntry,
};
