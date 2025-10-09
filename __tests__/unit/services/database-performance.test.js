const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Performance', function () {
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
