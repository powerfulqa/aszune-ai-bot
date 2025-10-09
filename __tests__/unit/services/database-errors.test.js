const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Errors', function () {
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

  describe('logError', () => {
    it('should log errors without throwing', () => {
      expect(() => {
        dbService.logError(
          'test_context',
          'Test error message',
          '123',
          'test_command',
          'stack trace'
        );
      }).not.toThrow();
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should not throw even with database error
      expect(() => {
        dbService.logError(
          'test_context',
          'Test error message',
          '123',
          'test_command',
          'stack trace'
        );
      }).not.toThrow();
    });

    it('should handle null parameters', () => {
      expect(() => {
        dbService.logError('test_context', 'Test error message', null, null, null);
      }).not.toThrow();
    });

    it('should handle empty context', () => {
      expect(() => {
        dbService.logError('', 'Test error message', '123', 'test_command', 'stack trace');
      }).not.toThrow();
    });
  });

  describe('getErrorStats', () => {
    it('should return default stats when no errors logged', () => {
      const stats = dbService.getErrorStats(7);
      expect(stats).toEqual({
        totalErrors: 0,
        errorBreakdown: [],
        resolvedCount: 0,
      });
    });

    it('should aggregate error statistics correctly', () => {
      dbService.logError('api_call', 'Error 1', '123', 'test_command', 'stack1');
      dbService.logError('api_call', 'Error 2', '456', 'test_command', 'stack2');
      dbService.logError('database', 'Error 3', '789', 'test_command', 'stack3');

      const stats = dbService.getErrorStats(7);
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorBreakdown.length).toBe(2); // api_call and database
      expect(stats.resolvedCount).toBe(0);
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should return default stats instead of throwing
      const stats = dbService.getErrorStats(7);
      expect(stats).toEqual({
        totalErrors: 0,
        errorBreakdown: [],
        resolvedCount: 0,
      });
    });
  });
});
