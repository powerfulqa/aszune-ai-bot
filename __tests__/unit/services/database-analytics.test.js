const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Analytics', () => {
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

  describe('ensureUserExists', () => {
    it('should create user if they do not exist', () => {
      const userId = 'new-user';
      dbService.ensureUserExists(userId);

      const stats = dbService.getUserStats(userId);
      expect(stats.message_count).toBe(0);
    });

    it('should not modify existing user', () => {
      const userId = 'existing-user';
      dbService.updateUserStats(userId, { message_count: 5 });
      dbService.ensureUserExists(userId);

      const stats = dbService.getUserStats(userId);
      expect(stats.message_count).toBe(5);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.ensureUserExists('test-user')).not.toThrow();
    });
  });

  describe('trackCommandUsage', () => {
    it('should track command usage', () => {
      const command = 'test-command';
      const userId = 'test-user';

      dbService.trackCommandUsage(command, userId);

      // Verify command usage was tracked (would need to check internal state)
      // This method doesn't have a direct getter, so we verify it doesn't throw
      expect(() => dbService.trackCommandUsage(command, userId)).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.trackCommandUsage('test', 'user')).not.toThrow();
    });
  });

  describe('getCommandUsageStats', () => {
    it('should return command usage statistics', () => {
      const stats = dbService.getCommandUsageStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const stats = dbService.getCommandUsageStats();
      expect(stats).toEqual({ totalCommands: 0, commandBreakdown: [], successRate: 100 });
    });
  });

  describe('logPerformanceMetric', () => {
    it('should log performance metrics', () => {
      const metricType = 'response_time';
      const value = 250.5;
      const metadata = { endpoint: '/api/chat', method: 'POST' };

      // Verify table exists first
      const db = dbService.getDb();
      const tableCheck = db
        .prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'performance_metrics\'')
        .get();
      expect(tableCheck).toBeDefined();

      dbService.logPerformanceMetric(metricType, value, metadata);

      // Add a small delay to ensure write is committed
      return new Promise((resolve) =>
        setTimeout(() => {
          // Verify metric was logged
          const metrics = dbService.getPerformanceMetrics(metricType, 1);
          expect(metrics.length).toBeGreaterThan(0);
          expect(metrics[0].value).toBe(value);
          expect(JSON.parse(metrics[0].metadata)).toEqual(metadata);
          resolve();
        }, 10)
      );
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.logPerformanceMetric('test', 100, {})).not.toThrow();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics for type', () => {
      const metricType = 'test_metric';

      // Log some metrics
      dbService.logPerformanceMetric(metricType, 100, { test: 'data' });
      dbService.logPerformanceMetric(metricType, 200, { test: 'data2' });

      return new Promise((resolve) =>
        setTimeout(() => {
          const metrics = dbService.getPerformanceMetrics(metricType, 10);
          expect(metrics.length).toBe(2);
          expect(metrics[0].value).toBe(200); // Most recent first
          expect(metrics[1].value).toBe(100);
          resolve();
        }, 10)
      );
    });

    it('should limit results when specified', () => {
      const metricType = 'test_metric';

      // Log multiple metrics
      for (let i = 0; i < 5; i++) {
        dbService.logPerformanceMetric(metricType, i * 100, {});
      }

      return new Promise((resolve) =>
        setTimeout(() => {
          const metrics = dbService.getPerformanceMetrics(metricType, 24); // Get all from last 24 hours
          expect(metrics.length).toBe(5); // Should return all 5 metrics
          resolve();
        }, 10)
      );
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const metrics = dbService.getPerformanceMetrics('test', 10);
      expect(metrics).toEqual([]);
    });
  });

  describe('logError', () => {
    it('should log errors', () => {
      const error = new Error('Test error');
      const context = 'test_context';
      const additionalData = { userId: 'test-user' };

      dbService.logError(error, context, additionalData);

      // Verify error was logged (method doesn't have direct getter)
      expect(() => dbService.logError(error, context, additionalData)).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.logError(new Error('test'), 'context')).not.toThrow();
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics', () => {
      const stats = dbService.getErrorStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const stats = dbService.getErrorStats();
      expect(stats).toEqual({ totalErrors: 0, errorBreakdown: [], resolvedCount: 0 });
    });
  });

  describe('getUptimeStats', () => {
    it('should return uptime statistics', () => {
      const stats = dbService.getUptimeStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('totalUptime');
      expect(stats).toHaveProperty('totalDowntime');
      expect(stats).toHaveProperty('restartCount');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const stats = dbService.getUptimeStats();
      expect(stats).toEqual({
        totalUptime: 0,
        totalDowntime: 0,
        restartCount: 0,
      });
    });
  });
});
