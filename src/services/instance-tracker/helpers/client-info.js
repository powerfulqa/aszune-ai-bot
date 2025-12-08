/**
 * Client Info Helper
 * Gathers information about the Discord client and system
 *
 * @module services/instance-tracker/helpers/client-info
 */
const os = require('os');
const crypto = require('crypto');

/**
 * Gather information about the Discord client
 * @param {Client} client - Discord.js client
 * @returns {Promise<Object>} Client information
 */
async function gatherClientInfo(client) {
  const packageJson = loadPackageJson();

  return {
    ...getBotIdentity(client),
    ...getServerStats(client),
    ...getVersionInfo(packageJson),
    ...getSystemInfo(),
    ...getProcessInfo(),
    ...getTimestampInfo(),
  };
}

/**
 * Load package.json safely
 * @returns {Object}
 */
function loadPackageJson() {
  try {
    return require('../../../../package.json');
  } catch {
    return { version: 'unknown' };
  }
}

/**
 * Get bot identity information
 * @param {Client} client
 * @returns {Object}
 */
function getBotIdentity(client) {
  return {
    botId: client?.user?.id || 'unknown',
    botUsername: client?.user?.username || 'unknown',
    botTag: client?.user?.tag || 'unknown',
  };
}

/**
 * Get Discord server statistics
 * @param {Client} client
 * @returns {Object}
 */
function getServerStats(client) {
  return {
    guildCount: client?.guilds?.cache?.size || 0,
    userCount: client?.users?.cache?.size || 0,
    channelCount: client?.channels?.cache?.size || 0,
  };
}

/**
 * Get version information
 * @param {Object} packageJson
 * @returns {Object}
 */
function getVersionInfo(packageJson) {
  return {
    version: packageJson.version,
    nodeVersion: process.version,
  };
}

/**
 * Get system information
 * @returns {Object}
 */
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
    osUptime: os.uptime(),
  };
}

/**
 * Get process information
 * @returns {Object}
 */
function getProcessInfo() {
  return {
    pid: process.pid,
    processUptime: process.uptime(),
  };
}

/**
 * Get timestamp information
 * @returns {Object}
 */
function getTimestampInfo() {
  return {
    startTime: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Generate a unique instance key based on hardware/environment
 * @returns {string} SHA256 hash (first 32 chars)
 */
function generateInstanceKey() {
  const data = buildInstanceKeyData();
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Build data string for instance key generation
 * @returns {string}
 */
function buildInstanceKeyData() {
  const components = [
    os.hostname(),
    os.platform(),
    os.arch(),
    getCpuModel(),
    getMacAddress(),
  ];

  return components.join('|');
}

/**
 * Get CPU model safely
 * @returns {string}
 */
function getCpuModel() {
  const cpus = os.cpus();
  return cpus.length > 0 ? cpus[0].model : 'unknown';
}

/**
 * Get MAC address for instance identification
 * @returns {string}
 */
function getMacAddress() {
  const interfaces = os.networkInterfaces();
  const interfaceNames = ['eth0', 'en0', 'wlan0', 'Wi-Fi'];

  for (const name of interfaceNames) {
    const iface = interfaces[name];
    if (iface && iface[0]?.mac) {
      return iface[0].mac;
    }
  }

  // Fallback: find any non-internal interface with MAC
  for (const ifaces of Object.values(interfaces)) {
    const external = ifaces.find((i) => !i.internal && i.mac !== '00:00:00:00:00:00');
    if (external?.mac) {
      return external.mac;
    }
  }

  return 'unknown';
}

module.exports = {
  gatherClientInfo,
  generateInstanceKey,
  getBotIdentity,
  getServerStats,
  getSystemInfo,
  getProcessInfo,
};
