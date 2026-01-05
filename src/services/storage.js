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
   * Check if error is a JSON parsing error
   * @private
   */
  _isJsonError(error) {
    return (
      error instanceof SyntaxError || error.name === 'SyntaxError' || error.message.includes('JSON')
    );
  }

  /**
   * Handle corrupted JSON file by backup and reset
   * @private
   */
  async _handleCorruptedFile(error) {
    logger.warn(`Corrupted user stats file (${error.message}), resetting to empty stats`);
    try {
      const backupPath = `${this.statsFile}.corrupted.${Date.now()}`;
      await fs.writeFile(backupPath, '');
      logger.info(`Backed up corrupted user stats to ${backupPath}`);

      await fs.writeFile(this.statsFile, JSON.stringify({}, null, 2));
      logger.info('Reset user stats file to valid empty JSON');
    } catch (writeError) {
      logger.error('Failed to reset user stats file:', writeError);
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

      // Handle empty or whitespace-only files
      if (!data || !data.trim()) {
        logger.debug('User stats file is empty, starting with empty stats');
        return {};
      }

      const stats = JSON.parse(data);
      logger.debug('User stats loaded successfully');
      return stats;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug('No user stats file found, starting with empty stats');
        return {};
      }

      if (this._isJsonError(error)) {
        await this._handleCorruptedFile(error);
        return {};
      }

      logger.error('Failed to load user stats:', error);
      return {};
    }
  }
}

module.exports = new DataStorage();
