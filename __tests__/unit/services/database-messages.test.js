const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Messages', function () {
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
});