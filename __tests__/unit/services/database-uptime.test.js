// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Uptime', function () {
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

  describe('logBotEvent', () => {
    it('should record uptime without throwing', () => {
      expect(() => {
        dbService.logBotEvent('stop', 3600); // 1 hour in seconds
      }).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should not throw even with database error
      expect(() => {
        dbService.logBotEvent('stop', 3600);
      }).not.toThrow();
    });

    it('should handle zero uptime', () => {
      expect(() => {
        dbService.logBotEvent('stop', 0);
      }).not.toThrow();
    });

    it('should handle negative uptime', () => {
      expect(() => {
        dbService.logBotEvent('stop', -100);
      }).not.toThrow();
    });
  });
});
