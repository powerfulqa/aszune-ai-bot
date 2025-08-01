/**
 * Memory Monitor
 * Monitors memory usage and can trigger garbage collection when needed
 */

const logger = require('./logger');

class MemoryMonitor {
  constructor() {
    this.initialized = false;
    this.memoryLimit = process.env.PI_MEMORY_LIMIT ? parseInt(process.env.PI_MEMORY_LIMIT, 10) * 1024 * 1024 : 200 * 1024 * 1024;
    this.criticalMemory = process.env.PI_MEMORY_CRITICAL ? parseInt(process.env.PI_MEMORY_CRITICAL, 10) * 1024 * 1024 : 250 * 1024 * 1024;
    this.checkIntervalMs = 60000; // Check every minute
    this.checkInterval = null;
    this.lastGcTime = 0;
    this.isLowMemory = false;
  }

  /**
   * Initialize the memory monitor
   */
  initialize() {
    if (this.initialized) return;
    
    logger.debug('Initializing memory monitor...');
    this.checkMemoryUsage();
    
    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkIntervalMs);
    
    // Make sure interval doesn't keep process alive
    this.checkInterval.unref();
    
    this.initialized = true;
    logger.debug('Memory monitor initialized');
  }

  /**
   * Shut down the memory monitor
   */
  shutdown() {
    if (!this.initialized) return;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.initialized = false;
    logger.debug('Memory monitor shut down');
  }

  /**
   * Check current memory usage and trigger GC if needed
   */
  checkMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed;
      
      // If memory usage exceeds limit, try to free some memory
      if (heapUsed > this.memoryLimit) {
        logger.warn(`High memory usage detected: ${Math.round(heapUsed / 1024 / 1024)}MB used`);
        this.isLowMemory = true;
        this.forceGarbageCollection();
      } else if (this.isLowMemory && heapUsed < this.memoryLimit * 0.8) {
        // If we were in low memory mode but have recovered, reset the flag
        logger.info(`Memory usage has normalized: ${Math.round(heapUsed / 1024 / 1024)}MB used`);
        this.isLowMemory = false;
      }
      
      // For critical memory situations, log a more urgent warning
      if (heapUsed > this.criticalMemory) {
        logger.error(`CRITICAL MEMORY USAGE: ${Math.round(heapUsed / 1024 / 1024)}MB used!`);
      }
    } catch (error) {
      logger.error('Error checking memory usage:', error);
    }
  }

  /**
   * Attempt to force garbage collection
   */
  forceGarbageCollection() {
    try {
      // Only try to GC every 30 seconds at most
      const now = Date.now();
      if (now - this.lastGcTime < 30000) return;
      
      // Try different methods to encourage garbage collection
      this.lastGcTime = now;
      
      // First method: Force nodejs to consider GC
      if (global.gc) {
        logger.debug('Running global.gc()');
        global.gc();
      }
      
      // Second method: Create temporary pressure then release
      const pressure = [];
      for (let i = 0; i < 10; i++) {
        pressure.push(new Array(1000000).fill('x'));
      }
      pressure.length = 0;
      
      logger.debug('Memory cleanup attempted');
    } catch (error) {
      logger.error('Error during garbage collection:', error);
    }
  }

  /**
   * Get current memory usage
   * @returns {Object} Memory usage stats
   */
  getMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      return {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        percentUsed: Math.round((memUsage.heapUsed / this.memoryLimit) * 100),
        isLowMemory: this.isLowMemory
      };
    } catch (error) {
      logger.error('Error getting memory usage:', error);
      return {};
    }
  }

  /**
   * Get monitor status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      memoryUsage: this.getMemoryUsage(),
      memoryLimit: this.memoryLimit,
      criticalMemory: this.criticalMemory,
      lastGcTime: this.lastGcTime,
      isLowMemory: this.isLowMemory
    };
  }
}

module.exports = new MemoryMonitor();
