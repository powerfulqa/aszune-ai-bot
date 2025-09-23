/**
 * Process performance monitor for Raspberry Pi
 * Monitors CPU and process usage, applying automatic throttling when needed
 */
const os = require('os');
const logger = require('./logger');
const config = require('../config/config');
const { ErrorHandler } = require('./error-handler');

class PerformanceMonitor {
  constructor() {
    this.enabled = config.PI_OPTIMIZATIONS.ENABLED;
    this.checkInterval = null;
    this.highLoadCount = 0;
    this.lastCpuInfo = null;
    this.lastCpuTimes = { idle: 0, total: 0 };
    this.cpuThreshold = 0.8; // 80% CPU usage threshold
    this.consecutiveThreshold = 5; // How many consecutive high readings before action
    this.throttleFactor = 1; // Current throttling factor (1 = normal, >1 = throttled)
    this.maxThrottleFactor = 5; // Maximum delay factor

    // Minimum valid interval
    this.minValidInterval = config.PERFORMANCE.MIN_VALID_INTERVAL_MS;

    // Exponential backoff parameters
    this.backoffFactor = 1.5;
    this.backoffMax = config.PERFORMANCE.BACKOFF_MAX_MS;
    this.backoffMin = config.PERFORMANCE.BACKOFF_MIN_MS;
    this.currentBackoff = this.backoffMin;
  }

  /**
   * Start the performance monitoring
   */
  initialize() {
    if (!this.enabled) {
      logger.debug('[PerformanceMonitor] Performance monitoring disabled');
      return;
    }

    // Only monitor in production to avoid affecting development/testing
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('[PerformanceMonitor] Skipping initialization for non-production environment');
      return;
    }

    // Take initial CPU snapshot
    this.lastCpuInfo = this._getCpuInfo();

    // Start monitoring at 5-second intervals
    this.checkInterval = setInterval(
      () => this._checkPerformance(),
      config.PERFORMANCE.CHECK_INTERVAL_MS
    );
    logger.info('[PerformanceMonitor] Performance monitoring initialized');
  }

  /**
   * Stop the performance monitoring
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current throttle factor for operations
   * @returns {number} - Current throttle factor (1 = normal, >1 = throttled)
   */
  getThrottleFactor() {
    return this.enabled ? this.throttleFactor : 1;
  }

  /**
   * Apply throttling to a time value
   * @param {number} ms - Original time in milliseconds
   * @returns {number} - Throttled time in milliseconds
   */
  throttleTime(ms) {
    if (!this.enabled || ms < this.minValidInterval) return ms;
    return Math.min(ms * this.throttleFactor, this.backoffMax);
  }

  /**
   * Apply throttling to a task - delays execution based on current system load
   * @param {Function} task - The task function to execute
   * @returns {Promise} - Promise resolving to the task result
   */
  async throttleTask(task) {
    if (!this.enabled) return task();

    const delay = this.currentBackoff * (this.throttleFactor - 1);

    if (delay > 0) {
      logger.debug(
        `[PerformanceMonitor] Throttling task by ${delay}ms (factor: ${this.throttleFactor.toFixed(1)})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return task();
  }

  /**
   * Check the current performance metrics and adjust throttling
   * @private
   */
  _checkPerformance() {
    try {
      // Get current CPU usage
      const cpuInfo = this._getCpuInfo();
      const cpuUsage = this._calculateCpuUsage(this.lastCpuInfo, cpuInfo);
      this.lastCpuInfo = cpuInfo;

      // Get process memory usage
      const memoryUsage = this._getMemoryUsage();

      // Check if we're under high load
      const highLoad = cpuUsage > this.cpuThreshold;

      // Update consecutive counter
      if (highLoad) {
        this.highLoadCount++;
      } else if (this.highLoadCount > 0) {
        this.highLoadCount--;
      }

      // Adjust throttling based on load patterns
      this._adjustThrottling();

      // Log current status (only if significant changes)
      if (highLoad || this.throttleFactor > 1.5) {
        logger.info(
          `[PerformanceMonitor] CPU: ${(cpuUsage * 100).toFixed(1)}%, Memory: ${memoryUsage.toFixed(1)}%, Throttle: ${this.throttleFactor.toFixed(1)}x`
        );
      }
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'performance monitoring', {
        throttleFactor: this.throttleFactor,
        isThrottled: this.isThrottled,
      });
      logger.error(`[PerformanceMonitor] Performance check error: ${errorResponse.message}`);
    }
  }

  /**
   * Adjust the throttling factor based on current load patterns
   * @private
   */
  _adjustThrottling() {
    if (this.highLoadCount >= this.consecutiveThreshold) {
      // Increase throttling with exponential backoff
      this.throttleFactor = Math.min(
        this.throttleFactor * this.backoffFactor,
        this.maxThrottleFactor
      );
      this.currentBackoff = Math.min(this.currentBackoff * this.backoffFactor, this.backoffMax);

      if (this.highLoadCount === this.consecutiveThreshold) {
        logger.warn(
          `[PerformanceMonitor] High system load detected, throttling by ${this.throttleFactor.toFixed(1)}x`
        );
      }
    } else if (this.highLoadCount === 0 && this.throttleFactor > 1) {
      // Gradually reduce throttling when load is low
      this.throttleFactor = Math.max(1, this.throttleFactor / this.backoffFactor);
      this.currentBackoff = Math.max(this.backoffMin, this.currentBackoff / this.backoffFactor);

      if (this.throttleFactor === 1) {
        logger.info('[PerformanceMonitor] System load normalized, removing throttling');
      }
    }
  }

  /**
   * Get current CPU information
   * @private
   * @returns {Object} - CPU info
   */
  _getCpuInfo() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }

    return { idle, total };
  }

  /**
   * Calculate CPU usage percentage
   * @private
   * @param {Object} startInfo - Starting CPU info
   * @param {Object} endInfo - Ending CPU info
   * @returns {number} - CPU usage as decimal (0-1)
   */
  _calculateCpuUsage(startInfo, endInfo) {
    const idleDiff = endInfo.idle - startInfo.idle;
    const totalDiff = endInfo.total - startInfo.total;

    // Avoid division by zero
    if (totalDiff === 0) return 0;

    // Calculate usage (1 - idle percentage)
    return 1 - idleDiff / totalDiff;
  }

  /**
   * Get process memory usage as percentage of total
   * @private
   * @returns {number} - Memory usage as decimal (0-1)
   */
  _getMemoryUsage() {
    const used = process.memoryUsage().rss;
    const total = os.totalmem();
    return used / total;
  }
}

module.exports = new PerformanceMonitor();
