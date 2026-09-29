/**
 * Connection throttler to manage network requests on Pi
 * Helps prevent network overload on resource-constrained devices
 */
const logger = require('./logger');

class ConnectionThrottler {
  constructor() {
    const config = require('../config/config');
    // Initialize connection tracking
    this.activeConnections = 0;
    this.connectionQueue = [];

    // Define default values as constants for better maintainability
    const DEFAULT_PI_CONNECTIONS = 2;
    const DEFAULT_NORMAL_CONNECTIONS = 10;

    // Set max connections based on config or defaults
    this.maxConnections = config.PI_OPTIMIZATIONS?.ENABLED
      ? config.PI_OPTIMIZATIONS?.MAX_CONNECTIONS || DEFAULT_PI_CONNECTIONS
      : DEFAULT_NORMAL_CONNECTIONS;
    this.maxQueueLength = 20;
    this.queueTimeoutMs = config.RATE_LIMITS?.API_TIMEOUT_MS || 30000;
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
      const task = this._createExecutionTask(requestFn, requestType, resolve, reject);

      if (executeNow) {
        task();
      } else {
        this._enqueueTask(task, requestType, reject);
      }
    });
  }

  _enqueueTask(task, requestType, reject) {
    if (this.connectionQueue.length >= this.maxQueueLength) {
      reject(new Error('Request queue is full. Please try again shortly.'));
      return;
    }

    const queued = { task, reject, timer: null };
    queued.timer = setTimeout(() => {
      const index = this.connectionQueue.indexOf(queued);
      if (index === -1) return;
      this.connectionQueue.splice(index, 1);
      reject(new Error('Request expired while waiting. Please try again shortly.'));
    }, this.queueTimeoutMs);
    queued.timer.unref?.();
    this.connectionQueue.push(queued);
    logger.debug(
      `[ConnectionThrottler] Queueing ${requestType} request (queue length: ${this.connectionQueue.length})`
    );
  }

  /**
   * Create an execution task for handling a network request
   * @private
   * @param {Function} requestFn - The request function to execute
   * @param {String} requestType - Type of request for logging
   * @param {Function} resolve - Promise resolve callback
   * @param {Function} reject - Promise reject callback
   * @returns {Function} Async task function
   */
  _createExecutionTask(requestFn, requestType, resolve, reject) {
    return async () => {
      try {
        this.activeConnections++;
        logger.debug(
          `[ConnectionThrottler] Starting ${requestType} request (${this.activeConnections}/${this.maxConnections} active)`
        );

        const result = await requestFn();

        this.activeConnections--;
        logger.debug(
          `[ConnectionThrottler] Completed ${requestType} request (${this.activeConnections}/${this.maxConnections} active)`
        );

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
  }

  /**
   * Process the next request in the queue if any
   * @private
   */
  _processQueue() {
    if (this.connectionQueue.length > 0 && this.activeConnections < this.maxConnections) {
      const next = this.connectionQueue.shift();
      clearTimeout(next.timer);
      next.task();
    }
  }

  /**
   * Clear the queue in case of shutdown or emergency
   */
  clearQueue() {
    const queueLength = this.connectionQueue.length;
    for (const queued of this.connectionQueue) {
      clearTimeout(queued.timer);
      queued.reject(new Error('Request cancelled before execution. Please try again shortly.'));
    }
    this.connectionQueue = [];
    logger.info(`[ConnectionThrottler] Cleared ${queueLength} pending requests`);
  }
}

module.exports = new ConnectionThrottler();
