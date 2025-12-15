/**
 * Service Socket Handlers for Web Dashboard
 * Handles service management socket events
 * @module web-dashboard/handlers/serviceHandlers
 */

const logger = require('../../../utils/logger');
const { execPromise } = require('../../../utils/shell-exec-helper');
const {
  sendOperationError,
  sendErrorWithEmptyArray,
  sendConnectionError,
} = require('./callbackHelpers');
const { buildServiceObject } = require('../../../utils/system-info');

/**
 * Register service-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} dashboard - Dashboard service instance
 */
function registerServiceHandlers(socket, dashboard) {
  socket.on('request_services', (data, callback) => {
    handleRequestServices(dashboard, callback);
  });

  socket.on('service_action', (data, callback) => {
    handleServiceAction(dashboard, data, callback);
  });

  socket.on('quick_service_action', (data, callback) => {
    handleQuickServiceAction(data, callback);
  });

  socket.on('request_discord_status', (data, callback) => {
    handleDiscordStatus(dashboard, callback);
  });
}

/**
 * Handle request for services list
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Function} callback - Response callback
 */
async function handleRequestServices(dashboard, callback) {
  try {
    const bootEnabled = await getBootEnabledStatus('aszune-bot');
    const services = [buildServiceObject(bootEnabled)];

    if (callback) {
      callback({
        services,
        total: services.length,
        timestamp: new Date().toISOString(),
      });
    }
    logger.debug(`Services retrieved: ${services.length}`);
  } catch (error) {
    logger.error('Error retrieving services:', error);
    sendErrorWithEmptyArray(callback, error.message, 'services');
  }
}

/**
 * Check if running under PM2 process manager
 * @returns {boolean} True if running under PM2
 */
function isRunningUnderPm2() {
  return process.env.pm_id !== undefined;
}

/**
 * Check Linux/macOS boot status via systemd
 * @param {string} serviceName - Name of the service
 * @returns {Promise<boolean>} Whether service is enabled on boot
 */
async function checkUnixBootStatus(serviceName) {
  if (isRunningUnderPm2()) return true;

  try {
    const { stdout } = await execPromise(`systemctl is-enabled ${serviceName}`, { timeout: 5000 });
    return stdout.trim() === 'enabled';
  } catch {
    return false;
  }
}

/**
 * Check Windows boot status via sc command
 * @param {string} serviceName - Name of the service
 * @returns {Promise<boolean>} Whether service is enabled on boot
 */
async function checkWindowsBootStatus(serviceName) {
  try {
    const { stdout } = await execPromise(`sc query ${serviceName} | findstr START_TYPE`, {
      timeout: 5000,
    });
    return stdout && (stdout.includes('AUTO') || stdout.includes('BOOT'));
  } catch (error) {
    logger.debug(`Windows service check failed: ${error.message}`);
    return false;
  }
}

/**
 * Get boot enabled status for a service
 * @param {string} serviceName - Name of the service
 * @returns {Promise<boolean>} Whether service is enabled on boot
 */
async function getBootEnabledStatus(serviceName) {
  const platform = process.platform;

  if (platform === 'linux' || platform === 'darwin') {
    return checkUnixBootStatus(serviceName);
  }

  if (platform === 'win32') {
    return checkWindowsBootStatus(serviceName);
  }

  return false;
}

// buildServiceObject imported from shared utility: ../../../utils/system-info

/**
 * Handle service action request (start/stop/restart)
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Object} data - Action data
 * @param {Function} callback - Response callback
 */
async function handleServiceAction(dashboard, data, callback) {
  try {
    const validationError = validateServiceActionInput(data);
    if (validationError) {
      sendOperationError(callback, validationError);
      return;
    }

    const { serviceName, action } = data;
    logger.info(`Service action requested: ${serviceName} - ${action}`);

    try {
      const output = await executePm2Command(serviceName, action);

      if (callback) {
        callback({
          success: true,
          serviceName,
          action,
          message: `Successfully ${action === 'stop' ? 'stopped' : action === 'start' ? 'started' : 'restarted'} ${serviceName}`,
          timestamp: new Date().toISOString(),
          output,
        });
      }
    } catch (execError) {
      logger.error(`PM2 command failed: ${execError.message}`);
      sendOperationError(callback, `Failed to ${action} service: ${execError.message}`);
    }
  } catch (error) {
    logger.error('Error performing service action:', error);
    sendOperationError(callback, error.message);
  }
}

/**
 * Validate service action input
 * @param {Object} data - Service action data
 * @returns {string|null} Error message or null if valid
 */
function validateServiceActionInput(data) {
  const { serviceName, action } = data;

  if (!serviceName || !action) {
    return 'Missing required fields: serviceName, action';
  }

  const validActions = ['start', 'stop', 'restart'];
  if (!validActions.includes(action)) {
    return `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`;
  }

  return null;
}

/**
 * Execute PM2 command
 * @param {string} serviceName - Service name
 * @param {string} action - Action to perform
 * @returns {Promise<string>} Command output
 */
async function executePm2Command(serviceName, action) {
  // Map service names to actual PM2 app name
  let pm2AppName = serviceName;
  if (serviceName === 'aszune-ai-bot' || serviceName === 'aszune-ai') {
    pm2AppName = 'aszune-bot';
  }

  const pm2Command = `pm2 ${action} ${pm2AppName}`;
  logger.debug(`Shell: ${pm2Command}`);

  const { stdout } = await execPromise(pm2Command, { timeout: 10000 });
  logger.info(`PM2 shell OK: ${pm2Command}`);
  return stdout || `Successfully ${action}ed ${pm2AppName}`;
}

/**
 * Handle quick service action (batch operations)
 * @param {Object} data - Action data with group
 * @param {Function} callback - Response callback
 */
async function handleQuickServiceAction(data, callback) {
  try {
    const { group } = data;

    if (!group) {
      sendOperationError(callback, 'Missing required field: group');
      return;
    }

    logger.info(`Quick service action: ${group}`);

    try {
      const pm2Command = mapGroupToPm2Command(group);
      logger.debug(`Executing PM2 quick action: ${pm2Command}`);
      const { stdout, stderr } = await execPromise(pm2Command);

      if (stderr && !stderr.includes('Use `pm2 show')) {
        logger.warn(`PM2 stderr: ${stderr}`);
      }

      logger.info(`PM2 quick action completed: ${stdout}`);

      if (callback) {
        callback({
          success: true,
          group,
          message: `Quick action '${group}' completed successfully`,
          timestamp: new Date().toISOString(),
          output: stdout,
        });
      }
    } catch (execError) {
      logger.error(`PM2 quick action failed: ${execError.message}`);
      sendOperationError(callback, `Failed to execute quick action: ${execError.message}`);
    }
  } catch (error) {
    logger.error('Error performing batch service action:', error);
    sendOperationError(callback, error.message);
  }
}

/**
 * Map quick action group to PM2 command
 * @param {string} group - Action group name
 * @returns {string} PM2 command
 */
function mapGroupToPm2Command(group) {
  switch (group) {
    case 'restart-all':
      return 'pm2 restart all';
    case 'start-all':
      return 'pm2 start all';
    case 'stop-non-essential':
      logger.warn('stop-non-essential mapped to restart-all to prevent dashboard shutdown');
      return 'pm2 restart all';
    default:
      throw new Error(`Unknown quick action group: ${group}`);
  }
}

/**
 * Handle Discord status request
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Function} callback - Response callback
 */
async function handleDiscordStatus(dashboard, callback) {
  try {
    if (!dashboard.discordClient) {
      sendConnectionError(callback, 'Discord client not initialized');
      return;
    }

    const isReady = dashboard.discordClient.isReady();
    if (isReady && dashboard.discordClient.user) {
      const uptime = formatUptime(dashboard.discordClient.uptime || 0);
      if (callback) {
        callback({
          connected: true,
          username: dashboard.discordClient.user.tag,
          id: dashboard.discordClient.user.id,
          uptime,
          guilds: dashboard.discordClient.guilds.cache.size,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      sendConnectionError(callback, 'Discord bot is not connected');
    }

    logger.debug(`Discord status: ${isReady ? 'Connected' : 'Disconnected'}`);
  } catch (error) {
    logger.error('Error retrieving Discord status:', error);
    sendConnectionError(callback, error.message);
  }
}

/**
 * Format uptime from milliseconds
 * @param {number} uptimeMs - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(uptimeMs) {
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  return result.trim();
}

module.exports = {
  registerServiceHandlers,
  handleRequestServices,
  handleServiceAction,
  handleQuickServiceAction,
  handleDiscordStatus,
  getBootEnabledStatus,
  buildServiceObject,
  validateServiceActionInput,
  executePm2Command,
  mapGroupToPm2Command,
  formatUptime,
  // Exported for testing
  isRunningUnderPm2,
  checkUnixBootStatus,
  checkWindowsBootStatus,
};
