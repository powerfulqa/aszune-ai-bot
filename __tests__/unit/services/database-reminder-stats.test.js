/**
 * DatabaseService - Reminder Statistics Tests
 * Tests for getUserReminderCount and getReminderStats methods
 */

const path = require('path');
const fs = require('fs');
const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Reminder Statistics', () => {
  let dbService;
  let testDbPath;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a unique test database path
    testDbPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'test-data',
      `test-reminder-stats-${Date.now()}.db`
    );

    // Ensure test-data directory exists
    const testDataDir = path.dirname(testDbPath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create new database service instance for each test
    dbService = new DatabaseService();
    // Force database path for testing
    dbService.dbPath = testDbPath;
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

  describe('getUserReminderCount', () => {
    it('should return 0 for user with no reminders', () => {
      // Initialize database
      // const db = dbService.getDb();

      // Ensure user exists
      dbService.ensureUserExists('user123');

      const count = dbService.getUserReminderCount('user123');
      expect(count).toBe(0);
    });

    it('should return correct count of active reminders for user', () => {
      // Initialize database
      // const db = dbService.getDb();

      const userId = 'user123';
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

      // Create user and reminders
      dbService.ensureUserExists(userId);

      // Create 3 active reminders
      dbService.createReminder(userId, 'Reminder 1', futureTime);
      dbService.createReminder(userId, 'Reminder 2', futureTime);
      dbService.createReminder(userId, 'Reminder 3', futureTime);

      // Create 1 completed reminder (should not be counted)
      const reminder4 = dbService.createReminder(userId, 'Reminder 4', futureTime);
      dbService.completeReminder(reminder4.id);

      const count = dbService.getUserReminderCount(userId);
      expect(count).toBe(3);
    });

    it('should not count cancelled reminders', () => {
      // Initialize database
      // const db = dbService.getDb();

      const userId = 'user123';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId);

      // Create 2 active reminders and 1 cancelled
      dbService.createReminder(userId, 'Active 1', futureTime);
      const reminder2 = dbService.createReminder(userId, 'To Cancel', futureTime);
      dbService.createReminder(userId, 'Active 2', futureTime);

      // Cancel one reminder
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
      // Initialize database
      // const db = dbService.getDb();

      // Close database to cause error
      dbService.close();

      const count = dbService.getUserReminderCount('user123');
      expect(count).toBe(0);
    });
  });

  describe('getReminderStats', () => {
    it('should return default stats when no reminders exist', () => {
      // Initialize database
      // const db = dbService.getDb();

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
      // Initialize database
      // const db = dbService.getDb();

      const userId1 = 'user1';
      const userId2 = 'user2';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId1);
      dbService.ensureUserExists(userId2);

      // Create 5 active reminders
      dbService.createReminder(userId1, 'Active 1', futureTime);
      dbService.createReminder(userId1, 'Active 2', futureTime);
      dbService.createReminder(userId2, 'Active 3', futureTime);

      // Create 2 completed reminders
      const reminder4 = dbService.createReminder(userId1, 'To Complete 1', futureTime);
      const reminder5 = dbService.createReminder(userId2, 'To Complete 2', futureTime);
      dbService.completeReminder(reminder4.id);
      dbService.completeReminder(reminder5.id);

      // Create 1 cancelled reminder
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
      // Initialize database
      // const db = dbService.getDb();

      const userId = 'user123';
      const futureTime = new Date(Date.now() + 3600000).toISOString();

      dbService.ensureUserExists(userId);

      // Create only active reminders
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
      // Initialize database
      // const db = dbService.getDb();

      // Close database to cause error
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
        { status: 'unknown', count: 2 }, // Unknown status should be ignored
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
