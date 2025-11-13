const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - User Stats', function () {
  let dbService;
  const testDbPath = path.resolve('./test-data/bot.db');

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure test data directory exists
    const testDataDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    dbService = new DatabaseService();
  });

  afterEach(() => {
    if (dbService.db && !dbService.isDisabled) {
      try {
        dbService.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Clean up test database file and directory
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Clean up test directory if empty
    const testDataDir = path.dirname(testDbPath);
    try {
      if (fs.existsSync(testDataDir)) {
        const files = fs.readdirSync(testDataDir);
        if (files.length === 0) {
          fs.rmdirSync(testDataDir);
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('getUserStats', () => {
    it('should return default stats for non-existing user', () => {
      const result = dbService.getUserStats('123');

      expect(result).toEqual({
        user_id: '123',
        message_count: 0,
        last_active: null,
        first_seen: null,
        total_summaries: 0,
        total_commands: 0,
        preferences: '{}',
        username: null,
      });
    });

    it('should return actual stats after user activity', () => {
      // First, update user stats
      dbService.updateUserStats('456', {
        message_count: 5,
        last_active: '2023-01-01T00:00:00.000Z',
      });

      const result = dbService.getUserStats('456');
      expect(result.user_id).toBe('456');
      expect(result.message_count).toBe(5);
      expect(result.last_active).toBe('2023-01-01T00:00:00.000Z');
    });
  });

  describe('updateUserStats', () => {
    it('should update user stats correctly', () => {
      const testDate = '2023-01-02T00:00:00.000Z';
      dbService.updateUserStats('123', {
        message_count: 1,
        last_active: testDate,
      });

      const result = dbService.getUserStats('123');
      expect(result.user_id).toBe('123');
      expect(result.message_count).toBe(1);
      expect(result.last_active).toBe(testDate);
    });

    it('should handle empty updates gracefully', () => {
      expect(() => dbService.updateUserStats('123', {})).not.toThrow();
    });
  });

  describe('ensureUserExists', () => {
    it('should create user if they do not exist', () => {
      const userId = 'ensure_exists_user';

      // Verify user doesn't exist initially
      const initialStats = dbService.getUserStats(userId);
      expect(initialStats.message_count).toBe(0);

      // Ensure user exists
      dbService.ensureUserExists(userId);

      // Verify user now exists with default values
      const stats = dbService.getUserStats(userId);
      expect(stats.user_id).toBe(userId);
      expect(stats.message_count).toBe(0);
      expect(stats.total_summaries).toBe(0);
      expect(stats.total_commands).toBe(0);
      expect(stats.preferences).toBe('{}');
      expect(stats.first_seen).toBeDefined();
      expect(stats.last_active).toBeDefined();
    });

    it('should not modify existing user', () => {
      const userId = 'existing_user';
      const testDate = '2023-01-01T00:00:00.000Z';

      // Create user with specific data
      dbService.updateUserStats(userId, {
        message_count: 5,
        total_summaries: 2,
        last_active: testDate,
      });

      // Ensure user exists (should not change anything)
      dbService.ensureUserExists(userId);

      // Verify data is unchanged
      const stats = dbService.getUserStats(userId);
      expect(stats.message_count).toBe(5);
      expect(stats.total_summaries).toBe(2);
      expect(stats.last_active).toBe(testDate);
    });

    it('should handle database errors gracefully', () => {
      const newService = new DatabaseService();
      newService.isDisabled = true;

      expect(() => newService.ensureUserExists('user')).not.toThrow();
    });
  });

  describe('clearUserData', () => {
    it('should delete all user data', () => {
      // Add some data
      dbService.updateUserStats('123', { message_count: 5 });
      dbService.addUserMessage('123', 'Test message');

      // Clear the data
      dbService.clearUserData('123');

      // Verify it's gone
      const stats = dbService.getUserStats('123');
      const messages = dbService.getUserMessages('123');

      expect(stats.message_count).toBe(0);
      expect(messages).toEqual([]);
    });
  });

  describe('clearUserConversationData', () => {
    it('should clear conversation data but preserve user stats', () => {
      const userId = 'test_clear_conversation';

      // Add user stats
      dbService.updateUserStats(userId, {
        message_count: 5,
        total_summaries: 2,
        total_commands: 3,
      });

      // Add conversation data
      dbService.addUserMessage(userId, 'Test message 1');
      dbService.addUserMessage(userId, 'Test message 2');
      dbService.addBotResponse(userId, 'Bot response');

      // Verify data exists
      expect(dbService.getUserStats(userId).message_count).toBe(7); // 5 + 2 messages
      expect(dbService.getUserStats(userId).total_summaries).toBe(2);
      expect(dbService.getUserStats(userId).total_commands).toBe(3);
      expect(dbService.getUserMessages(userId)).toContain('Test message 1');
      expect(dbService.getUserMessages(userId)).toContain('Test message 2');
      expect(dbService.getConversationHistory(userId).length).toBe(3); // 2 user + 1 bot

      // Clear conversation data only
      dbService.clearUserConversationData(userId);

      // Verify conversation data is cleared but stats are preserved
      expect(dbService.getUserStats(userId).message_count).toBe(7);
      expect(dbService.getUserStats(userId).total_summaries).toBe(2);
      expect(dbService.getUserStats(userId).total_commands).toBe(3);
      expect(dbService.getUserMessages(userId)).toEqual([]);
      expect(dbService.getConversationHistory(userId)).toEqual([]);
    });
  });

  describe('exportUserData', () => {
    it('should export user data successfully', () => {
      const userId = 'export_test_user';

      // Add some data for the user
      dbService.updateUserStats(userId, { total_summaries: 1 });
      dbService.addUserMessage(userId, 'Test message');
      dbService.trackCommandUsage(userId, 'help', 'server123', true, 500);

      const exportData = dbService.exportUserData(userId);

      expect(exportData).toBeDefined();
      expect(exportData.userId).toBe(userId);
      expect(exportData.userStats.user_id).toBe(userId);
      expect(exportData.userStats.message_count).toBe(1); // addUserMessage increments this
      expect(exportData.conversationHistory.length).toBe(1);
      expect(exportData.commandUsage.length).toBe(1);
    });

    it('should return null for database errors', () => {
      const newService = new DatabaseService();
      newService.isDisabled = true;

      const exportData = newService.exportUserData('user');
      expect(exportData).toBeNull();
    });
  });
});
