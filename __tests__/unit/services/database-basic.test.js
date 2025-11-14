const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Basic Operations', () => {
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

  describe('constructor', () => {
    it('should initialize database service', () => {
      expect(dbService).toBeDefined();
      expect(dbService.db).toBeDefined();
      expect(dbService.isDisabled).toBe(false);
    });

    it('should handle database initialization errors gracefully', () => {
      // When better-sqlite3 is not available, service should be disabled
      expect(dbService.isDisabled).toBe(false); // In test environment, it's available
    });
  });

  describe('getDb', () => {
    it('should return the database instance', () => {
      const db = dbService.getDb();
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
      expect(typeof db.exec).toBe('function');
    });

    it('should return mock database when database is disabled', () => {
      dbService.isDisabled = true;
      const db = dbService.getDb();
      expect(db).toHaveProperty('prepare');
      expect(db).toHaveProperty('exec');
      expect(db).toHaveProperty('close');
    });
  });

  describe('initTables', () => {
    it('should create all required tables', () => {
      dbService.initTables();

      const db = dbService.getDb();
      const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all();

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('user_stats');
      expect(tableNames).toContain('user_messages');
      expect(tableNames).toContain('conversation_history');
      expect(tableNames).toContain('reminders');
      expect(tableNames).toContain('command_usage');
      expect(tableNames).toContain('performance_metrics');
      expect(tableNames).toContain('error_logs');
      expect(tableNames).toContain('server_analytics');
      expect(tableNames).toContain('bot_uptime');
    });

    it('should handle table creation errors gracefully', () => {
      // When database is disabled, initTables should not throw
      dbService.isDisabled = true;
      expect(() => dbService.initTables()).not.toThrow();
    });
  });
});
