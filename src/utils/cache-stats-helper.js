/**
 * Cache Statistics Helper Utilities
 * Shared functions for cache stats error responses and formatting
 * Eliminates code duplication across services
 */

/**
 * Default cache stats values - single source of truth
 * @private
 */
const DEFAULT_CACHE_STATS = {
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
};

/**
 * Get default cache stats error response object
 * @param {Error|string} error - Error message or object
 * @returns {Object} Complete cache stats object with error defaults
 */
function getCacheStatsErrorResponse(error) {
  const errorMessage =
    typeof error === 'string' ? error : error?.message || 'An unexpected error occurred';

  return {
    ...DEFAULT_CACHE_STATS,
    error: errorMessage,
  };
}

/**
 * Get empty cache stats object (for uninitialized cache)
 * @returns {Object} Empty cache stats with safe defaults
 */
function getEmptyCacheStats() {
  return { ...DEFAULT_CACHE_STATS };
}

module.exports = {
  getCacheStatsErrorResponse,
  getEmptyCacheStats,
};
