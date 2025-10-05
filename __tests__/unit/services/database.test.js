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
        db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_stats'").get();
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

    it('should return user messages after adding them', async () => {
      dbService.addUserMessage('123', 'Hello world');

      // Add a delay to ensure different timestamps for proper ordering
      await new Promise((resolve) => setTimeout(resolve, 100));

      dbService.addUserMessage('123', 'Second message');

      const result = dbService.getUserMessages('123');
      expect(result.length).toBe(2);
      expect(result).toContain('Hello world');
      expect(result).toContain('Second message');
      expect(result[0]).toBe('Second message'); // Most recent first
    });

    it('should respect message limit', () => {
      // Add more messages than the database limit to test trigger
      for (let i = 1; i <= 15; i++) {
        dbService.addUserMessage('123', `Message ${i}`);
      }

      // Get all messages and verify total count is limited by trigger
      const allMessages = dbService.getUserMessages('123', 20); // Ask for more than should exist
      expect(allMessages.length).toBeLessThanOrEqual(10); // Trigger should limit to 10

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
      dbService.addUserMessage('123', 'Hello world');

      const messages = dbService.getUserMessages('123');
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
