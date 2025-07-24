/**
 * Connection throttler to manage network requests on Pi
 * Helps prevent network overload on resource-constrained devices
 */
const logger = require('./logger');
const config = require('../config/config');

class ConnectionThrottler {
  constructor() {
    this.activeConnections = 0;
    this.connectionQueue = [];
    this.maxConnections = config.PI_OPTIMIZATIONS.ENABLED ? 
      (config.PI_OPTIMIZATIONS.MAX_CONCURRENT_CONNECTIONS || 2) : 10;
  }

  /**
   * Execute a network request through the throttler
   * @param {Function} requestFn - Async function that makes the network request
   * @param {String} requestType - Type of request for logging
   * @returns {Promise} - Result of the request function
   */
  async executeRequest(requestFn, requestType = 'API') {
    return new Promise((resolve, reject) => {
      const executeNow = this.activeConnections < this.maxConnections;
      
      // Create a task to execute
      const task = async () => {
        try {
          this.activeConnections++;
          logger.debug(`[ConnectionThrottler] Starting ${requestType} request (${this.activeConnections}/${this.maxConnections} active)`);
          
          const result = await requestFn();
          
          this.activeConnections--;
          logger.debug(`[ConnectionThrottler] Completed ${requestType} request (${this.activeConnections}/${this.maxConnections} active)`);
          
          // Process next in queue if any
          this._processQueue();
          
          resolve(result);
        } catch (error) {
          this.activeConnections--;
          logger.error(`[ConnectionThrottler] Error in ${requestType} request:`, error);
          
          // Process next in queue even if this one failed
          this._processQueue();
          
          reject(error);
        }
      };
      
      if (executeNow) {
        task();
      } else {
        logger.debug(`[ConnectionThrottler] Queueing ${requestType} request (queue length: ${this.connectionQueue.length + 1})`);
        this.connectionQueue.push(task);
      }
    });
  }
  
  /**
   * Process the next request in the queue if any
   * @private
   */
  _processQueue() {
    if (this.connectionQueue.length > 0 && this.activeConnections < this.maxConnections) {
      const nextTask = this.connectionQueue.shift();
      nextTask();
    }
  }
  
  /**
   * Clear the queue in case of shutdown or emergency
   */
  clearQueue() {
    const queueLength = this.connectionQueue.length;
    this.connectionQueue = [];
    logger.info(`[ConnectionThrottler] Cleared ${queueLength} pending requests`);
  }
}

module.exports = new ConnectionThrottler();
