/**
 * Analytics embed builder
 * Generates Discord embed for /analytics command
 */

const UNAVAILABLE = 'Unavailable';

/**
 * Build the analytics embed from live guild numbers. Nothing records command
 * usage, so the embed shows only what Discord reports now; a count Discord
 * did not supply is shown as unavailable, never estimated.
 * @param {Object} stats - Result of getGuildMemberStats()
 * @param {number} stats.totalMembers - All members, bots included
 * @param {number|null} stats.humanMembers - Members that are not bots
 * @param {number|null} stats.botCount - Number of bots
 * @returns {Object} Discord embed object
 */
function buildAnalyticsEmbed({ totalMembers, humanMembers, botCount }) {
  return {
    color: 0x5865f2,
    title: '📊 Server Overview',
    fields: [
      { name: '👥 Members', value: String(totalMembers), inline: true },
      { name: '👤 Humans', value: String(humanMembers ?? UNAVAILABLE), inline: true },
      { name: '🤖 Bots', value: String(botCount ?? UNAVAILABLE), inline: true },
    ],
    footer: { text: 'Aszai Bot Analytics' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildAnalyticsEmbed };
