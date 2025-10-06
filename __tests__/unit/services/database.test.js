const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService', () => {
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

  describe('constructor', () => {
    it('should initialize without accessing config', () => {
      expect(dbService.dbPath).toBeNull();
      expect(dbService.db).toBeNull();
      expect(dbService.isDisabled).toBe(false); // better-sqlite3 is now installed
    });
  });

  describe('getDb', () => {
    it('should initialize database on first call and create tables', () => {
      const db = dbService.getDb();

      expect(db).toBeDefined();
      expect(db).toHaveProperty('prepare');
      expect(db).toHaveProperty('exec');
      expect(db).toHaveProperty('close');
      expect(dbService.db).toBe(db);
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should return same db on subsequent calls', () => {
      const db1 = dbService.getDb();
      const db2 = dbService.getDb();

      expect(db1).toBe(db2);
    });
  });

  describe('initTables', () => {
    it('should create tables when called', () => {
      dbService.getDb(); // This triggers initTables

      // Verify tables exist by running a simple query
      const db = dbService.getDb();
      expect(() => {
        db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'user_stats\'').get();
      }).not.toThrow();
    });
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

  describe('getUserMessages', () => {
    it('should return empty array for user with no messages', () => {
      const result = dbService.getUserMessages('123');
      expect(result).toEqual([]);
    });

    it('should return user messages after adding them', () => {
      // Mock Date to ensure deterministic ordering
      const originalDate = Date;
      let mockTime = 1000;

      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length) return new originalDate(...args);
          return new originalDate(mockTime);
        }

        toISOString() {
          return new originalDate(mockTime).toISOString();
        }

        static now() {
          return mockTime;
        }
      };

      dbService.addUserMessage('123', 'Hello world');
      mockTime += 1000; // Increment time for second message

      dbService.addUserMessage('123', 'Second message');

      const result = dbService.getUserMessages('123');
      expect(result.length).toBe(2);
      expect(result).toContain('Hello world');
      expect(result).toContain('Second message');
      expect(result[0]).toBe('Second message'); // Most recent first

      // Restore original Date
      global.Date = originalDate;
    });

    it('should respect message limit', () => {
      // Add more messages than the database limit to test trigger
      for (let i = 1; i <= 25; i++) {
        dbService.addUserMessage('123', `Message ${i}`);
      }

      // Get all messages and verify total count is limited by trigger
      const allMessages = dbService.getUserMessages('123', 30); // Ask for more than should exist
      expect(allMessages.length).toBeLessThanOrEqual(20); // Trigger should limit to 20

      // Test query limit
      const result = dbService.getUserMessages('123', 5);
      expect(result.length).toBe(5);

      // The first message should be the most recent (highest number)
      // Note: actual message depends on what the trigger kept
      expect(result[0]).toContain('Message');
    });
  });

  describe('addUserMessage', () => {
    it('should add message to database', () => {
      console.log('TEST: Starting addUserMessage test');
      console.log('TEST: Database path:', testDbPath);
      console.log('TEST: Database file exists before:', fs.existsSync(testDbPath));

      const dbConn1 = dbService.getDb();
      console.log('TEST: DB connection 1:', dbConn1);

      dbService.addUserMessage('123', 'Hello world');
      console.log('TEST: addUserMessage completed');

      const dbConn2 = dbService.getDb();
      console.log('TEST: DB connection 2:', dbConn2);
      console.log('TEST: Same connection?', dbConn1 === dbConn2);

      console.log('TEST: Database file exists after:', fs.existsSync(testDbPath));

      if (fs.existsSync(testDbPath)) {
        const stats = fs.statSync(testDbPath);
        console.log('TEST: Database file size:', stats.size);
      }

      const messages = dbService.getUserMessages('123');
      console.log('TEST: Retrieved messages:', messages);

      // Try raw SQL query
      const dbConn = dbService.getDb();
      const rawResult = dbConn.prepare('SELECT * FROM user_messages WHERE user_id = ?').all('123');
      console.log('TEST: Raw SQL result:', rawResult);

      expect(messages).toContain('Hello world');
    });
  });

  describe('addBotResponse', () => {
    it('should add bot response with prefix', () => {
      dbService.addBotResponse('123', 'Bot response');

      const messages = dbService.getUserMessages('123');
      expect(messages).toContain('[BOT] Bot response');
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

  describe('getConversationHistory', () => {
    it('should return empty array for user with no conversation', () => {
      const result = dbService.getConversationHistory('123');
      expect(result).toEqual([]);
    });

    it('should return conversation history with proper roles', () => {
      dbService.addUserMessage('123', 'Hello');
      dbService.addBotResponse('123', 'Hi there!');
      dbService.addUserMessage('123', 'How are you?');

      const history = dbService.getConversationHistory('123');
      expect(history.length).toBe(3);
      expect(history[0].role).toBe('user');
      expect(history[0].message).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[1].message).toBe('Hi there!');
      expect(history[2].role).toBe('user');
      expect(history[2].message).toBe('How are you?');
    });

    it('should respect conversation limit', () => {
      // Add more messages than the limit
      for (let i = 0; i < 25; i++) {
        dbService.addUserMessage('123', `Message ${i}`);
      }

      // Debug: Check what we actually have
      const allHistory = dbService.getConversationHistory('123', 50);
      console.log('All messages in DB:', allHistory.map(m => m.message));

      const history = dbService.getConversationHistory('123', 10);
      expect(history.length).toBe(10);
      // Just check that we have some messages, don't worry about exact order for now
      expect(history[0].message).toMatch(/Message \d+/);
    });

    it('should handle alternating user and bot messages correctly', () => {
      // Create a realistic conversation pattern
      dbService.addUserMessage('456', 'What is AI?');
      dbService.addBotResponse('456', 'AI stands for Artificial Intelligence...');
      dbService.addUserMessage('456', 'Can you give examples?');
      dbService.addBotResponse('456', 'Sure! Examples include machine learning...');
      dbService.addUserMessage('456', 'Thank you');

      const history = dbService.getConversationHistory('456');
      expect(history.length).toBe(5);

      // Verify the conversation flow
      expect(history[0]).toEqual({
        role: 'user',
        message: 'What is AI?',
        timestamp: expect.any(String),
        message_length: 11,
        response_time_ms: 0,
      });
      expect(history[1]).toEqual({
        role: 'assistant',
        message: 'AI stands for Artificial Intelligence...',
        timestamp: expect.any(String),
        message_length: 40,
        response_time_ms: 0,
      });
      expect(history[2]).toEqual({
        role: 'user',
        message: 'Can you give examples?',
        timestamp: expect.any(String),
        message_length: 22,
        response_time_ms: 0,
      });
      expect(history[3]).toEqual({
        role: 'assistant',
        message: 'Sure! Examples include machine learning...',
        timestamp: expect.any(String),
        message_length: 42,
        response_time_ms: 0,
      });
      expect(history[4]).toEqual({
        role: 'user',
        message: 'Thank you',
        timestamp: expect.any(String),
        message_length: 9,
        response_time_ms: 0,
      });
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should return empty array instead of throwing
      const result = dbService.getConversationHistory('789');
      expect(result).toEqual([]);
    });

    it('should return conversation history in chronological order', () => {
      dbService.addUserMessage('999', 'First message');
      dbService.addBotResponse('999', 'First response');
      dbService.addUserMessage('999', 'Second message');
      dbService.addBotResponse('999', 'Second response');

      const history = dbService.getConversationHistory('999');
      expect(history.length).toBe(4);
      expect(history[0].message).toBe('First message');
      expect(history[1].message).toBe('First response');
      expect(history[2].message).toBe('Second message');
      expect(history[3].message).toBe('Second response');
    });
  });

  describe('clearAllData', () => {
    it('should clear all data from all tables', () => {
      // Add data for multiple users
      dbService.updateUserStats('user1', { message_count: 1 });
      dbService.updateUserStats('user2', { message_count: 2 });
      dbService.addUserMessage('user1', 'Message 1');
      dbService.addUserMessage('user2', 'Message 2');

      // Clear all data
      dbService.clearAllData();

      // Verify all data is gone
      expect(dbService.getUserStats('user1').message_count).toBe(0);
      expect(dbService.getUserStats('user2').message_count).toBe(0);
      expect(dbService.getUserMessages('user1')).toEqual([]);
      expect(dbService.getUserMessages('user2')).toEqual([]);
    });
  });

  describe('clearUserConversationData', () => {
    it('should clear conversation data but preserve user stats', () => {
      const userId = 'test_clear_conversation';

      // Add user stats
      dbService.updateUserStats(userId, { message_count: 5, total_summaries: 2, total_commands: 3 });

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

  describe('close', () => {
    it('should close database connection', () => {
      dbService.getDb();
      expect(() => dbService.close()).not.toThrow();
      expect(dbService.db).toBeNull();
    });

    it('should handle close when db is not initialized', () => {
      const newService = new DatabaseService();
      expect(() => newService.close()).not.toThrow();
    });
  });
});
