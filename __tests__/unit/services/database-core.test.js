// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Core', function () {
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

  describe('constructor', () => {
    it('should initialize without accessing config', () => {
      expect(dbService.dbPath).toBe(':memory:');
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
});
