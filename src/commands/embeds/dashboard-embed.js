/**
 * Dashboard embed builder
 * Generates Discord embed for /dashboard command
 */

/**
 * Build the dashboard embed
 * @param {Object} dashboardData - Dashboard data from PerformanceDashboard
 * @param {Object} realTimeStatus - Real-time status data
 * @param {number} humanMembers - Number of human members
 * @returns {Object} Discord embed object
 */
function buildDashboardEmbed(dashboardData, realTimeStatus, humanMembers) {
  return {
    color:
      dashboardData.overview.status === 'healthy'
        ? 0x00ff00
        : dashboardData.overview.status === 'warning'
          ? 0xffa500
          : 0xff0000,
    title: '🖥️ Performance Dashboard',
    fields: [
      {
        name: '🚦 System Status',
        value: `Status: ${dashboardData.overview.status.toUpperCase()}\nUptime: ${realTimeStatus.uptime.formatted}\nMemory: ${dashboardData.overview.memoryUsage}`,
        inline: true,
      },
      {
        name: '⚡ Performance',
        value: `Response Time: ${dashboardData.overview.responseTime}\nError Rate: ${dashboardData.overview.errorRate}\nOptimization: ${dashboardData.overview.optimizationTier}`,
        inline: true,
      },
      {
        name: '📊 Activity',
        value: `Servers: 1\nActive Users: ${humanMembers}\nCommands: 0`,
        inline: true,
      },
      {
        name: '🚨 Active Alerts',
        value:
          dashboardData.alerts && dashboardData.alerts.length > 0
            ? dashboardData.alerts
              .slice(0, 3)
              .map((alert) => `${alert.severity === 'critical' ? '🔴' : '🟡'} ${alert.message}`)
              .join('\n')
            : '✅ No active alerts',
        inline: false,
      },
    ],
    footer: { text: 'Aszai Bot Dashboard • Real-time data' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildDashboardEmbed };
