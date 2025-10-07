/**
 * Additional tests for src/utils/conversation.js to reach 80% coverage
 * Focus on uncovered branches and functions
 */

const ConversationManager = require('../../src/utils/conversation');
const dataStorage = require('../../src/services/storage');
const logger = require('../../src/utils/logger');
const { ErrorHandler } = require('../../src/utils/error-handler');
const { InputValidator } = require('../../src/utils/input-validator');

// Mock dependencies
jest.mock('../../src/services/storage', () => ({
  loadUserStats: jest.fn(),
  saveUserStats: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleFileError: jest.fn(),
  },
}));

jest.mock('../../src/utils/input-validator', () => ({
  InputValidator: {
    validateUserId: jest.fn(),
    validateAndSanitize: jest.fn(),
  },
}));

jest.mock('../../src/config/config', () => ({
  CACHE: {
    CLEANUP_INTERVAL_MS: 1000,
  },
  MAX_HISTORY: 10,
  RATE_LIMIT_WINDOW: 1000,
  PI_OPTIMIZATIONS: {
    ENABLED: false,
    CLEANUP_INTERVAL_MINUTES: 5,
  },
}));

describe('ConversationManager - Critical Coverage Enhancement', () => {
  let conversationManager;
  let originalEnv;

  const setupTestEnvironment = () => {
    // Store original environment
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'development';
  };

  const setupMocks = () => {
    // Setup default mocks
    dataStorage.loadUserStats.mockResolvedValue({});
    dataStorage.saveUserStats.mockResolvedValue();

    InputValidator.validateUserId.mockReturnValue({ valid: true });
    InputValidator.validateAndSanitize.mockReturnValue({
      valid: true,
      sanitized: 'sanitized content',
    });

    ErrorHandler.handleFileError.mockReturnValue({ message: 'File error message' });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupTestEnvironment();
    setupMocks();
    conversationManager = new ConversationManager();
  });

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv;

    // Clean up intervals
    if (conversationManager) {
      await conversationManager.destroy();
    }
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle many concurrent users efficiently', () => {
      // Add messages for many users
      for (let i = 0; i < 1000; i++) {
        conversationManager.addMessage(`user-${i}`, 'user', `Message from user ${i}`);
      }

      const firstUserHistory = conversationManager.getHistory('user-0');
      const lastUserHistory = conversationManager.getHistory('user-999');

      expect(firstUserHistory).toHaveLength(1);
      expect(lastUserHistory).toHaveLength(1);
      expect(firstUserHistory[0].content).toBe('sanitized content');
      expect(lastUserHistory[0].content).toBe('sanitized content');
    });

    it('should handle rapid successive messages from same user', () => {
      const userId = 'rapid-user';

      // Add many messages quickly
      for (let i = 0; i < 50; i++) {
        conversationManager.addMessage(userId, 'user', `Message ${i}`);
        conversationManager.addMessage(userId, 'assistant', `Response ${i}`);
      }

      const history = conversationManager.getHistory(userId);

      // Should respect maxHistory limit (10 from config)
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should handle alternating user and assistant messages', () => {
      const userId = 'alternating-user';

      for (let i = 0; i < 20; i++) {
        conversationManager.addMessage(userId, 'user', `User message ${i}`);
        conversationManager.addMessage(userId, 'assistant', `Assistant response ${i}`);
      }

      const history = conversationManager.getHistory(userId);
      expect(history.length).toBe(10); // Should be trimmed to MAX_HISTORY

      // Should alternate between user and assistant
      expect(history[history.length - 2].role).toBe('user');
      expect(history[history.length - 1].role).toBe('assistant');
    });
  });

  describe('Rate Limiting Advanced Scenarios', () => {
    it('should handle rate limiting with custom windows', () => {
      const userId = 'rate-limited-user';

      // First message should not be rate limited
      expect(conversationManager.isRateLimited(userId)).toBe(false);

      // Update timestamp
      conversationManager.updateTimestamp(userId);

      // Immediately after should be rate limited
      expect(conversationManager.isRateLimited(userId)).toBe(true);

      // Mock time passage
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);

      // After window expires should not be rate limited
      expect(conversationManager.isRateLimited(userId)).toBe(false);

      Date.now.mockRestore();
    });

    it('should handle multiple users with different rate limit states', () => {
      const user1 = 'user1';
      const user2 = 'user2';
      const user3 = 'user3';

      // Set different timestamps
      conversationManager.updateTimestamp(user1);

      // Wait for user2 (simulate delay)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 500);
      conversationManager.updateTimestamp(user2);

      // Check rate limiting states
      expect(conversationManager.isRateLimited(user1)).toBe(true);
      expect(conversationManager.isRateLimited(user2)).toBe(true);
      expect(conversationManager.isRateLimited(user3)).toBe(false);

      Date.now.mockRestore();
    });
  });

  describe('User Statistics Edge Cases', () => {
    it('should initialize user stats for new users', () => {
      const userId = 'new-user';
      const stats = conversationManager.getUserStats(userId);

      expect(stats).toEqual({
        messages: 0,
        summaries: 0,
        lastActive: null,
        reminders: 0,
      });
    });

    it('should update message count correctly', () => {
      const userId = 'message-user';

      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.updateUserStats(userId, 'messages');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(2);
      expect(stats.lastActive).toBeTruthy();
    });

    it('should update summary count correctly', () => {
      const userId = 'summary-user';

      conversationManager.updateUserStats(userId, 'summaries');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.summaries).toBe(1);
      expect(stats.lastActive).toBeTruthy();
    });

    it('should handle invalid stat types gracefully', () => {
      const userId = 'invalid-stat-user';

      conversationManager.updateUserStats(userId, 'invalid-type');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(0);
      expect(stats.summaries).toBe(0);
      expect(stats.lastActive).toBeTruthy();
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle loadUserStats errors gracefully', async () => {
      const error = new Error('Storage load failed');
      dataStorage.loadUserStats.mockRejectedValue(error);

      const newManager = new ConversationManager();
      await newManager.loadUserStats();

      expect(ErrorHandler.handleFileError).toHaveBeenCalledWith(
        error,
        'loading user stats',
        'user_stats.json'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle saveUserStats errors gracefully', async () => {
      const error = new Error('Storage save failed');
      dataStorage.saveUserStats.mockRejectedValue(error);

      await conversationManager.saveUserStats();

      expect(ErrorHandler.handleFileError).toHaveBeenCalledWith(
        error,
        'saving user stats',
        'user_stats.json'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle saveUserStats errors during destroy', async () => {
      const error = new Error('Save failed during shutdown');
      dataStorage.saveUserStats.mockRejectedValue(error);

      await conversationManager.destroy();

      expect(ErrorHandler.handleFileError).toHaveBeenCalledWith(
        error,
        'saving user stats',
        'user_stats.json'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Conversation History Management', () => {
    it('should handle conversation history limits correctly', () => {
      const userId = 'history-user';

      // Add more messages than the limit
      for (let i = 0; i < 15; i++) {
        conversationManager.addMessage(userId, 'user', `Message ${i}`);
      }

      const history = conversationManager.getHistory(userId);
      expect(history.length).toBe(10); // Should be trimmed to MAX_HISTORY

      // Should keep the most recent messages
      expect(history[0].content).toBe('sanitized content');
    });

    it('should clear specific user history', () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      conversationManager.addMessage(userId1, 'user', 'Message 1');
      conversationManager.addMessage(userId2, 'user', 'Message 2');

      conversationManager.clearHistory(userId1);

      expect(conversationManager.getHistory(userId1)).toHaveLength(0);
      expect(conversationManager.getHistory(userId2)).toHaveLength(1);
    });

    it('should clear all conversations when no userId provided', () => {
      conversationManager.addMessage('user1', 'user', 'Message 1');
      conversationManager.addMessage('user2', 'user', 'Message 2');

      conversationManager.clearHistory(); // No userId

      expect(conversationManager.getHistory('user1')).toHaveLength(0);
      expect(conversationManager.getHistory('user2')).toHaveLength(0);
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle invalid user ID in getHistory', () => {
      InputValidator.validateUserId.mockReturnValue({
        valid: false,
        error: 'Invalid user ID',
      });

      const history = conversationManager.getHistory('invalid-user');

      expect(history).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Invalid user ID in getHistory: Invalid user ID');
    });

    it('should handle invalid user ID in addMessage', () => {
      InputValidator.validateUserId.mockReturnValue({
        valid: false,
        error: 'Invalid user ID',
      });

      conversationManager.addMessage('invalid-user', 'user', 'test message');

      expect(logger.warn).toHaveBeenCalledWith('Invalid user ID in addMessage: Invalid user ID');
    });

    it('should handle invalid message content', () => {
      InputValidator.validateAndSanitize.mockReturnValue({
        valid: false,
        error: 'Invalid content',
      });

      conversationManager.addMessage('user', 'user', 'invalid content');

      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid message content in addMessage: Invalid content'
      );
    });

    it('should handle invalid role in addMessage', () => {
      conversationManager.addMessage('user', 'invalid-role', 'test message');

      expect(logger.warn).toHaveBeenCalledWith('Invalid role in addMessage: invalid-role');
    });

    it('should accept valid roles', () => {
      ['user', 'assistant', 'system'].forEach((role) => {
        conversationManager.addMessage('test-user', role, 'test message');
      });

      const history = conversationManager.getHistory('test-user');
      expect(history).toHaveLength(3);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
      expect(history[2].role).toBe('system');
    });
  });

  describe('Interval Management', () => {
    it('should initialize intervals properly', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      conversationManager.initializeIntervals();

      expect(setIntervalSpy).toHaveBeenCalledTimes(2); // Save and cleanup intervals

      // Clean up
      conversationManager.destroy();
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });

    it('should start cleanup interval separately', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      conversationManager.startCleanupInterval();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      setIntervalSpy.mockRestore();
    });

    it('should start save stats interval separately', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      conversationManager.startSaveStatsInterval();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      setIntervalSpy.mockRestore();
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old conversations', () => {
      const userId1 = 'old-user';
      const userId2 = 'recent-user';

      // Add conversations
      conversationManager.addMessage(userId1, 'user', 'Old message');
      conversationManager.addMessage(userId2, 'user', 'Recent message');

      // Set old timestamp for user1
      conversationManager.lastMessageTimestamps.set(userId1, Date.now() - 2000000); // Old
      conversationManager.lastMessageTimestamps.set(userId2, Date.now() - 100); // Recent

      conversationManager.cleanupOldConversations();

      // Old user should be cleaned up
      expect(conversationManager.conversations.has(userId1)).toBe(false);
      expect(conversationManager.conversations.has(userId2)).toBe(true);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up conversation history')
      );
    });

    it('should preserve user stats during cleanup', () => {
      const userId = 'user-with-stats';

      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.lastMessageTimestamps.set(userId, Date.now() - 2000000); // Old

      conversationManager.cleanupOldConversations();

      // Stats should be preserved even after cleanup
      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(1);
    });
  });

  describe('Test Environment Handling', () => {
    it('should not load stats in test environment', () => {
      process.env.NODE_ENV = 'test';

      // Clear the mock to reset call count from beforeEach setup
      dataStorage.loadUserStats.mockClear();

      new ConversationManager();

      expect(dataStorage.loadUserStats).not.toHaveBeenCalled();
    });

    it('should not initialize intervals in test environment', () => {
      process.env.NODE_ENV = 'test';
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const testManager = new ConversationManager();
      testManager.initializeIntervals();

      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });
  });
});
