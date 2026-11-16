/**
 * Analytics embed builder
 * Generates Discord embed for /analytics command
 */

/**
 * Build the analytics embed from live guild numbers. Nothing records command
 * usage, so the embed shows only what Discord reports now.
 * @param {number} onlineCount - Members currently online
 * @param {number} humanMembers - Members that are not bots
 * @param {number} botCount - Number of bots
 * @returns {Object} Discord embed object
 */
function buildAnalyticsEmbed(onlineCount, humanMembers, botCount) {
  return {
    color: 0x5865f2,
    title: '📊 Server Overview',
    fields: [
      { name: '🟢 Online now', value: String(onlineCount), inline: true },
      { name: '👥 Members', value: String(humanMembers), inline: true },
      { name: '🤖 Bots', value: String(botCount), inline: true },
    ],
    footer: { text: 'Aszai Bot Analytics' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildAnalyticsEmbed };
