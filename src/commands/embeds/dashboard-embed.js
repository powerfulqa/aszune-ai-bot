/**
 * Dashboard embed builder
 * Generates Discord embed for /dashboard command
 */

const STATUS_COLORS = { healthy: 0x00ff00, warning: 0xffa500 };

/**
 * Build the dashboard embed from live readings only (process memory, uptime,
 * guild counts). Nothing records command usage or response times.
 * @param {Object} resourceStatus - Result of ResourceOptimizer.monitorResources()
 * @param {string} uptime - Formatted process uptime
 * @param {number} memberCount - Members in this guild, bots included
 * @param {number} serverCount - Number of guilds the bot is in
 * @returns {Object} Discord embed object
 */
function buildDashboardEmbed(resourceStatus, uptime, memberCount, serverCount) {
  const status = resourceStatus.overall.status;
  return {
    color: STATUS_COLORS[status] ?? 0xff0000,
    title: '🖥️ Performance Dashboard',
    fields: [
      {
        name: '🚦 System Status',
        value: `Status: ${status.toUpperCase()}\nUptime: ${uptime}\nMemory: ${resourceStatus.memory.used}MB`,
        inline: true,
      },
      {
        name: '⚡ Optimization',
        value: `Tier: ${resourceStatus.optimizationTier}`,
        inline: true,
      },
      {
        name: '📊 Activity',
        value: `Servers: ${serverCount}\nMembers: ${memberCount}`,
        inline: true,
      },
    ],
    footer: { text: 'Aszai Bot Dashboard • Real-time data' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildDashboardEmbed };
