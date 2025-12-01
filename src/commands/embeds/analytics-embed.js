/**
 * Analytics embed builder
 * Generates Discord embed for /analytics command
 */

/**
 * Build the analytics embed
 * @param {Object} analyticsData - Analytics data from DiscordAnalytics
 * @param {Object} serverInsights - Server insights data
 * @param {number} onlineCount - Number of online users
 * @param {number} botCount - Number of bots
 * @returns {Object} Discord embed object
 */
function buildAnalyticsEmbed(analyticsData, serverInsights, onlineCount, botCount) {
  return {
    color: 0x5865f2,
    title: '📊 Discord Analytics Dashboard',
    fields: [
      {
        name: '🏢 Server Overview',
        value: `Servers: ${analyticsData.summary.totalServers}\nActive Users: ${analyticsData.summary.totalUsers}\nTotal Commands: ${analyticsData.summary.totalCommands}`,
        inline: true,
      },
      {
        name: '📈 Performance',
        value: `Success Rate: ${analyticsData.summary.successRate}%\nError Rate: ${analyticsData.summary.errorRate}%\nAvg Response: ${analyticsData.summary.avgResponseTime}ms`,
        inline: true,
      },
      {
        name: '🎯 Top Commands',
        value:
          analyticsData?.commandStats
            ?.slice(0, 3)
            .map((cmd, i) => `${i + 1}. ${cmd.command} (${cmd.count})`)
            .join('\n') || 'No data yet',
        inline: true,
      },
      {
        name: '💡 Server Insights',
        value: `🟢 Currently Online: ${serverInsights.uniqueUsers}\n👥 Total Members: ${analyticsData.summary.totalUsers}\n🤖 Bots: ${botCount}\n📊 Server Health: Excellent`,
        inline: false,
      },
    ],
    footer: { text: 'Aszai Bot Analytics' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildAnalyticsEmbed };
