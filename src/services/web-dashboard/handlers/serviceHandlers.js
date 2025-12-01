/**
 * Service Socket Handlers for Web Dashboard
 * Handles service management socket events
 * @module web-dashboard/handlers/serviceHandlers
 */

const logger = require('../../../utils/logger');

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
    if (callback) callback({ error: error.message, services: [] });
  }
}

/**
 * Get boot enabled status for a service
 * @param {string} serviceName - Name of the service
 * @returns {Promise<boolean>} Whether service is enabled on boot
 */
async function getBootEnabledStatus(serviceName) {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  try {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      // Check if running under PM2
      if (process.env.pm_id !== undefined) {
        return true;
      }

      // Fallback: Check systemd
      try {
        const { stdout } = await execPromise(`systemctl is-enabled ${serviceName}`, {
          timeout: 5000,
        });
        return stdout.trim() === 'enabled';
      } catch (error) {
        return false;
      }
    } else if (process.platform === 'win32') {
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
  } catch (error) {
    logger.debug(`Failed to get boot enabled status for ${serviceName}: ${error.message}`);
  }

  return false;
}

/**
 * Build service object with system info
 * @param {boolean} bootEnabled - Whether service is enabled on boot
 * @returns {Object} Service info object
 */
function buildServiceObject(bootEnabled) {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

  return {
    id: 'aszune-ai-bot',
    name: 'Aszune AI Bot',
    icon: '🤖',
    status: 'Running',
    enabledOnBoot: bootEnabled,
    uptime: `${hours}h ${minutes}m`,
    pid: process.pid,
    memory: `${memoryMB} MB`,
    port: '3000 (Dashboard)',
  };
}

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
      if (callback) callback({ error: validationError, success: false });
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
      if (callback) {
        callback({
          error: `Failed to ${action} service: ${execError.message}`,
          success: false,
        });
      }
    }
  } catch (error) {
    logger.error('Error performing service action:', error);
    if (callback) callback({ error: error.message, success: false });
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
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

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
      if (callback) callback({ error: 'Missing required field: group', success: false });
      return;
    }

    logger.info(`Quick service action: ${group}`);

    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

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
      if (callback) {
        callback({
          error: `Failed to execute quick action: ${execError.message}`,
          success: false,
        });
      }
    }
  } catch (error) {
    logger.error('Error performing batch service action:', error);
    if (callback) callback({ error: error.message, success: false });
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
      if (callback) callback({ connected: false, error: 'Discord client not initialized' });
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
      if (callback) {
        callback({
          connected: false,
          error: 'Discord bot is not connected',
        });
      }
    }

    logger.debug(`Discord status: ${isReady ? 'Connected' : 'Disconnected'}`);
  } catch (error) {
    logger.error('Error retrieving Discord status:', error);
    if (callback) callback({ connected: false, error: error.message });
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
};
