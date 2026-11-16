// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Performance', function () {
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

  describe('logPerformanceMetric', () => {
    it('should log performance metrics without throwing', () => {
      expect(() => {
        dbService.logPerformanceMetric('response_time', 150, { userId: '123' });
      }).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should not throw even with database error
      expect(() => {
        dbService.logPerformanceMetric('response_time', 150, { userId: '123' });
      }).not.toThrow();
    });

    it('should handle null metadata', () => {
      expect(() => {
        dbService.logPerformanceMetric('response_time', 150, null);
      }).not.toThrow();
    });

    it('should handle empty metadata', () => {
      expect(() => {
        dbService.logPerformanceMetric('response_time', 150, {});
      }).not.toThrow();
    });
  });
});
