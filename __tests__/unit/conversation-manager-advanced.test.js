/**
 * Conversation Manager Advanced Features Tests
 * Tests for rate limiting, statistics, and cleanup
 */

// Mock the config module
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));

// Mock the storage service
jest.mock('../../src/services/storage', () => ({
  loadUserStats: jest.fn().mockResolvedValue({}),
  saveUserStats: jest.fn().mockResolvedValue(),
}));

const ConversationManager = require('../../src/utils/conversation');
const config = require('../../src/config/config');
let conversationManager;

describe('Conversation Manager - Advanced Features', () => {
  beforeEach(() => {
    conversationManager = new ConversationManager();
    jest.clearAllMocks();

    // Clear all conversation data
    conversationManager.conversations.clear();
    conversationManager.lastMessageTimestamps.clear();
    conversationManager.userStats.clear();
  });

  afterEach(() => {
    // Clear intervals to avoid memory leaks
    if (conversationManager.cleanupInterval) {
      clearInterval(conversationManager.cleanupInterval);
    }
    if (conversationManager.saveStatsInterval) {
      clearInterval(conversationManager.saveStatsInterval);
    }
  });

  describe('isRateLimited', () => {
    it('returns false for new users', () => {
      const userId = '123456789012345678';
      expect(conversationManager.isRateLimited(userId)).toBe(false);
    });

    it('returns true for users within rate limit window', () => {
      const userId = '123456789012345678';
      const now = Date.now();

      // Set timestamp to current time
      conversationManager.lastMessageTimestamps.set(userId, now);

      expect(conversationManager.isRateLimited(userId)).toBe(true);
    });

    it('returns false for users outside rate limit window', () => {
      const userId = '123456789012345678';
      const pastTime = Date.now() - (config.RATE_LIMIT_WINDOW + 1000);

      // Set timestamp to past time
      conversationManager.lastMessageTimestamps.set(userId, pastTime);

      expect(conversationManager.isRateLimited(userId)).toBe(false);
    });
  });

  describe('getUserStats', () => {
    it('returns default stats for new users', () => {
      const userId = '123456789012345678';
      const stats = conversationManager.getUserStats(userId);
      expect(stats).toEqual({
        messages: 0,
        summaries: 0,
        lastActive: null,
        reminders: 0,
      });
    });

    it('returns existing stats for users with history', () => {
      const userId = '123456789012345678';
      const mockStats = {
        messages: 5,
        summaries: 2,
        lastActive: Date.now(),
      };

      conversationManager.userStats.set(userId, mockStats);
      const stats = conversationManager.getUserStats(userId);
      expect(stats).toEqual(mockStats);
    });
  });

  describe('updateUserStats', () => {
    it('updates message count', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'messages');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(1);
    });

    it('updates summary count', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'summaries');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.summaries).toBe(1);
    });

    it('increments existing counts', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.updateUserStats(userId, 'summaries');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(2);
      expect(stats.summaries).toBe(1);
    });

    it('updates last active timestamp', () => {
      const userId = '123456789012345678';
      const beforeUpdate = Date.now();
      conversationManager.updateUserStats(userId, 'messages');
      const afterUpdate = Date.now();

      const stats = conversationManager.getUserStats(userId);
      expect(stats.lastActive).toBeGreaterThanOrEqual(beforeUpdate);
      expect(stats.lastActive).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('destroy', () => {
    it('clears all intervals', () => {
      // Start intervals
      conversationManager.startCleanupInterval();
      conversationManager.startSaveStatsInterval();

      expect(conversationManager.cleanupInterval).toBeDefined();
      expect(conversationManager.saveStatsInterval).toBeDefined();

      // Destroy should clear intervals
      conversationManager.destroy();

      expect(conversationManager.cleanupInterval).toBeNull();
      expect(conversationManager.saveStatsInterval).toBeNull();
    });

    it('clears all conversation data', () => {
      const userId = '123456789012345678';
      conversationManager.addMessage(userId, 'user', 'hello');

      expect(conversationManager.getHistory(userId)).toHaveLength(1);
      expect(conversationManager.getUserStats(userId).messages).toBe(1);

      conversationManager.destroy();

      expect(conversationManager.getHistory(userId)).toHaveLength(0);
      expect(conversationManager.getUserStats(userId).messages).toBe(0);
    });
  });
});
