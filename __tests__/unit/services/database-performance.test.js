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

  describe('getPerformanceMetrics', () => {
    it('should return empty array when no performance metrics exist', () => {
      const metrics = dbService.getPerformanceMetrics('response_time', 24);
      expect(metrics).toEqual([]);
    });

    it('should return performance metrics correctly', () => {
      dbService.logPerformanceMetric('response_time', 150, { userId: '123' });
      dbService.logPerformanceMetric('response_time', 200, { userId: '456' });
      dbService.logPerformanceMetric('response_time', 100, { userId: '789' });

      const metrics = dbService.getPerformanceMetrics('response_time', 24);
      expect(metrics.length).toBe(3);
      const values = metrics.map((m) => m.value).sort((a, b) => a - b);
      expect(values).toEqual([100, 150, 200]);
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should return empty array instead of throwing
      const metrics = dbService.getPerformanceMetrics('response_time', 24);
      expect(metrics).toEqual([]);
    });
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
