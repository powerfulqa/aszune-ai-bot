/**
 * Log Buffer Module for Web Dashboard
 *
 * Handles log interception, buffering, and filtering for the dashboard.
 * Extracts log-related functionality from the main dashboard service.
 *
 * @module services/web-dashboard/log-buffer
 */

const logger = require('../../utils/logger');

class LogBuffer {
  constructor(options = {}) {
    this.errorLogs = [];
    this.allLogs = [];
    this.maxErrorLogs = options.maxErrorLogs || 75;
    this.maxAllLogs = options.maxAllLogs || 500;
    this.io = null; // Socket.io instance for broadcasting
    this._originalLogMethods = {};
  }

  /**
   * Set Socket.io instance for log broadcasting
   * @param {Object} io - Socket.io server instance
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Setup error logging interception
   * Intercepts logger.error calls to track errors for dashboard
   */
  setupErrorInterception() {
    const originalError = logger.error.bind(logger);
    this._originalLogMethods.error = originalError;

    const self = this;
    logger.error = (message, error) => {
      // Add to error log buffer
      self.errorLogs.push({
        timestamp: new Date().toISOString(),
        message,
        error: error ? error.message || String(error) : null,
      });

      // Keep only last N errors
      if (self.errorLogs.length > self.maxErrorLogs) {
        self.errorLogs.shift();
      }

      // Call original error method
      return originalError(message, error);
    };
  }

  /**
   * Setup comprehensive log interception for all log levels
   */
  setupLogInterception() {
    const self = this;

    // Intercept all log methods
    ['debug', 'info', 'warn', 'error'].forEach((level) => {
      const originalMethod = logger[level].bind(logger);
      if (!this._originalLogMethods[level]) {
        this._originalLogMethods[level] = originalMethod;
      }

      logger[level] = function (message, error) {
        // Add to all logs buffer with timestamp and level
        self.allLogs.push({
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          message: typeof message === 'string' ? message : String(message),
          error: error ? error.message || String(error) : null,
        });

        // Keep only last N logs
        if (self.allLogs.length > self.maxAllLogs) {
          self.allLogs.shift();
        }

        // Broadcast to all connected log viewers
        if (self.io) {
          self.io.emit('log:new', {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: typeof message === 'string' ? message : String(message),
          });
        }

        // Call original method
        return self._originalLogMethods[level].apply(logger, arguments);
      };
    });
  }

  /**
   * Get filtered logs with pagination
   * @param {string} levelFilter - Filter by log level (DEBUG, INFO, WARN, ERROR, or null for all)
   * @param {number} limit - Number of logs to return
   * @param {number} offset - Offset for pagination
   * @returns {Array} Filtered logs
   */
  getFilteredLogs(levelFilter = null, limit = 100, offset = 0) {
    let filtered = this.allLogs;

    if (levelFilter && levelFilter !== 'ALL') {
      filtered = filtered.filter((log) => log.level === levelFilter.toUpperCase());
    }

    // Apply pagination (from end, most recent first)
    const startIndex = Math.max(0, filtered.length - offset - limit);
    const endIndex = filtered.length - offset;

    return filtered.slice(startIndex, endIndex).reverse();
  }

  /**
   * Search logs by text
   * @param {string} query - Search query
   * @param {string} levelFilter - Optional level filter
   * @param {number} limit - Max results
   * @returns {Array} Matching logs
   */
  searchLogs(query, levelFilter = null, limit = 100) {
    const queryLower = query.toLowerCase();
    let results = this.allLogs.filter(
      (log) =>
        log.message.toLowerCase().includes(queryLower) ||
        (log.error && log.error.toLowerCase().includes(queryLower))
    );

    if (levelFilter && levelFilter !== 'ALL') {
      results = results.filter((log) => log.level === levelFilter.toUpperCase());
    }

    return results.slice(-limit).reverse();
  }

  /**
   * Get error logs
   * @returns {Array} Error logs buffer
   */
  getErrorLogs() {
    return [...this.errorLogs];
  }

  /**
   * Get all logs
   * @returns {Array} All logs buffer
   */
  getAllLogs() {
    return [...this.allLogs];
  }

  /**
   * Clear all log buffers
   */
  clear() {
    this.errorLogs = [];
    this.allLogs = [];
  }
}

module.exports = LogBuffer;
