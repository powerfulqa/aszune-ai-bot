// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Conversations', () => {
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

  describe('getConversationHistory', () => {
    it('should return empty array for non-existent user', () => {
      const history = dbService.getConversationHistory('nonexistent');
      expect(history).toEqual([]);
    });

    it('should return conversation history in chronological order', () => {
      const userId = 'test-user';

      // Add conversation data
      dbService.addUserMessage(userId, 'Hello');
      dbService.addBotResponse(userId, 'Hi there!');
      dbService.addUserMessage(userId, 'How are you?');
      dbService.addBotResponse(userId, 'I am doing well, thank you!');

      const history = dbService.getConversationHistory(userId);
      expect(history.length).toBe(4);
      expect(history[0]).toEqual({
        role: 'user',
        message: 'Hello',
        timestamp: expect.any(String),
        message_length: 5,
        response_time_ms: 0,
      });
      expect(history[1]).toEqual({
        role: 'assistant',
        message: 'Hi there!',
        timestamp: expect.any(String),
        message_length: 9,
        response_time_ms: 0,
      });
      expect(history[2]).toEqual({
        role: 'user',
        message: 'How are you?',
        timestamp: expect.any(String),
        message_length: 12,
        response_time_ms: 0,
      });
      expect(history[3]).toEqual({
        role: 'assistant',
        message: 'I am doing well, thank you!',
        timestamp: expect.any(String),
        message_length: 27,
        response_time_ms: 0,
      });
    });

    it('should limit results when limit is specified', () => {
      const userId = 'test-user';

      // Add multiple messages
      for (let i = 0; i < 10; i++) {
        dbService.addUserMessage(userId, `Message ${i}`);
        dbService.addBotResponse(userId, `Response ${i}`);
      }

      const history = dbService.getConversationHistory(userId, 5);
      expect(history.length).toBe(5);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const history = dbService.getConversationHistory('test-user');
      expect(history).toEqual([]);
    });
  });

  describe('clearUserData', () => {
    it('should clear all user data', () => {
      const userId = 'test-user';

      // Add some data
      dbService.addUserMessage(userId, 'Test message');
      dbService.updateUserStats(userId, { message_count: 5 });

      // Verify data exists
      expect(dbService.getConversationHistory(userId).length).toBe(1);
      expect(dbService.getUserStats(userId).message_count).toBe(6); // 1 from addUserMessage + 5 from updateUserStats

      // Clear data
      dbService.clearUserData(userId);

      // Verify data is cleared
      expect(dbService.getConversationHistory(userId).length).toBe(0);
      expect(dbService.getUserStats(userId).message_count).toBe(0); // User deleted, returns default
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.clearUserData('test-user')).not.toThrow();
    });
  });

  describe('clearAllData', () => {
    it('should clear all data from all tables', () => {
      // Add data for multiple users
      dbService.addUserMessage('user1', 'Message 1');
      dbService.addUserMessage('user2', 'Message 2');
      dbService.updateUserStats('user1', { message_count: 10 });

      // Verify data exists
      expect(dbService.getConversationHistory('user1').length).toBe(1);
      expect(dbService.getConversationHistory('user2').length).toBe(1);
      expect(dbService.getUserStats('user1').message_count).toBe(11); // 1 from addUserMessage + 10 from updateUserStats

      // Clear all data
      dbService.clearAllData();

      // Verify all data is cleared
      expect(dbService.getConversationHistory('user1').length).toBe(0);
      expect(dbService.getConversationHistory('user2').length).toBe(0);
      expect(dbService.getUserStats('user1').message_count).toBe(0); // User deleted, returns default
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.clearAllData()).not.toThrow();
    });
  });

  describe('clearUserConversationData', () => {
    it('should clear only conversation data for specific user', () => {
      const userId = 'test-user';

      // Add conversation and stats data
      dbService.addUserMessage(userId, 'Test message');
      dbService.addBotResponse(userId, 'Test response');
      dbService.updateUserStats(userId, { message_count: 5 });

      // Verify data exists
      expect(dbService.getConversationHistory(userId).length).toBe(2);
      expect(dbService.getUserStats(userId).message_count).toBe(6); // 1 from addUserMessage + 1 from addBotResponse + 5 from updateUserStats

      // Clear conversation data only
      dbService.clearUserConversationData(userId);

      // Verify conversation data is cleared but stats remain
      expect(dbService.getConversationHistory(userId).length).toBe(0);
      expect(dbService.getUserStats(userId).message_count).toBe(6);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.clearUserConversationData('test-user')).not.toThrow();
    });
  });
});
