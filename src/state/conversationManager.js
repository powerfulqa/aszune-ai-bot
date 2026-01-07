/**
 * ConversationManager Singleton Module
 *
 * This module exports a single shared instance of ConversationManager to ensure
 * consistent state across all parts of the application. This eliminates issues
 * with duplicate rate limiting, divergent conversation histories, and redundant
 * background intervals.
 *
 * @module state/conversationManager
 */

const ConversationManager = require('../utils/conversation');

// Create the singleton instance
const conversationManager = new ConversationManager();

// Track if intervals have been initialized (to prevent multiple initializations)
let _intervalsInitialized = false;

/**
 * Initialize intervals for the singleton instance.
 * Should be called once during application startup (in src/index.js).
 * Safe to call multiple times - subsequent calls are no-ops.
 */
function initializeIntervals() {
  if (_intervalsInitialized) {
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    conversationManager.initializeIntervals();
    _intervalsInitialized = true;
  }
}

/**
 * Reset singleton state for testing purposes.
 * Only available when NODE_ENV=test.
 */
function resetForTests() {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  // Clear all conversation data
  conversationManager.conversations.clear();
  conversationManager.lastMessageTimestamps.clear();
  conversationManager.userStats.clear();

  // Clear any active intervals
  if (conversationManager.activeIntervals) {
    conversationManager.activeIntervals.forEach((interval) => clearInterval(interval));
    conversationManager.activeIntervals.clear();
  }

  // Reset initialization flag
  _intervalsInitialized = false;
}

/**
 * Check if intervals have been initialized
 * @returns {boolean}
 */
function isInitialized() {
  return _intervalsInitialized;
}

// Export singleton instance and helpers
module.exports = conversationManager;
module.exports.conversationManager = conversationManager;
module.exports.initializeIntervals = initializeIntervals;
module.exports.resetForTests = resetForTests;
module.exports.isInitialized = isInitialized;
module.exports.default = conversationManager;
