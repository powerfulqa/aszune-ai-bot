/**
 * ConversationManager Critical Coverage Tests - Memory and Performance
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

describe('ConversationManager - Memory and Performance', () => {
  let conversationManager;
  let originalEnv;

  const setupMocks = () => {
    // Clear database state
    mockDatabaseState.clear();

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
  };

  beforeEach(() => {
    jest.clearAllMocks();

    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'development';

    setupMocks();
    conversationManager = new ConversationManager();
  });

  afterEach(async () => {
    process.env = originalEnv;

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
});
