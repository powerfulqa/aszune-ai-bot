/**
 * Utility for managing conversation history
 */
const config = require('../config/config');
const dataStorage = require('../services/storage');
const logger = require('./logger');
const { ErrorHandler } = require('./error-handler');
const { InputValidator } = require('./input-validator');
const databaseService = require('../services/database');

class ConversationManager {
  constructor() {
    // Using Maps instead of plain objects for better performance
    this.conversations = new Map();
    this.lastMessageTimestamps = new Map();
    this.userStats = new Map();
    // Track active intervals for proper cleanup
    this.activeIntervals = new Set();
    // Do NOT access config.PI_OPTIMIZATIONS here!
    // Only load user stats in constructor
    if (process.env.NODE_ENV !== 'test') {
      this.loadUserStats();
    }
  }

  /**
   * Initialize intervals (should be called after startup)
   */
  initializeIntervals() {
    if (process.env.NODE_ENV !== 'test') {
      // Set up save interval (every 5 minutes)
      this.saveStatsInterval = setInterval(
        () => this.saveUserStats(),
        config.CACHE.CLEANUP_INTERVAL_MS
      );
      this.activeIntervals.add(this.saveStatsInterval);
      // Set up cleanup interval - more frequently if Pi optimizations are enabled
      const cleanupInterval =
        config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED
          ? config.PI_OPTIMIZATIONS.CLEANUP_INTERVAL_MINUTES * 60 * 1000
          : config.CACHE.CLEANUP_INTERVAL_MS;
      this.cleanupInterval = setInterval(() => this.cleanupOldConversations(), cleanupInterval);
      this.activeIntervals.add(this.cleanupInterval);
    }
  }

  /**
   * Start cleanup interval (for testing)
   */
  startCleanupInterval() {
    const cleanupInterval =
      config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED
        ? config.PI_OPTIMIZATIONS.CLEANUP_INTERVAL_MINUTES * 60 * 1000
        : config.CACHE.CLEANUP_INTERVAL_MS;
    this.cleanupInterval = setInterval(() => this.cleanupOldConversations(), cleanupInterval);
    this.activeIntervals.add(this.cleanupInterval);
  }

  /**
   * Start save stats interval (for testing)
   */
  startSaveStatsInterval() {
    this.saveStatsInterval = setInterval(
      () => this.saveUserStats(),
      config.CACHE.CLEANUP_INTERVAL_MS
    );
    this.activeIntervals.add(this.saveStatsInterval);
  }

  /**
   * Load user stats from disk
   */
  async loadUserStats() {
    try {
      const stats = await dataStorage.loadUserStats();

      // Convert object to Map
      for (const [userId, data] of Object.entries(stats)) {
        this.userStats.set(userId, data);
      }

      logger.info(`Loaded stats for ${this.userStats.size} users`);
    } catch (error) {
      const errorResponse = ErrorHandler.handleFileError(
        error,
        'loading user stats',
        'user_stats.json'
      );
      logger.error(`Failed to load user stats: ${errorResponse.message}`);
    }
  }

  /**
   * Save user stats to disk
   */
  async saveUserStats() {
    try {
      await dataStorage.saveUserStats(this.userStats);
    } catch (error) {
      const errorResponse = ErrorHandler.handleFileError(
        error,
        'saving user stats',
        'user_stats.json'
      );
      logger.error(`Failed to save user stats: ${errorResponse.message}`);
    }
  }

  /**
   * Get conversation history for a user
   * @param {string} userId - The user's ID
   * @returns {Array} - The conversation history
   */
  getHistory(userId) {
    // Validate user ID
    const userIdValidation = InputValidator.validateUserId(userId);
    if (!userIdValidation.valid) {
      logger.warn(`Invalid user ID in getHistory: ${userIdValidation.error}`);
      return [];
    }

    return this.conversations.get(userId) || [];
  }

  /**
   * Add a message to the conversation history
   * @param {string} userId - The user's ID
   * @param {string} role - The role (user or assistant)
   * @param {string} content - The message content
   */
  addMessage(userId, role, content) {
    // Validate user ID
    const userIdValidation = InputValidator.validateUserId(userId);
    if (!userIdValidation.valid) {
      logger.warn(`Invalid user ID in addMessage: ${userIdValidation.error}`);
      return;
    }

    // Validate message content
    const contentValidation = InputValidator.validateAndSanitize(content, {
      type: 'message',
      strict: false,
    });

    if (!contentValidation.valid) {
      logger.warn(`Invalid message content in addMessage: ${contentValidation.error}`);
      return;
    }

    // Validate role
    if (!['user', 'assistant', 'system'].includes(role)) {
      logger.warn(`Invalid role in addMessage: ${role}`);
      return;
    }

    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }

    const history = this.conversations.get(userId);
    history.push({ role, content: contentValidation.sanitized });

    // Trim history if it exceeds the max length
    // Use a smaller history size on Pi to save memory
    const maxLength =
      config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED
        ? config.MAX_HISTORY * 2 // Use MAX_HISTORY*2 for Pi optimization
        : config.MAX_HISTORY; // Use MAX_HISTORY for regular operation

    if (history.length > maxLength) {
      // Remove excess messages from the beginning (oldest first)
      const excessCount = history.length - maxLength;
      history.splice(0, excessCount);
    }

    // Update user stats
    this.updateUserStats(userId, role === 'user' ? 'messages' : null);
  }

  /**
   * Clear conversation history for a user
   * @param {string} userId - The user's ID
   */
  clearHistory(userId) {
    if (userId) {
      // Clear history for specific user
      this.conversations.set(userId, []);
    } else {
      // Clear all conversations
      this.conversations.clear();
    }
  }

  /**
   * Check if a user is rate limited
   * @param {string} userId - The user's ID
   * @returns {boolean} - Whether the user is rate limited
   */
  isRateLimited(userId) {
    if (!this.lastMessageTimestamps.has(userId)) {
      return false;
    }

    const lastTimestamp = this.lastMessageTimestamps.get(userId);
    const now = Date.now();

    return now - lastTimestamp < config.RATE_LIMIT_WINDOW;
  }

  /**
   * Update the last message timestamp for a user
   * @param {string} userId - The user's ID
   */
  updateTimestamp(userId) {
    this.lastMessageTimestamps.set(userId, Date.now());
  }

  /**
   * Get user stats
   * @param {string} userId - The user's ID
   * @returns {Object} - The user stats
   */
  getUserStats(userId) {
    if (!this.userStats.has(userId)) {
      this.userStats.set(userId, { messages: 0, summaries: 0, lastActive: null });
    }

    const stats = this.userStats.get(userId);
    
    // Add reminder count from database
    try {
      stats.reminders = databaseService.getUserReminderCount(userId);
    } catch (error) {
      logger.warn(`Failed to get reminder count for user stats: ${error.message}`);
      stats.reminders = 0;
    }

    return stats;
  }

  /**
   * Update user stats
   * @param {string} userId - The user's ID
   * @param {string} statType - The type of stat to increment
   */
  updateUserStats(userId, statType) {
    const stats = this.getUserStats(userId);

    if (statType === 'messages') {
      stats.messages += 1;
    } else if (statType === 'summaries') {
      stats.summaries += 1;
    }

    // Update last active timestamp
    stats.lastActive = Date.now();

    this.userStats.set(userId, stats);
  }

  /**
   * Clean up old conversations (older than 24 hours)
   */
  cleanupOldConversations() {
    const now = Date.now();
    const oneDayAgo = now - config.CACHE.CLEANUP_INTERVAL_MS;

    for (const [userId, timestamp] of this.lastMessageTimestamps.entries()) {
      if (timestamp < oneDayAgo) {
        // Clean up data for inactive users
        this.conversations.delete(userId);
        this.lastMessageTimestamps.delete(userId);
        // We keep user stats permanently
      }
    }

    logger.info(
      `Cleaned up conversation history for inactive users. Active users: ${this.conversations.size}`
    );
  }

  /**
   * Destroy the manager and clear any active intervals
   */
  async destroy() {
    // Clear intervals (check if they exist first to be more robust)
    // Clear all tracked intervals
    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    this.activeIntervals.clear();

    // For backward compatibility with tests
    if (this.cleanupInterval) {
      this.cleanupInterval = null;
    }

    if (this.saveStatsInterval) {
      this.saveStatsInterval = null;
    }

    // Clear all conversation data
    this.conversations.clear();
    this.userStats.clear();

    // Save stats one last time
    try {
      await this.saveUserStats();
      logger.info('Final user stats saved before shutdown');
    } catch (error) {
      const errorResponse = ErrorHandler.handleFileError(
        error,
        'saving user stats during shutdown',
        'user_stats.json'
      );
      logger.error(`Failed to save user stats during shutdown: ${errorResponse.message}`);
    }
  }
}

module.exports = ConversationManager;
