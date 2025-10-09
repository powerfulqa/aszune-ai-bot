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

// Mock database service for stats tracking
const mockDatabaseService = {
  getUserStats: jest.fn(),
  getUserReminderCount: jest.fn(),
  updateUserStats: jest.fn(),
  addUserMessage: jest.fn(),
  addBotResponse: jest.fn(),
};

jest.mock('../../src/services/database', () => mockDatabaseService);

const ConversationManager = require('../../src/utils/conversation');
let conversationManager;

describe('Conversation Manager - Advanced Features', () => {
  beforeEach(() => {
    conversationManager = new ConversationManager();
    jest.clearAllMocks();

    // Configure database mocks with default returns
    mockDatabaseService.getUserStats.mockReturnValue({
      user_id: '123456789012345678',
      message_count: 0,
      total_summaries: 0,
      last_active: null,
    });
    mockDatabaseService.getUserReminderCount.mockReturnValue(0);

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
      
      // Mock getUserStats to return 1 message after addMessage
      mockDatabaseService.getUserStats.mockReturnValueOnce({
        user_id: userId,
        message_count: 1,
        total_summaries: 0,
        last_active: new Date().toISOString(),
      });
      
      conversationManager.addMessage(userId, 'user', 'hello');

      expect(conversationManager.getHistory(userId)).toHaveLength(1);
      expect(conversationManager.getUserStats(userId).messages).toBe(1);

      conversationManager.destroy();

      expect(conversationManager.getHistory(userId)).toHaveLength(0);
      expect(conversationManager.getUserStats(userId).messages).toBe(0);
    });

    it('should clear inactive conversations after timeout', () => {
      const userId = '123456789012345678';
      conversationManager.addMessage(userId, 'user', 'test message');

      // Mock the timestamp to be old
      const oldTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      conversationManager.lastMessageTimestamps.set(userId, oldTimestamp);

      // Should clear due to inactivity
      conversationManager.checkAndClearInactiveConversation(userId);
      expect(conversationManager.getHistory(userId)).toHaveLength(0);
    });

    it('handles saveUserStats errors during destroy', async () => {
      const userId = '123456789012345678';
      conversationManager.addMessage(userId, 'user', 'test message');

      // Spy on saveUserStats and make it throw
      const saveUserStatsSpy = jest.spyOn(conversationManager, 'saveUserStats');
      saveUserStatsSpy.mockRejectedValue(new Error('Save failed'));

      // The destroy method should handle the error gracefully
      await expect(conversationManager.destroy()).resolves.not.toThrow();

      saveUserStatsSpy.mockRestore();
    });
  });
});
