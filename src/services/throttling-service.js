/**
 * Throttling Service for managing request throttling
 * Handles connection throttling and rate limiting
 */
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');

/**
 * Throttling Service class for managing request throttling
 */
class ThrottlingService {
  constructor() {
    this.connectionThrottler = null;
    this.initializeThrottler();
  }

  /**
   * Initialize connection throttler (lazy loaded)
   */
  initializeThrottler() {
    try {
      const { ConnectionThrottler } = require('../utils/connection-throttler');
      this.connectionThrottler = new ConnectionThrottler();
    } catch (error) {
      // Throttler not available, continue without it
      this.connectionThrottler = null;
    }
  }

  /**
   * Execute request with throttling if available
   * @param {Function} requestFn - Request function to execute
   * @returns {Promise<Object>} API response
   */
  async executeWithThrottling(requestFn) {
    try {
      if (this.connectionThrottler) {
        return await this.connectionThrottler.executeRequest(requestFn);
      } else {
        // No throttler available, execute directly
        return await requestFn();
      }
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'throttled request execution');
      logger.error(`Throttled request failed: ${errorResponse.message}`);
      throw error;
    }
  }

  /**
   * Check if throttling is enabled
   * @returns {boolean} True if throttling is enabled
   */
  isThrottlingEnabled() {
    return this.connectionThrottler !== null;
  }

  /**
   * Get throttler status
   * @returns {Object} Throttler status information
   */
  getThrottlerStatus() {
    return {
      enabled: this.isThrottlingEnabled(),
      available: this.connectionThrottler !== null,
    };
  }
}

module.exports = { ThrottlingService };
