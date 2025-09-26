/**
 * Data access layer for persistent storage
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class DataStorage {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.statsFile = path.join(this.dataDir, 'user_stats.json');
    this.initialized = false;
  }

  /**
   * Initialize the data storage
   */
  async init() {
    if (this.initialized) return;

    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize data storage:', error);
      throw error;
    }
  }

  /**
   * Save user stats to disk
   * @param {Map} stats - User stats map
   */
  async saveUserStats(stats) {
    await this.init();

    try {
      // Convert Map to object for serialization
      const statsObj = {};
      for (const [userId, data] of stats.entries()) {
        statsObj[userId] = data;
      }

      await fs.writeFile(this.statsFile, JSON.stringify(statsObj, null, 2));
      logger.debug('User stats saved successfully');
    } catch (error) {
      logger.error('Failed to save user stats:', error);
      // We don't throw here to avoid crashing the application
    }
  }

  /**
   * Load user stats from disk
   * @returns {Object} - User stats object
   */
  async loadUserStats() {
    await this.init();

    try {
      const data = await fs.readFile(this.statsFile, 'utf8');
      const stats = JSON.parse(data);
      logger.debug('User stats loaded successfully');
      return stats;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty object
        logger.debug('No user stats file found, starting with empty stats');
        return {};
      }

      logger.error('Failed to load user stats:', error);
      return {};
    }
  }
}

module.exports = new DataStorage();
