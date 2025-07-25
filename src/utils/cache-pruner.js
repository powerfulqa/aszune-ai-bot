/**
 * Cache pruning utility to manage cache size on Pi
 * Automatically removes least used entries to save memory
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/config');

class CachePruner {
  constructor() {
    this.cacheFiles = {
      questions: path.join(__dirname, '../../data/question_cache.json'),
      stats: path.join(__dirname, '../../data/user_stats.json')
    };
    
    // Initialize with default settings
    this.maxCacheEntries = config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES || 100;
    this.pruneIntervalMinutes = config.PI_OPTIMIZATIONS.CLEANUP_INTERVAL_MINUTES || 30;
    this.prunePercentage = 0.2; // Remove 20% of entries when pruning
    this.lastPruneTime = Date.now();
    
    // Start pruning timer if enabled
    if (config.PI_OPTIMIZATIONS.ENABLED) {
      this._initializePruningSchedule();
    }
  }

  /**
   * Initialize the pruning schedule
   * @private
   */
  _initializePruningSchedule() {
    const intervalMs = this.pruneIntervalMinutes * 60 * 1000;
    
    // Use a simple interval rather than a full scheduler to save resources
    setInterval(() => {
      this.pruneCache()
        .catch(err => logger.error('[CachePruner] Error during scheduled pruning:', err));
    }, intervalMs);
    
    logger.info(`[CachePruner] Initialized with ${this.pruneIntervalMinutes} minute interval`);
  }
  
  /**
   * Prune the cache files to maintain reasonable size
   * @returns {Promise<void>}
   */
  async pruneCache() {
    logger.info('[CachePruner] Starting cache pruning process...');
    this.lastPruneTime = Date.now();
    
    try {
      // Prune question cache
      await this._pruneQuestionCache();
      
      // Prune user stats (less aggressive)
      await this._pruneUserStats();
      
      logger.info('[CachePruner] Cache pruning completed successfully');
    } catch (error) {
      logger.error('[CachePruner] Error during cache pruning:', error);
      throw error;
    }
  }
  
  /**
   * Prune the question cache file
   * @private
   * @returns {Promise<void>}
   */
  async _pruneQuestionCache() {
    try {
      // Read the cache file
      const data = await fs.readFile(this.cacheFiles.questions, 'utf-8');
      const cache = JSON.parse(data);
      
      const entryCount = Object.keys(cache).length;
      
      // Only prune if we're over the limit
      if (entryCount <= this.maxCacheEntries) {
        logger.debug(`[CachePruner] Question cache size (${entryCount}) within limits, no pruning needed`);
        return;
      }
      
      // Sort entries by last access time
      const sortedEntries = Object.entries(cache)
        .sort(([, a], [, b]) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      
      // Calculate how many to remove
      const removeCount = Math.ceil(entryCount * this.prunePercentage);
      
      // Remove oldest entries
      const entriesToRemove = sortedEntries.slice(0, removeCount);
      entriesToRemove.forEach(([key]) => {
        delete cache[key];
      });
      
      // Write back pruned cache
      await fs.writeFile(this.cacheFiles.questions, JSON.stringify(cache, null, 2));
      
      logger.info(`[CachePruner] Pruned ${removeCount} entries from question cache`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('[CachePruner] Question cache file not found, nothing to prune');
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Prune the user stats file
   * @private
   * @returns {Promise<void>}
   */
  async _pruneUserStats() {
    try {
      // Read the stats file
      const data = await fs.readFile(this.cacheFiles.stats, 'utf-8');
      const stats = JSON.parse(data);
      
      // Get inactive users (no activity in last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      let pruneCount = 0;
      
      Object.entries(stats).forEach(([userId, userData]) => {
        const lastActivity = userData.lastActivity || 0;
        
        // Remove inactive users with fewer than 5 interactions
        if (lastActivity < thirtyDaysAgo && userData.totalQueries < 5) {
          delete stats[userId];
          pruneCount++;
        }
      });
      
      if (pruneCount > 0) {
        // Write back pruned stats
        await fs.writeFile(this.cacheFiles.stats, JSON.stringify(stats, null, 2));
        logger.info(`[CachePruner] Pruned ${pruneCount} inactive users from stats`);
      } else {
        logger.debug('[CachePruner] No inactive users to prune from stats');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('[CachePruner] User stats file not found, nothing to prune');
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Get status of the cache pruner
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      lastPruneTime: this.lastPruneTime,
      nextPruneTime: this.lastPruneTime + (this.pruneIntervalMinutes * 60 * 1000),
      maxCacheEntries: this.maxCacheEntries,
      prunePercentage: this.prunePercentage,
    };
  }
}

module.exports = new CachePruner();
