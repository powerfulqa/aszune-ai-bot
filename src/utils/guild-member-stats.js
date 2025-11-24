/**
 * Guild Member Statistics Utility
 * Extracted from commands/index.js to reduce duplication
 * Consolidates member fetching, counting, and estimation logic
 */

const logger = require('./logger');

/**
 * Get guild member statistics with timeout protection and fallback estimates
 * @param {Object} guild - Discord guild object
 * @returns {Promise<Object>} Member statistics { onlineCount, botCount, totalMembers, humanMembers }
 */
async function getGuildMemberStats(guild) {
  if (!guild) {
    return { onlineCount: 0, botCount: 0, totalMembers: 0, humanMembers: 0 };
  }

  let onlineCount = 0;
  let botCount = 0;
  const totalMembers = guild.memberCount || 0;

  try {
    // Try to fetch members with timeout (5 seconds max)
    const fetchPromise = guild.members.fetch({ limit: 1000 }); // Limit to avoid huge fetches
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), 5000)
    );

    await Promise.race([fetchPromise, timeoutPromise]);

    // Count online users and bots from fetched data
    onlineCount = guild.members.cache.filter((member) => _isOnlineMember(member)).size;
    botCount = guild.members.cache.filter((member) => member.user.bot).size;
  } catch (error) {
    // Fall back to cached data and estimates
    logger.warn(`Failed to fetch guild members: ${error.message}`);

    const cachedMembers = guild.members.cache;
    onlineCount = cachedMembers.filter((member) => _isOnlineMember(member)).size;
    botCount = cachedMembers.filter((member) => member.user.bot).size;

    // If no cached data, use rough estimates
    if (onlineCount === 0 && totalMembers > 0) {
      onlineCount = Math.floor(totalMembers * 0.2); // Estimate 20% online
    }
    if (botCount === 0 && totalMembers > 10) {
      botCount = Math.floor(totalMembers * 0.05); // Estimate 5% bots
    }
  }

  const humanMembers = totalMembers - botCount;

  return {
    onlineCount,
    botCount,
    totalMembers,
    humanMembers,
  };
}

/**
 * Check if a member is online
 * @param {Object} member - Discord member object
 * @returns {boolean} True if member is online
 * @private
 */
function _isOnlineMember(member) {
  return (
    member.presence?.status === 'online' ||
    member.presence?.status === 'idle' ||
    member.presence?.status === 'dnd'
  );
}

module.exports = {
  getGuildMemberStats,
};
