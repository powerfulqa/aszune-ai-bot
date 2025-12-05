/**
 * System Information Utilities
 *
 * Provides common patterns for system info (uptime, memory, etc.)
 * to reduce code duplication across dashboard and service handlers.
 */

const os = require('os');

/**
 * Calculate formatted uptime from seconds
 * @param {number} uptimeSeconds - Uptime in seconds
 * @returns {Object} Formatted uptime components
 */
function formatUptime(uptimeSeconds) {
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  return {
    hours,
    minutes,
    seconds,
    formatted: `${hours}h ${minutes}m`,
    fullFormatted: `${hours}h ${minutes}m ${seconds}s`,
  };
}

/**
 * Get current process memory usage in MB
 * @param {number} decimals - Number of decimal places
 * @returns {string} Memory usage in MB as string
 */
function getMemoryUsageMB(decimals = 2) {
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(decimals);
}

/**
 * Build a standard service info object
 * Used by web-dashboard.js and serviceHandlers.js
 * @param {boolean} bootEnabled - Whether service is enabled on boot
 * @param {Object} options - Optional configuration
 * @param {string} options.id - Service ID
 * @param {string} options.name - Service display name
 * @param {string} options.icon - Service icon/emoji
 * @param {string} options.port - Service port info
 * @returns {Object} Service info object
 */
function buildServiceObject(bootEnabled, options = {}) {
  const {
    id = 'aszune-ai-bot',
    name = 'Aszune AI Bot',
    icon = '🤖',
    port = '3000 (Dashboard)',
  } = options;
  
  const uptimeSeconds = Math.floor(process.uptime());
  const { formatted: uptime } = formatUptime(uptimeSeconds);
  const memoryMB = getMemoryUsageMB(2);

  return {
    id,
    name,
    icon,
    status: 'Running',
    enabledOnBoot: bootEnabled,
    uptime,
    pid: process.pid,
    memory: `${memoryMB} MB`,
    port,
  };
}

/**
 * Build network interfaces information
 * Used by web-dashboard.js and networkHandlers.js
 * @returns {Array} Network interfaces array
 */
function buildNetworkInterfaces() {
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

module.exports = {
  formatUptime,
  getMemoryUsageMB,
  buildServiceObject,
  buildNetworkInterfaces,
};
