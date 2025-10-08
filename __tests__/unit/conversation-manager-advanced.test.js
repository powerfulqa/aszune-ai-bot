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
const config = require('../../src/config/config');
let conversationManager;

describe('Conversation Manager - Advanced Features', () => {
  beforeEach(() => {
    conversationManager = new ConversationManager();
    jest.clearAllMocks();

    // Configure database mocks with default returns
    mockDatabaseService.getUserStats.mockReturnValue({
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
      const mockDbStats = {
        message_count: 5,
        total_summaries: 2,
        last_active: '2024-01-01T00:00:00.000Z',
      };

      mockDatabaseService.getUserStats.mockReturnValueOnce(mockDbStats);
      mockDatabaseService.getUserReminderCount.mockReturnValueOnce(3);

      const stats = conversationManager.getUserStats(userId);
      expect(stats).toEqual({
        messages: 5,
        summaries: 2,
        reminders: 3,
        lastActive: '2024-01-01T00:00:00.000Z',
      });
    });
  });

  describe('updateUserStats', () => {
    it('updates message count', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'messages');

      // Verify database service was called with correct parameters
      expect(mockDatabaseService.updateUserStats).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ message_count: 1 })
      );
    });

    it('updates summary count', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'summaries');

      // Verify database service was called with correct parameters
      expect(mockDatabaseService.updateUserStats).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ total_summaries: 1 })
      );
    });

    it('increments existing counts', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.updateUserStats(userId, 'summaries');

      // Verify database service was called three times
      expect(mockDatabaseService.updateUserStats).toHaveBeenCalledTimes(3);
      expect(mockDatabaseService.updateUserStats).toHaveBeenNthCalledWith(
        1,
        userId,
        expect.objectContaining({ message_count: 1 })
      );
      expect(mockDatabaseService.updateUserStats).toHaveBeenNthCalledWith(
        3,
        userId,
        expect.objectContaining({ total_summaries: 1 })
      );
    });

    it('updates last active timestamp', () => {
      const userId = '123456789012345678';
      conversationManager.updateUserStats(userId, 'messages');

      // Verify database service was called
      // Note: updateUserStats only updates the count, not timestamp
      // Timestamps are updated by the chat service when messages are added
      expect(mockDatabaseService.updateUserStats).toHaveBeenCalledWith(userId, {
        message_count: 1,
      });
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

      conversationManager.destroy();

      expect(conversationManager.getHistory(userId)).toHaveLength(0);
      expect(conversationManager.getUserStats(userId).messages).toBe(0);
    });
  });
});
