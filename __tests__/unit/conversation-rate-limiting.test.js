/**
 * ConversationManager Critical Coverage Tests - Rate Limiting and Validation
 */

// Mock database service for stats tracking
const mockDatabaseService = {
  getUserStats: jest.fn(),
  getUserReminderCount: jest.fn(),
  updateUserStats: jest.fn(),
  addUserMessage: jest.fn(),
  addBotResponse: jest.fn(),
};

// Track database state for testing
const mockDatabaseState = new Map();

jest.mock('../../src/services/database', () => mockDatabaseService);

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
  debug: jest.fn(),
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

describe('ConversationManager - Rate Limiting and Validation', () => {
  let conversationManager;
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear database state
    mockDatabaseState.clear();

    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'development';

    dataStorage.loadUserStats.mockResolvedValue({});
    dataStorage.saveUserStats.mockResolvedValue();

    // Configure database mocks with state tracking
    mockDatabaseService.getUserStats.mockImplementation((userId) => {
      const stats = mockDatabaseState.get(userId) || {
        message_count: 0,
        total_summaries: 0,
        last_active: null,
      };
      return stats;
    });

    mockDatabaseService.getUserReminderCount.mockReturnValue(0);

    mockDatabaseService.updateUserStats.mockImplementation((userId, updates) => {
      const currentStats = mockDatabaseState.get(userId) || {
        message_count: 0,
        total_summaries: 0,
        last_active: null,
      };

      const newStats = { ...currentStats };
      if (updates.message_count !== undefined) {
        newStats.message_count = (newStats.message_count || 0) + updates.message_count;
      }
      if (updates.total_summaries !== undefined) {
        newStats.total_summaries = (newStats.total_summaries || 0) + updates.total_summaries;
      }
      if (updates.last_active !== undefined) {
        newStats.last_active = updates.last_active;
      }

      mockDatabaseState.set(userId, newStats);
    });

    InputValidator.validateUserId.mockReturnValue({ valid: true });
    InputValidator.validateAndSanitize.mockReturnValue({
      valid: true,
      sanitized: 'sanitized content',
    });

    ErrorHandler.handleFileError.mockReturnValue({ message: 'File error message' });

    conversationManager = new ConversationManager();
  });

  afterEach(async () => {
    process.env = originalEnv;

    if (conversationManager) {
      await conversationManager.destroy();
    }
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
    });

    it('should handle invalid stat types gracefully', () => {
      const userId = 'invalid-stat-user';

      conversationManager.updateUserStats(userId, 'invalid-type');

      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(0);
      expect(stats.summaries).toBe(0);
    });
  });
});
