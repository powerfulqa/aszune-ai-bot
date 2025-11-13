const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - User Management', () => {
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

    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('getUserStats', () => {
    it('should return default stats for non-existent user', () => {
      const stats = dbService.getUserStats('nonexistent');
      expect(stats).toEqual({
        user_id: 'nonexistent',
        message_count: 0,
        last_active: null,
        first_seen: null,
        total_summaries: 0,
        total_commands: 0,
        preferences: '{}',
        username: null,
      });
    });

    it('should return user stats when user exists', () => {
      const userId = 'test-user';
      const now = new Date().toISOString();

      // Add some data first
      dbService.updateUserStats(userId, { message_count: 5, last_active: now });

      const stats = dbService.getUserStats(userId);
      expect(stats.message_count).toBe(5);
      expect(stats.last_active).toBe(now);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const stats = dbService.getUserStats('test-user');
      expect(stats).toEqual({
        user_id: 'test-user',
        message_count: 0,
        last_active: null,
        first_seen: null,
        total_summaries: 0,
        total_commands: 0,
        preferences: '{}',
        username: null,
      });
    });
  });

  describe('updateUserStats', () => {
    it('should create user and update stats', () => {
      const userId = 'test-user';
      const stats = { message_count: 10, last_active: new Date().toISOString() };

      dbService.updateUserStats(userId, stats);

      const retrievedStats = dbService.getUserStats(userId);
      expect(retrievedStats.message_count).toBe(10);
      expect(retrievedStats.last_active).toBe(stats.last_active);
    });

    it('should update existing user stats', () => {
      const userId = 'test-user';

      // First update
      dbService.updateUserStats(userId, { message_count: 5 });

      // Second update
      const newTime = new Date().toISOString();
      dbService.updateUserStats(userId, { message_count: 10, last_active: newTime });

      const stats = dbService.getUserStats(userId);
      expect(stats.message_count).toBe(15); // 5 + 10 = 15
      expect(stats.last_active).toBe(newTime);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.updateUserStats('test-user', { message_count: 1 })).not.toThrow();
    });
  });

  describe('getUserMessages', () => {
    it('should return empty array for non-existent user', () => {
      const messages = dbService.getUserMessages('nonexistent');
      expect(messages).toEqual([]);
    });

    it('should return user messages in chronological order', () => {
      const userId = 'test-user';

      // Add messages
      dbService.addUserMessage(userId, 'First message');
      dbService.addBotResponse(userId, 'First response');
      dbService.addUserMessage(userId, 'Second message');

      const messages = dbService.getConversationHistory(userId);
      expect(messages.length).toBe(3);
      expect(messages[0].message).toBe('First message');
      expect(messages[0].role).toBe('user');
      expect(messages[1].message).toBe('First response');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].message).toBe('Second message');
      expect(messages[2].role).toBe('user');
    });

    it('should limit results when limit is specified', () => {
      const userId = 'test-user';

      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        dbService.addUserMessage(userId, `Message ${i}`);
      }

      const messages = dbService.getUserMessages(userId, 3);
      expect(messages.length).toBe(3);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const messages = dbService.getUserMessages('test-user');
      expect(messages).toEqual([]);
    });
  });

  describe('addUserMessage', () => {
    it('should add user message and create user if needed', () => {
      const userId = 'test-user';
      const message = 'Hello bot!';

      dbService.addUserMessage(userId, message);

      const messages = dbService.getConversationHistory(userId);
      expect(messages.length).toBe(1);
      expect(messages[0].message).toBe(message);
      expect(messages[0].role).toBe('user');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.addUserMessage('test-user', 'test')).not.toThrow();
    });
  });

  describe('addBotResponse', () => {
    it('should add bot response and create user if needed', () => {
      const userId = 'test-user';
      const response = 'Hello human!';

      dbService.addBotResponse(userId, response);

      const messages = dbService.getConversationHistory(userId);
      expect(messages.length).toBe(1);
      expect(messages[0].message).toBe(response);
      expect(messages[0].role).toBe('assistant');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.addBotResponse('test-user', 'test')).not.toThrow();
    });
  });
});
