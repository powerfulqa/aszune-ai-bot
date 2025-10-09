const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Uptime', function () {
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
