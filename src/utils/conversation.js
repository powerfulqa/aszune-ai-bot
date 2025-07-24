/**
 * Utility for managing conversation history
 */
const config = require('../config/config');
const dataStorage = require('../services/storage');
const logger = require('./logger');

class ConversationManager {
  constructor() {
    // Using Maps instead of plain objects for better performance
    this.conversations = new Map();
    this.lastMessageTimestamps = new Map();
    this.userStats = new Map();
    // Track active intervals for proper cleanup
    this.activeIntervals = new Set();
    
    // Don't load stats or set intervals in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Load user stats from disk
      this.loadUserStats();
      
      // Set up save interval (every 5 minutes)
      this.saveStatsInterval = setInterval(() => this.saveUserStats(), 5 * 60 * 1000);
      this.activeIntervals.add(this.saveStatsInterval);
      
      // Set up cleanup interval (every hour)
      this.cleanupInterval = setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
      this.activeIntervals.add(this.cleanupInterval);
    }
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
      logger.error('Failed to load user stats:', error);
    }
  }
  
  /**
   * Save user stats to disk
   */
  async saveUserStats() {
    try {
      await dataStorage.saveUserStats(this.userStats);
    } catch (error) {
      logger.error('Failed to save user stats:', error);
    }
  }
  
  /**
   * Get conversation history for a user
   * @param {string} userId - The user's ID
   * @returns {Array} - The conversation history
   */
  getHistory(userId) {
    return this.conversations.get(userId) || [];
  }
  
  /**
   * Add a message to the conversation history
   * @param {string} userId - The user's ID
   * @param {string} role - The role (user or assistant)
   * @param {string} content - The message content
   */
  addMessage(userId, role, content) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    
    const history = this.conversations.get(userId);
    history.push({ role, content });
    
    // Trim history if it exceeds the max length
    if (history.length > config.MAX_HISTORY * 2) {
      this.conversations.set(userId, history.slice(-config.MAX_HISTORY * 2));
    }
    
    // Update user stats
    this.updateUserStats(userId, role === 'user' ? 'messages' : null);
  }
  
  /**
   * Clear conversation history for a user
   * @param {string} userId - The user's ID
   */
  clearHistory(userId) {
    this.conversations.set(userId, []);
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
      this.userStats.set(userId, { messages: 0, summaries: 0 });
    }
    
    return this.userStats.get(userId);
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
    
    this.userStats.set(userId, stats);
  }
  
  /**
   * Clean up old conversations (older than 24 hours)
   */
  cleanupOldConversations() {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    for (const [userId, timestamp] of this.lastMessageTimestamps.entries()) {
      if (timestamp < oneDayAgo) {
        // Clean up data for inactive users
        this.conversations.delete(userId);
        this.lastMessageTimestamps.delete(userId);
        // We keep user stats permanently
      }
    }
    
    logger.info(`Cleaned up conversation history for inactive users. Active users: ${this.conversations.size}`);
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
    
    // Save stats one last time
    try {
      await this.saveUserStats();
      logger.info('Final user stats saved before shutdown');
    } catch (error) {
      logger.error('Failed to save user stats during shutdown:', error);
    }
  }
}

module.exports = new ConversationManager();
