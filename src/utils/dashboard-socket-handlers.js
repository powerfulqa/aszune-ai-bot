/**
 * Socket.IO Event Handlers for Web Dashboard
 * Handles all socket event requests for dashboard data and analytics
 */

const logger = require('./logger');
const { ErrorHandler } = require('./error-handler');

class SocketHandlers {
  constructor(webDashboardInstance) {
    this.dashboard = webDashboardInstance;
  }

  /**
   * Setup socket connection handlers
   */
  setupSocketConnection(socket) {
    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });

    // Analytics requests
    socket.on('request_analytics', (data, callback) => {
      this.handleAnalyticsRequest(data, callback);
    });

    // Metrics requests
    socket.on('request_metrics', (data, callback) => {
      this.handleMetricsRequest(data, callback);
    });

    // Status requests
    socket.on('request_status', (data, callback) => {
      this.handleStatusRequest(data, callback);
    });

    // Service status
    socket.on('request_service_status', (data, callback) => {
      this.handleServiceStatusRequest(data, callback);
    });
  }

  /**
   * Handle analytics data request
   */
  handleAnalyticsRequest(data, callback) {
    try {
      const analytics = this.dashboard.performanceTracker?.getAnalytics?.();

      if (callback) {
        callback({
          success: true,
          data: analytics || { totalCommands: 0, errorRate: 0 },
        });
      }
    } catch (error) {
      logger.error('Error getting analytics:', error.message);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to retrieve analytics',
        });
      }
    }
  }

  /**
   * Handle metrics data request
   */
  handleMetricsRequest(data, callback) {
    try {
      const metrics = this.dashboard.getMetrics?.();

      if (callback) {
        callback({
          success: true,
          data: metrics || {
            timestamp: new Date().toISOString(),
            cacheHitRate: 0,
            responseTime: 0,
          },
        });
      }
    } catch (error) {
      logger.error('Error getting metrics:', error.message);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to retrieve metrics',
        });
      }
    }
  }

  /**
   * Handle status request
   */
  handleStatusRequest(data, callback) {
    try {
      const status = {
        uptime: Math.floor(process.uptime()),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        connected: this.dashboard.discordClient?.isReady?.() || false,
        timestamp: new Date().toISOString(),
      };

      if (callback) {
        callback({
          success: true,
          data: status,
        });
      }
    } catch (error) {
      logger.error('Error getting status:', error.message);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to retrieve status',
        });
      }
    }
  }

  /**
   * Handle service status request
   */
  handleServiceStatusRequest(data, callback) {
    try {
      const services = this.dashboard.getServiceStatus?.();

      if (callback) {
        callback({
          success: true,
          data: services || [],
        });
      }
    } catch (error) {
      logger.error('Error getting service status:', error.message);
      if (callback) {
        callback({
          success: false,
          error: 'Failed to retrieve service status',
        });
      }
    }
  }
}

module.exports = SocketHandlers;
