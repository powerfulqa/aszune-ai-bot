/**
 * Shell Execution Helper
 * Provides utilities for shell command execution with consistent error handling
 * @module utils/shell-exec-helper
 */

const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Execute shell command with promise-based API
 * @param {string} command - Shell command to execute
 * @param {Object} options - Execution options (timeout, etc.)
 * @returns {Promise<{stdout: string, stderr: string}>} Command output
 */
async function executeCommand(command, options = {}) {
  return execPromise(command, {
    timeout: 3000,
    ...options,
  });
}

/**
 * Execute ping command across platforms
 * @param {string} target - IP address or hostname to ping
 * @param {Object} options - Execution options
 * @returns {Promise<boolean>} True if ping succeeds, false otherwise
 */
async function executePing(target, options = {}) {
  try {
    const pingCmd = process.platform === 'win32' ? `ping -n 1 ${target}` : `ping -c 1 ${target}`;
    await executeCommand(pingCmd, options);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  executeCommand,
  executePing,
  execPromise,
};
