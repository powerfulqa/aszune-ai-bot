/**
 * Logs Socket Handlers for Web Dashboard
 * Handles log-related socket events
 * @module web-dashboard/handlers/logsHandlers
 */

const logger = require('../../../utils/logger');

/**
 * Register log-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} dashboard - Dashboard service instance
 */
function registerLogsHandlers(socket, dashboard) {
  socket.on('request_logs', (data, callback) => {
    handleRequestLogs(dashboard, data, callback);
  });

  socket.on('clear_logs', (data, callback) => {
    handleClearLogs(dashboard, callback);
  });
}

/**
 * Handle logs request
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Object} data - Request data with limit and level filter
 * @param {Function} callback - Response callback
 */
function handleRequestLogs(dashboard, data, callback) {
  try {
    const { limit = 100, level = null } = data || {};

    let logs = dashboard.allLogs;

    if (level) {
      logs = logs.filter((log) => log.level === level);
    }

    const limitedLogs = logs.slice(-limit);

    if (callback) {
      callback({
        logs: limitedLogs,
        total: dashboard.allLogs.length,
        filtered: limitedLogs.length,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error retrieving logs:', error);
    if (callback) callback({ error: error.message, logs: [] });
  }
}

/**
 * Handle clear logs request
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Function} callback - Response callback
 */
function handleClearLogs(dashboard, callback) {
  try {
    const count = dashboard.allLogs.length;
    dashboard.allLogs = [];
    dashboard.errorLogs = [];

    logger.info(`Logs cleared by dashboard (${count} entries removed)`);

    if (callback) {
      callback({
        cleared: true,
        count,
        timestamp: new Date().toISOString(),
      });
    }

    dashboard.io.emit('logs_cleared', { count, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    if (callback) callback({ error: error.message, cleared: false });
  }
}

module.exports = {
  registerLogsHandlers,
  handleRequestLogs,
  handleClearLogs,
};
