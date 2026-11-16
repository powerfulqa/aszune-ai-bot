// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Analytics', () => {
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

  describe('logPerformanceMetric', () => {
    it('should log performance metrics', () => {
      const metricType = 'response_time';
      const value = 250.5;
      const metadata = { endpoint: '/api/chat', method: 'POST' };

      // Verify table exists first
      const db = dbService.getDb();
      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='performance_metrics'")
        .get();
      expect(tableCheck).toBeDefined();

      dbService.logPerformanceMetric(metricType, value, metadata);

      // Add a small delay to ensure write is committed
      return new Promise((resolve) =>
        setTimeout(() => {
          // Verify metric was logged
          const metrics = db
            .prepare('SELECT value, metadata FROM performance_metrics WHERE metric_type = ?')
            .all(metricType);
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
});
