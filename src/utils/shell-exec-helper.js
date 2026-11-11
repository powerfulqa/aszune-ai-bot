/**
 * Shell Execution Helper
 * Provides utilities for shell command execution with consistent error handling
 * @module utils/shell-exec-helper
 */

const { exec, execFile } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

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

// IPv4, IPv6 or hostname. Must not start with '-', which ping would read as an option.
const PING_TARGET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.:-]{0,252}$/;

/**
 * Ping a host once. Runs ping through execFile (no shell), so a target read
 * from system files or command output cannot inject a command.
 * @param {string} target - IP address or hostname
 * @param {Object} options - execFile options (timeout, etc.)
 * @returns {Promise<void>} Rejects when the target is invalid or unreachable
 */
async function pingOnce(target, options = {}) {
  if (typeof target !== 'string' || !PING_TARGET_PATTERN.test(target)) {
    throw new Error('Invalid ping target');
  }
  const countFlag = process.platform === 'win32' ? '-n' : '-c';
  await execFilePromise('ping', [countFlag, '1', target], { timeout: 3000, ...options });
}

/**
 * Execute ping command across platforms
 * @param {string} target - IP address or hostname to ping
 * @param {Object} options - Execution options
 * @returns {Promise<boolean>} True if ping succeeds, false otherwise
 */
async function executePing(target, options = {}) {
  try {
    await pingOnce(target, options);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Test gateway connectivity and push results to array
 * @param {Function} detectGatewayFn - Function that returns gateway detection result
 * @param {Array} results - Array to append gateway test results to
 * @returns {Promise<void>}
 */
async function testGatewayConnectivity(detectGatewayFn, results) {
  results.push('Test 1: Gateway Connectivity');
  try {
    const gatewayResult = await detectGatewayFn();
    if (gatewayResult.gatewayIp && gatewayResult.gatewayIp !== 'Not detected') {
      await pingOnce(gatewayResult.gatewayIp);
      results.push(`✓ Gateway (${gatewayResult.gatewayIp}) is reachable\n`);
    } else {
      results.push('✗ Gateway not detected\n');
    }
  } catch (error) {
    results.push(`✗ Gateway ping failed: ${error.message}\n`);
  }
}

module.exports = {
  executeCommand,
  executePing,
  pingOnce,
  execPromise,
  testGatewayConnectivity,
};
