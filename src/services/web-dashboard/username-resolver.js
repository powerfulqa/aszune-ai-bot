/**
 * Username Resolver Module for Web Dashboard
 *
 * Handles Discord username resolution with caching for the dashboard.
 * Extracts username-related functionality from the main dashboard service.
 *
 * @module services/web-dashboard/username-resolver
 */

const logger = require('../../utils/logger');

class UsernameResolver {
  constructor() {
    this.discordClient = null;
    this.cache = new Map();
    this.cacheExpiry = 60 * 60 * 1000; // 1 hour cache expiry
  }

  /**
   * Set Discord client for username resolution
   * @param {Object} client - Discord.js client instance
   */
  setDiscordClient(client) {
    this.discordClient = client;
    if (client) {
      logger.debug('Discord client set for username resolution');
    }
  }

  /**
   * Validates Discord user ID format (snowflake)
   * @param {string} userId - User ID to validate
   * @returns {boolean} True if valid snowflake format
   * @private
   */
  _isValidDiscordSnowflake(userId) {
    return userId && typeof userId === 'string' && /^\d+$/.test(userId);
  }

  /**
   * Fetch username from Discord API with error handling
   * @param {string} userId - Discord user ID
   * @returns {Promise<string|null>} Username or null
   * @private
   */
  async _fetchFromDiscord(userId) {
    if (!this.discordClient) {
      return null;
    }

    try {
      const user = await this.discordClient.users.fetch(userId, { cache: false });
      if (user?.username) {
        this.cache.set(userId, {
          username: user.username,
          timestamp: Date.now(),
        });
        return user.username;
      }
      return null;
    } catch (error) {
      logger.debug(`Failed to resolve Discord username for ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Resolve Discord username from user ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<string|null>} Discord username or null
   */
  async resolve(userId) {
    // Validate Discord snowflake format
    if (!this._isValidDiscordSnowflake(userId)) {
      logger.debug(`Skipping Discord username resolution for non-snowflake ID: ${userId}`);
      return null;
    }

    // Check cache first
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.username;
    }

    // Fetch from Discord API
    return this._fetchFromDiscord(userId);
  }

  /**
   * Resolve multiple usernames in batch
   * @param {string[]} userIds - Array of Discord user IDs
   * @returns {Promise<Map<string, string>>} Map of userId -> username
   */
  async resolveBatch(userIds) {
    const results = new Map();
    const uniqueIds = [...new Set(userIds)];

    await Promise.all(
      uniqueIds.map(async (userId) => {
        const username = await this.resolve(userId);
        if (username) {
          results.set(userId, username);
        }
      })
    );

    return results;
  }

  /**
   * Clear the username cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

module.exports = UsernameResolver;
