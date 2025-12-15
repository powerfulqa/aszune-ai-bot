/**
 * DatabaseService - Reminder Statistics Tests
 * Tests for getUserReminderCount and getReminderStats methods
 */

const path = require('path');
const fs = require('fs');
const { DatabaseService } = require('../../../src/services/database');

/**
 * Setup test database path and ensure test-data directory exists
 */
function setupTestDbPath() {
  const testDbPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'test-data',
    `test-reminder-stats-${Date.now()}.db`
  );

  const testDataDir = path.dirname(testDbPath);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  return testDbPath;
}

/**
 * Cleanup test database file
 */
function cleanupTestDb(testDbPath) {
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Close database service safely
 */
function closeDatabaseSafely(dbService) {
  if (dbService.db && !dbService.isDisabled) {
    try {
      dbService.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
}

describe('DatabaseService - Reminder Statistics', () => {
  let dbService;
  let testDbPath;

  beforeEach(() => {
    jest.clearAllMocks();
    testDbPath = setupTestDbPath();
    dbService = new DatabaseService();
    dbService.dbPath = testDbPath;
  });

  afterEach(() => {
    closeDatabaseSafely(dbService);
    cleanupTestDb(testDbPath);
  });

  describe('getUserReminderCount', () => {
    it('should return 0 for user with no reminders', () => {
      dbService.ensureUserExists('user123');
      const count = dbService.getUserReminderCount('user123');
      expect(count).toBe(0);
    });

    it('should return correct count of active reminders for user', () => {
      const userId = 'user123';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId);
      dbService.createReminder(userId, 'Reminder 1', futureTime);
      dbService.createReminder(userId, 'Reminder 2', futureTime);
      dbService.createReminder(userId, 'Reminder 3', futureTime);

      const reminder4 = dbService.createReminder(userId, 'Reminder 4', futureTime);
      dbService.completeReminder(reminder4.id);

      const count = dbService.getUserReminderCount(userId);
      expect(count).toBe(3);
    });

    it('should not count cancelled reminders', () => {
      const userId = 'user123';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId);
      dbService.createReminder(userId, 'Active 1', futureTime);
      const reminder2 = dbService.createReminder(userId, 'To Cancel', futureTime);
      dbService.createReminder(userId, 'Active 2', futureTime);

      dbService.cancelReminder(reminder2.id, userId);

      const count = dbService.getUserReminderCount(userId);
      expect(count).toBe(2);
    });

    it('should return 0 when database is disabled', () => {
      dbService.isDisabled = true;
      const count = dbService.getUserReminderCount('user123');
      expect(count).toBe(0);
    });

    it('should handle database errors gracefully', () => {
      dbService.close();
      const count = dbService.getUserReminderCount('user123');
      expect(count).toBe(0);
    });
  });

  describe('getReminderStats', () => {
    it('should return default stats when no reminders exist', () => {
      const stats = dbService.getReminderStats();

      expect(stats).toEqual({
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
        nextDue: null,
      });
    });

    it('should return correct stats with mixed reminder statuses', () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId1);
      dbService.ensureUserExists(userId2);

      dbService.createReminder(userId1, 'Active 1', futureTime);
      dbService.createReminder(userId1, 'Active 2', futureTime);
      dbService.createReminder(userId2, 'Active 3', futureTime);

      const reminder4 = dbService.createReminder(userId1, 'To Complete 1', futureTime);
      const reminder5 = dbService.createReminder(userId2, 'To Complete 2', futureTime);
      dbService.completeReminder(reminder4.id);
      dbService.completeReminder(reminder5.id);

      const reminder6 = dbService.createReminder(userId1, 'To Cancel', futureTime);
      dbService.cancelReminder(reminder6.id, userId1);

      const stats = dbService.getReminderStats();

      expect(stats).toEqual({
        totalReminders: 6,
        activeReminders: 3,
        completedReminders: 2,
        cancelledReminders: 1,
        nextDue: expect.any(String),
      });
    });

    it('should handle stats with only active reminders', () => {
      const userId = 'user123';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId);
      dbService.createReminder(userId, 'Active 1', futureTime);
      dbService.createReminder(userId, 'Active 2', futureTime);

      const stats = dbService.getReminderStats();

      expect(stats).toEqual({
        totalReminders: 2,
        activeReminders: 2,
        completedReminders: 0,
        cancelledReminders: 0,
        nextDue: expect.any(String),
      });
    });

    it('should return default stats when database is disabled', () => {
      dbService.isDisabled = true;
      const stats = dbService.getReminderStats();

      expect(stats).toEqual({
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
        nextDue: null,
      });
    });

    it('should handle database errors gracefully', () => {
      dbService.close();
      const stats = dbService.getReminderStats();

      expect(stats).toEqual({
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
        nextDue: null,
      });
    });
  });

  describe('Helper Methods', () => {
    it('should return correct default reminder stats from _getDefaultReminderStats', () => {
      const stats = dbService._getDefaultReminderStats();

      expect(stats).toEqual({
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
        nextDue: null,
      });
    });

    it('should correctly map status counts with _mapStatusCounts', () => {
      const stats = {
        totalReminders: 10,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
      };

      const statusResults = [
        { status: 'active', count: 5 },
        { status: 'completed', count: 3 },
        { status: 'cancelled', count: 2 },
      ];

      dbService._mapStatusCounts(statusResults, stats);

      expect(stats).toEqual({
        totalReminders: 10,
        activeReminders: 5,
        completedReminders: 3,
        cancelledReminders: 2,
      });
    });

    it('should handle unknown status in _mapStatusCounts', () => {
      const stats = {
        totalReminders: 5,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
      };

      const statusResults = [
        { status: 'active', count: 3 },
        { status: 'unknown', count: 2 },
      ];

      dbService._mapStatusCounts(statusResults, stats);

      expect(stats).toEqual({
        totalReminders: 5,
        activeReminders: 3,
        completedReminders: 0,
        cancelledReminders: 0,
      });
    });
  });
});
