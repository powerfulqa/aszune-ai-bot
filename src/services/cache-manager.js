/**
 * Cache Manager for handling response caching
 * Manages cache operations, configuration, and cleanup
 */
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');
const { EnhancedCache, EVICTION_STRATEGIES } = require('../utils/enhanced-cache');
const { getCacheStatsErrorResponse } = require('../utils/cache-stats-helper');

// Cache management constants

/**
 * Cache Manager class for handling response caching
 */
class CacheManager {
  constructor() {
    this.cache = new EnhancedCache({
      maxEntries: config.CACHE.DEFAULT_MAX_ENTRIES,
      // Per-entry byte limit; a full answer with its source footer is a few KB.
      maxSize: 64 * 1024,
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
    if (this.cacheCleanupInterval && typeof this.cacheCleanupInterval.unref === 'function') {
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
   */
  async trySaveToCache(history, content) {
    try {
      const cacheKey = this.generateCacheKey(history);
      if (!cacheKey || !content) return;

      this.cache.set(cacheKey, content);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'saving to cache');
      logger.warn(`Cache save error: ${errorResponse.message}`);
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
