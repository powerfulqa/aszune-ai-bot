/**
 * Metrics Broadcaster Module for Web Dashboard
 *
 * Handles metrics collection and broadcasting to connected WebSocket clients.
 * Extracts metrics-related functionality from the main dashboard service.
 *
 * @module services/web-dashboard/metrics-broadcaster
 */

const logger = require('../../utils/logger');
const { ErrorHandler } = require('../../utils/error-handler');

class MetricsBroadcaster {
  constructor() {
    this.io = null;
    this.metricsInterval = null;
    this.broadcastIntervalMs = 30000; // 30 seconds
    this.metricsCollector = null; // Function to collect metrics
  }

  /**
   * Set Socket.io instance for broadcasting
   * @param {Object} io - Socket.io server instance
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Set the metrics collector function
   * @param {Function} collector - Async function that returns metrics object
   */
  setMetricsCollector(collector) {
    this.metricsCollector = collector;
  }

  /**
   * Start broadcasting metrics to connected clients
   */
  start() {
    if (this.metricsInterval) {
      logger.debug('Metrics broadcast already running');
      return;
    }

    if (!this.metricsCollector) {
      logger.warn('Metrics broadcaster started without collector function');
      return;
    }

    this.metricsInterval = setInterval(async () => {
      await this._broadcastMetrics();
    }, this.broadcastIntervalMs);

    logger.debug(`Metrics broadcaster started (interval: ${this.broadcastIntervalMs}ms)`);
  }

  /**
   * Stop metrics broadcasting
   */
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.debug('Metrics broadcaster stopped');
    }
  }

  /**
   * Broadcast metrics to all connected clients
   * @private
   */
  async _broadcastMetrics() {
    try {
      if (!this.io || this.io.sockets.sockets.size === 0) {
        return; // No connected clients
      }

      if (!this.metricsCollector) {
        return;
      }

      const metrics = await this.metricsCollector();
      this.io.emit('metrics', metrics);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'broadcasting metrics');
      logger.error(`Metrics broadcast error: ${errorResponse.message}`, error);
    }
  }

  /**
   * Immediately broadcast metrics (e.g., on client connect)
   */
  async broadcastNow() {
    await this._broadcastMetrics();
  }

  /**
   * Get broadcast status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      running: this.metricsInterval !== null,
      intervalMs: this.broadcastIntervalMs,
      connectedClients: this.io ? this.io.sockets.sockets.size : 0,
    };
  }
}

module.exports = MetricsBroadcaster;
