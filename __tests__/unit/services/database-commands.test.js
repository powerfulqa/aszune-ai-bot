// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Commands', function () {
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

  describe('getCommandUsageStats', () => {
    it('should return default stats when no commands have been used', () => {
      const stats = dbService.getCommandUsageStats(7);
      expect(stats).toEqual({
        totalCommands: 0,
        commandBreakdown: [],
        successRate: 100,
      });
    });

    it('should track command usage correctly', () => {
      dbService.trackCommandUsage('123', '!help', null, true, 100);
      dbService.trackCommandUsage('456', '!help', null, true, 150);
      dbService.trackCommandUsage('123', '!analytics', null, true, 200);

      const stats = dbService.getCommandUsageStats(7);
      expect(stats.totalCommands).toBe(3);
      expect(stats.commandBreakdown.length).toBe(2); // !help and !analytics
      expect(stats.successRate).toBe(100);
    });

    it('should handle multiple command usages by same user', () => {
      dbService.trackCommandUsage('123', '!help', null, true, 100);
      dbService.trackCommandUsage('123', '!help', null, true, 150);
      dbService.trackCommandUsage('123', '!help', null, true, 200);

      const stats = dbService.getCommandUsageStats(7);
      expect(stats.totalCommands).toBe(3);
      expect(stats.commandBreakdown.find((cmd) => cmd.command_name === '!help').count).toBe(3);
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should return default stats instead of throwing
      const stats = dbService.getCommandUsageStats(7);
      expect(stats).toEqual({
        totalCommands: 0,
        commandBreakdown: [],
        successRate: 100,
      });
    });
  });

  describe('trackCommandUsage', () => {
    it('should record command usage without throwing', () => {
      expect(() => {
        dbService.trackCommandUsage('123', '!test', null, true, 100);
      }).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should not throw even with database error
      expect(() => {
        dbService.trackCommandUsage('123', '!test', null, true, 100);
      }).not.toThrow();
    });

    it('should handle empty command names', () => {
      expect(() => {
        dbService.trackCommandUsage('123', '', null, true, 100);
      }).not.toThrow();
    });

    it('should handle empty user IDs', () => {
      expect(() => {
        dbService.trackCommandUsage('', '!test', null, true, 100);
      }).not.toThrow();
    });
  });
});
