// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

const userMessages = (svc, id, limit = 10) =>
  svc
    .getDb()
    .prepare('SELECT message FROM user_messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
    .all(id, limit)
    .map((row) => row.message);

describe('DatabaseService - User Stats', function () {
  let dbService;

  beforeEach(() => {
    jest.clearAllMocks();
    dbService = new DatabaseService();
    // Force re-initialization for each test
    dbService.db = null;
    dbService.dbPath = ':memory:';
  });

  afterEach(() => {
    if (dbService.db && !dbService.isDisabled) {
      try {
        dbService.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
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
      const messages = userMessages(dbService, '123');

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
      expect(userMessages(dbService, userId)).toContain('Test message 1');
      expect(userMessages(dbService, userId)).toContain('Test message 2');
      expect(dbService.getConversationHistory(userId).length).toBe(3); // 2 user + 1 bot

      // Clear conversation data only
      dbService.clearUserConversationData(userId);

      // Verify conversation data is cleared but stats are preserved
      expect(dbService.getUserStats(userId).message_count).toBe(7);
      expect(dbService.getUserStats(userId).total_summaries).toBe(2);
      expect(dbService.getUserStats(userId).total_commands).toBe(3);
      expect(userMessages(dbService, userId)).toEqual([]);
      expect(dbService.getConversationHistory(userId)).toEqual([]);
    });
  });
});
