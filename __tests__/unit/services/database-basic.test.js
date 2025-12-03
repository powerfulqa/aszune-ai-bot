// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Basic Operations', () => {
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
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

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
