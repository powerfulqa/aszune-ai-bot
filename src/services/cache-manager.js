/**
 * Cache Manager for handling response caching
 * Manages cache operations, configuration, and cleanup
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');
const { EnhancedCache, EVICTION_STRATEGIES } = require('../utils/enhanced-cache');
const { getCacheStatsErrorResponse } = require('../utils/cache-stats-helper');

// Cache management constants
const CACHE_EVICTION_PERCENTAGE = 0.1; // Remove 10% when cache full
const FILE_PERMISSIONS_SECURE = 0o600; // Secure file permissions (owner read/write only)
const JSON_INDENT_LEVEL = 2; // JSON indentation for readability

/**
 * Cache Manager class for handling response caching
 */
class CacheManager {
  constructor() {
    this.cache = new EnhancedCache({
      maxSize: config.CACHE.DEFAULT_MAX_ENTRIES,
      maxMemory: config.CACHE.MAX_MEMORY_MB * 1024 * 1024,
      evictionStrategy: EVICTION_STRATEGIES.HYBRID,
      defaultTtl: config.CACHE.DEFAULT_TTL_MS,
      cleanupInterval: config.CACHE.CLEANUP_INTERVAL_MS,
    });

    this.cacheCleanupInterval = null;
    this.setupCacheCleanup();
  }

  /**
   * Setup cache cleanup interval
   */
  setupCacheCleanup() {
    if (process.env.NODE_ENV === 'test') {
      return; // Skip in test environment
    }

    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache().catch((error) => {
        const errorResponse = ErrorHandler.handleError(error, 'cache cleanup');
        logger.warn(`Cache cleanup error: ${errorResponse.message}`);
      });
    }, config.CACHE.CLEANUP_INTERVAL_MS);

    // Ensure this background interval never prevents process exit (esp. in tests)
    if (
      this.cacheCleanupInterval &&
      typeof this.cacheCleanupInterval.unref === 'function'
    ) {
      this.cacheCleanupInterval.unref();
    }
  }

  /**
   * Get cache configuration
   * @returns {Object} Cache configuration
   */
  getCacheConfiguration() {
    const defaultConfig = {
      enabled: false,
      maxEntries: config.CACHE.DEFAULT_MAX_ENTRIES,
    };

    try {
      if (config?.PI_OPTIMIZATIONS?.ENABLED) {
        return {
          enabled: Boolean(config.PI_OPTIMIZATIONS.CACHE_ENABLED),
          maxEntries:
            typeof config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES === 'number'
              ? config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES
              : defaultConfig.maxEntries,
        };
      }
    } catch (configError) {
      const errorResponse = ErrorHandler.handleError(configError, 'accessing cache config');
      logger.warn(`Cache config error: ${errorResponse.message}`);
    }

    return defaultConfig;
  }

  /**
   * Determine if caching should be used
   * @param {Object} options - Request options
   * @param {Object} cacheConfig - Cache configuration
   * @returns {boolean} True if caching should be used
   */
  shouldUseCache(options, cacheConfig) {
    return Boolean(options.caching !== false && cacheConfig.enabled);
  }

  /**
   * Generate cache key from conversation history
   * @param {Array} history - Conversation history
   * @returns {string} Cache key
   */
  generateCacheKey(history) {
    if (!history || !Array.isArray(history)) {
      return '';
    }

    const historyString = JSON.stringify(history);
    return crypto.createHash('sha256').update(historyString).digest('hex');
  }

  /**
   * Try to get response from cache
   * @param {Array} history - Conversation history
   * @returns {Promise<string|null>} Cached content or null
   */
  async tryGetFromCache(history) {
    try {
      const cacheKey = this.generateCacheKey(history);
      if (!cacheKey) return null;

      const cachedResponse = this.cache.get(cacheKey);
      return cachedResponse || null;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting from cache');
      logger.warn(`Cache get error: ${errorResponse.message}`);
      return null;
    }
  }

  /**
   * Try to save response to cache
   * @param {Array} history - Conversation history
   * @param {string} content - Response content
   * @param {number} maxEntries - Maximum cache entries
   */
  async trySaveToCache(history, content, maxEntries) {
    try {
      const cacheKey = this.generateCacheKey(history);
      if (!cacheKey || !content) return;

      // Check cache size and cleanup if needed
      await this.ensureCacheSize(maxEntries);

      this.cache.set(cacheKey, content);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'saving to cache');
      logger.warn(`Cache save error: ${errorResponse.message}`);
    }
  }

  /**
   * Ensure cache doesn't exceed max entries
   * @param {number} maxEntries - Maximum entries allowed
   */
  async ensureCacheSize(maxEntries) {
    const cacheStats = this.cache.getStats();

    if (cacheStats.totalEntries >= maxEntries) {
      // Remove oldest entries to make room
      const entriesToRemove = Math.floor(maxEntries * CACHE_EVICTION_PERCENTAGE);
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.evictOldest();
      }
    }
  }

  /**
   * Cleanup cache
   */
  async cleanupCache() {
    try {
      // Try to get cache pruner if available
      const cachePruner = await this.getCachePruner();
      if (cachePruner) {
        await cachePruner.pruneCache();
      }
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'cache cleanup');
      logger.warn(`Cache cleanup error: ${errorResponse.message}`);
    }
  }

  /**
   * Get cache pruner (lazy loaded)
   * @returns {Promise<Object|null>} Cache pruner or null
   */
  async getCachePruner() {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    try {
      const cachePrunerModule = require('../utils/cache-pruner');

      // Most common shape: singleton instance exporting pruneCache()
      if (cachePrunerModule && typeof cachePrunerModule.pruneCache === 'function') {
        return cachePrunerModule;
      }

      // Backward-compatible support if a class export exists
      if (cachePrunerModule && typeof cachePrunerModule.CachePruner === 'function') {
        return new cachePrunerModule.CachePruner();
      }

      return null;
    } catch {
      return null; // Cache pruner not available
    }
  }

  /**
   * Load cache from file
   * @returns {Promise<Object>} Cache object
   */
  async loadCache() {
    const cacheDir = path.join(process.cwd(), 'data');
    const cachePath = path.join(cacheDir, 'question_cache.json');

    try {
      // Ensure cache directory exists
      await fs.mkdir(cacheDir, { recursive: true });

      const data = await fs.readFile(cachePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // Return empty cache if file doesn't exist
      }

      const errorResponse = ErrorHandler.handleError(error, 'loading cache');
      logger.warn(`Cache load error: ${errorResponse.message}`);
      return {};
    }
  }

  /**
   * Save cache to file
   * @param {Object} cache - Cache object to save
   */
  async saveCache(cache) {
    const cacheDir = path.join(process.cwd(), 'data');
    const cachePath = path.join(cacheDir, 'question_cache.json');

    try {
      // Ensure cache directory exists
      await fs.mkdir(cacheDir, { recursive: true });

      await fs.writeFile(cachePath, JSON.stringify(cache, null, JSON_INDENT_LEVEL), {
        mode: FILE_PERMISSIONS_SECURE,
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'saving cache');
      logger.error(`Cache save error: ${errorResponse.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    try {
      return this.cache.getStats();
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting cache statistics');
      logger.error(`Cache stats error: ${errorResponse.message}`);
      return getCacheStatsErrorResponse(errorResponse.message);
    }
  }

  /**
   * Get detailed cache information
   * @returns {Object} Detailed cache information
   */
  getDetailedInfo() {
    try {
      return this.cache.getDetailedInfo();
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting detailed cache info');
      logger.error(`Detailed cache info error: ${errorResponse.message}`);
      return {
        error: errorResponse.message,
        stats: this.getStats(),
        entries: [],
      };
    }
  }

  /**
   * Invalidate cache entries by tag
   * @param {string} tag - Tag to invalidate
   * @returns {number} Number of entries invalidated
   */
  invalidateByTag(tag) {
    try {
      return this.cache.invalidateByTag(tag);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'invalidating cache by tag', { tag });
      logger.error(`Cache tag invalidation error: ${errorResponse.message}`);
      return 0;
    }
  }

  /**
   * Shutdown cache manager
   */
  shutdown() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
  }
}

module.exports = { CacheManager };
