/**
 * Guild Member Statistics Utility
 * Extracted from commands/index.js to reduce duplication
 * Consolidates member fetching, counting, and estimation logic
 */

const logger = require('./logger');

/**
 * Get guild member statistics with timeout protection.
 *
 * `botCount` and `humanMembers` are null when the member list could not be
 * fetched: callers show them as unavailable rather than guessing. There is no
 * online count, because the bot does not request the presences intent and so
 * never receives presence data.
 * @param {Object} guild - Discord guild object
 * @returns {Promise<Object>} Member statistics { botCount, totalMembers, humanMembers }
 */
async function getGuildMemberStats(guild) {
  if (!guild) {
    return { botCount: 0, totalMembers: 0, humanMembers: 0 };
  }

  const totalMembers = guild.memberCount || 0;
  let timer;

  try {
    // Try to fetch members with timeout (5 seconds max)
    const fetchPromise = guild.members.fetch({ limit: 1000 }); // Limit to avoid huge fetches
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Fetch timeout')), 5000);
    });

    await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    logger.warn(`Failed to fetch guild members: ${error.message}`);
    return { botCount: null, totalMembers, humanMembers: null };
  } finally {
    clearTimeout(timer);
  }

  const botCount = guild.members.cache.filter((member) => member.user.bot).size;
  return { botCount, totalMembers, humanMembers: totalMembers - botCount };
}

module.exports = {
  getGuildMemberStats,
};
