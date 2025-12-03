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

  describe('getUptimeStats', () => {
    it('should return default uptime stats when no data exists', () => {
      const stats = dbService.getUptimeStats();
      expect(stats).toEqual({
        totalUptime: 0,
        totalDowntime: 0,
        restartCount: 0,
      });
    });

    it('should calculate uptime statistics correctly', () => {
      dbService.logBotEvent('stop', 3600); // 1 hour
      dbService.logBotEvent('stop', 7200); // 2 hours
      dbService.logBotEvent('restart'); // restart event

      const stats = dbService.getUptimeStats();
      expect(stats.totalUptime).toBe(10800); // 3 hours total
      expect(stats.restartCount).toBe(1);
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should return default stats instead of throwing
      const stats = dbService.getUptimeStats();
      expect(stats).toEqual({
        totalUptime: 0,
        totalDowntime: 0,
        restartCount: 0,
      });
    });
  });
});
