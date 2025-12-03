/**
 * Network Socket Handlers for Web Dashboard
 * Handles network-related socket events
 * @module web-dashboard/handlers/networkHandlers
 */

const os = require('os');
const logger = require('../../../utils/logger');
const { sendError } = require('./callbackHelpers');

/**
 * Register network-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} dashboard - Dashboard service instance
 */
function registerNetworkHandlers(socket, dashboard) {
  socket.on('request_network_status', (data, callback) => {
    handleNetworkStatus(dashboard, callback);
  });

  socket.on('request_network_test', (data, callback) => {
    handleNetworkTest(dashboard, data, callback);
  });
}

/**
 * Handle network status request
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Function} callback - Response callback
 */
async function handleNetworkStatus(dashboard, callback) {
  try {
    const hostname = os.hostname();
    const interfaces = await buildNetworkInterfaces();
    const localIp = interfaces.find((i) => !i.internal && i.ipv4)?.ipv4 || 'localhost';
    const gatewayResult = await dashboard.detectGateway();
    const externalIp = await safeGetExternalIp(dashboard);
    const connectivityStatus = await dashboard.getNetworkStatus();

    if (callback) {
      callback({
        hostname,
        localIp,
        gateway: gatewayResult.gatewayIp !== 'Not detected' ? gatewayResult.gatewayIp : null,
        gatewayStatus: gatewayResult.reachable,
        externalIp: externalIp || null,
        interfaces,
        connectivity: connectivityStatus,
        timestamp: new Date().toISOString(),
      });
    }
    logger.debug(`Network status retrieved for hostname: ${hostname}`);
  } catch (error) {
    logger.error('Error retrieving network status:', error);
    sendError(callback, error.message);
  }
}

/**
 * Build network interfaces information
 * @returns {Promise<Array>} Network interfaces array
 */
async function buildNetworkInterfaces() {
  const networkInterfaces = os.networkInterfaces();
  const interfaces = [];

  for (const [name, addrs] of Object.entries(networkInterfaces)) {
    const ipv4 = addrs.find((addr) => addr.family === 'IPv4');
    const ipv6 = addrs.find((addr) => addr.family === 'IPv6');

    if (ipv4 || ipv6) {
      const isInternal = ipv4?.internal || ipv6?.internal || false;
      const isLoopback = name.toLowerCase().includes('lo') || isInternal;

      interfaces.push({
        name,
        ipv4: ipv4?.address || null,
        ipv6: ipv6?.address || null,
        mac: ipv4?.mac || ipv6?.mac || null,
        internal: isInternal,
        status: isLoopback ? 'LOOPBACK' : 'UP',
      });
    }
  }
  return interfaces;
}

/**
 * Safely get external IP address
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @returns {Promise<string|null>} External IP or null
 */
async function safeGetExternalIp(dashboard) {
  try {
    return await dashboard.getExternalIp();
  } catch (error) {
    logger.debug(`Failed to get external IP: ${error.message}`);
    return null;
  }
}

/**
 * Handle network test request
 * @param {WebDashboardService} dashboard - Dashboard service instance
 * @param {Object} data - Request data
 * @param {Function} callback - Response callback
 */
async function handleNetworkTest(dashboard, data, callback) {
  try {
    const results = ['=== NETWORK CONNECTIVITY TEST SUITE ===\n'];

    await addGatewayTest(dashboard, results);
    await addDnsTests(dashboard, results);
    await addInternetTests(results);
    await addConfigurationTests(results);

    results.push('\n=== TEST SUITE COMPLETE ===');

    if (callback) {
      callback({
        success: true,
        message: 'Network test completed',
        results: results.join('\n'),
        timestamp: new Date().toISOString(),
      });
    }
    logger.info('Network test completed successfully');
  } catch (error) {
    logger.error('Network test error:', error);
    if (callback) {
      callback({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Add gateway connectivity test results
 * @param {WebDashboardService} dashboard - Dashboard service
 * @param {Array} results - Results array to append to
 */
async function addGatewayTest(dashboard, results) {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  results.push('Test 1: Gateway Connectivity');
  try {
    const gatewayResult = await dashboard.detectGateway();
    if (gatewayResult.gatewayIp && gatewayResult.gatewayIp !== 'Not detected') {
      const pingCmd =
        process.platform === 'win32'
          ? `ping -n 1 ${gatewayResult.gatewayIp}`
          : `ping -c 1 ${gatewayResult.gatewayIp}`;
      await execPromise(pingCmd, { timeout: 3000 });
      results.push(`✓ Gateway (${gatewayResult.gatewayIp}) is reachable\n`);
    } else {
      results.push('✗ Gateway not detected\n');
    }
  } catch (error) {
    results.push(`✗ Gateway ping failed: ${error.message}\n`);
  }
}

/**
 * Add DNS test results
 * @param {WebDashboardService} dashboard - Dashboard service
 * @param {Array} results - Results array to append to
 */
async function addDnsTests(dashboard, results) {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  const dns = require('dns').promises;

  results.push('Test 2: DNS Server Detection & Testing');
  try {
    const dnsServers = await dashboard.detectDnsServers();
    results.push(`  Detected DNS Servers: ${dnsServers.join(', ')}`);

    let dnsWorking = false;
    for (const dnsServer of dnsServers) {
      try {
        const pingCmd =
          process.platform === 'win32' ? `ping -n 1 ${dnsServer}` : `ping -c 1 ${dnsServer}`;
        await execPromise(pingCmd, { timeout: 3000 });
        results.push(`  ✓ DNS Server ${dnsServer} is reachable`);
        dnsWorking = true;
      } catch (error) {
        results.push(`  ✗ DNS Server ${dnsServer} not reachable`);
      }
    }

    if (dnsWorking) {
      results.push('  ✓ At least one DNS server is accessible\n');
    } else {
      results.push('  ✗ No DNS servers are reachable\n');
    }
  } catch (error) {
    results.push(`✗ DNS detection failed: ${error.message}\n`);
  }

  results.push('Test 3: DNS Resolution Test');
  try {
    const addresses = await dns.resolve4('google.com');
    results.push(`✓ DNS resolution working (google.com → ${addresses[0]})\n`);
  } catch (error) {
    results.push(`✗ DNS resolution failed: ${error.message}\n`);
  }
}

/**
 * Add internet connectivity test results
 * @param {Array} results - Results array to append to
 */
async function addInternetTests(results) {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  results.push('Test 4: Internet Connectivity');
  const targets = [
    { host: '8.8.8.8', name: 'Google DNS' },
    { host: '1.1.1.1', name: 'Cloudflare DNS' },
  ];

  for (const target of targets) {
    try {
      const pingCmd =
        process.platform === 'win32' ? `ping -n 1 ${target.host}` : `ping -c 1 ${target.host}`;
      await execPromise(pingCmd, { timeout: 3000 });
      results.push(`✓ ${target.name} (${target.host}) is reachable`);
    } catch (error) {
      results.push(`✗ ${target.name} (${target.host}) not reachable`);
    }
  }
  results.push('');
}

/**
 * Add configuration test results
 * @param {Array} results - Results array to append to
 */
async function addConfigurationTests(results) {
  results.push('Test 5: Network Configuration');
  results.push(`  Hostname: ${os.hostname()}`);
  results.push(`  Platform: ${os.platform()}`);
  results.push(`  Architecture: ${os.arch()}`);

  const networkInterfaces = os.networkInterfaces();
  const activeInterfaces = Object.entries(networkInterfaces)
    .filter(([, addrs]) => addrs.some((a) => !a.internal && a.family === 'IPv4'))
    .map(([name]) => name);

  results.push(`  Active Interfaces: ${activeInterfaces.join(', ') || 'None detected'}`);
}

module.exports = {
  registerNetworkHandlers,
  handleNetworkStatus,
  handleNetworkTest,
  buildNetworkInterfaces,
  safeGetExternalIp,
  addGatewayTest,
  addDnsTests,
  addInternetTests,
  addConfigurationTests,
};
