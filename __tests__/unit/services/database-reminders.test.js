const fs = require('fs');
const path = require('path');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Reminders', () => {
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

  describe('createReminder', () => {
    it('should create a reminder and return reminder object', () => {
      const userId = 'test-user';
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now
      const message = 'Test reminder';

      const reminder = dbService.createReminder(userId, message, scheduledTime);

      expect(reminder).toBeDefined();
      expect(reminder.id).toBeDefined();
      expect(reminder.user_id).toBe(userId);
      expect(reminder.scheduled_time).toBe(scheduledTime.toISOString());
      expect(reminder.message).toBe(message);
      expect(reminder.status).toBe('active');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const result = dbService.createReminder('test-user', 'test message', new Date());
      expect(result).toBeNull();
    });
  });

  describe('getActiveReminders', () => {
    it('should return empty array when no reminders exist', () => {
      const reminders = dbService.getActiveReminders('test-user');
      expect(reminders).toEqual([]);
    });

    it('should return active reminders for user', () => {
      const userId = 'test-user';
      const futureTime = new Date(Date.now() + 3600000);

      // Create multiple reminders
      const reminder1 = dbService.createReminder(userId, 'Reminder 1', futureTime);
      const reminder2 = dbService.createReminder(userId, 'Reminder 2', futureTime);

      const reminders = dbService.getActiveReminders(userId);
      expect(reminders.length).toBe(2);
      expect(reminders.map((r) => r.id)).toEqual(
        expect.arrayContaining([reminder1.id, reminder2.id])
      );
    });

    it('should not return completed reminders', () => {
      const userId = 'test-user';
      const futureTime = new Date(Date.now() + 3600000);

      // Create reminder and complete it
      const reminder = dbService.createReminder(userId, 'Test', futureTime);
      dbService.completeReminder(reminder.id);

      const reminders = dbService.getActiveReminders(userId);
      expect(reminders.length).toBe(0);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const reminders = dbService.getActiveReminders('test-user');
      expect(reminders).toEqual([]);
    });
  });

  describe('getDueReminders', () => {
    it('should return empty array when no due reminders', () => {
      const dueReminders = dbService.getDueReminders();
      expect(dueReminders).toEqual([]);
    });

    it('should return reminders that are due', () => {
      const userId = 'test-user';
      const pastTime = new Date(Date.now() - 3600000); // 1 hour ago
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now

      // Create past and future reminders
      dbService.createReminder(userId, 'Past reminder', pastTime);
      dbService.createReminder(userId, 'Future reminder', futureTime);

      const dueReminders = dbService.getDueReminders();
      expect(dueReminders.length).toBe(1);
      expect(dueReminders[0].message).toBe('Past reminder');
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const dueReminders = dbService.getDueReminders();
      expect(dueReminders).toEqual([]);
    });
  });

  describe('completeReminder', () => {
    it('should mark reminder as completed', () => {
      const userId = 'test-user';
      const futureTime = new Date(Date.now() + 3600000);
      const reminder = dbService.createReminder(userId, 'Test reminder', futureTime);

      const result = dbService.completeReminder(reminder.id);
      expect(result).toBe(true);

      // Verify reminder is no longer active
      const activeReminders = dbService.getActiveReminders(userId);
      expect(activeReminders.length).toBe(0);
    });

    it('should return false for non-existent reminder', () => {
      const result = dbService.completeReminder(999);
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.completeReminder(1)).not.toThrow();
    });
  });

  describe('cancelReminder', () => {
    it('should mark reminder as cancelled', () => {
      const userId = 'test-user';
      const futureTime = new Date(Date.now() + 3600000);
      const reminder = dbService.createReminder(userId, 'Test reminder', futureTime);

      const result = dbService.cancelReminder(reminder.id, userId);
      expect(result).toBe(true);

      // Verify reminder is no longer active
      const activeReminders = dbService.getActiveReminders(userId);
      expect(activeReminders.length).toBe(0);
    });

    it('should return false for non-existent reminder', () => {
      const result = dbService.cancelReminder(999);
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.cancelReminder(1)).not.toThrow();
    });
  });

  describe('getUserReminders', () => {
    it('should return all reminders for user regardless of status', () => {
      const userId = 'test-user';
      const futureTime = new Date(Date.now() + 3600000);

      // Create multiple reminders with different statuses
      const reminder1 = dbService.createReminder(userId, 'Active reminder', futureTime);
      const reminder2 = dbService.createReminder(userId, 'To be cancelled', futureTime);
      dbService.cancelReminder(reminder2.id);

      const userReminders = dbService.getUserReminders(userId);
      expect(userReminders.length).toBe(2);
      expect(userReminders.map((r) => r.id)).toEqual(
        expect.arrayContaining([reminder1.id, reminder2.id])
      );
    });

    it('should return empty array for user with no reminders', () => {
      const userReminders = dbService.getUserReminders('nonexistent');
      expect(userReminders).toEqual([]);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      const userReminders = dbService.getUserReminders('test-user');
      expect(userReminders).toEqual([]);
    });
  });

  describe('deleteReminder', () => {
    it('should permanently delete reminder', () => {
      const userId = 'test-user';
      const futureTime = new Date(Date.now() + 3600000);
      const reminder = dbService.createReminder(userId, 'Test reminder', futureTime);

      const result = dbService.deleteReminder(reminder.id, userId);
      expect(result).toBe(true);

      // Verify reminder is completely gone
      const userReminders = dbService.getUserReminders(userId);
      expect(userReminders.length).toBe(0);
    });

    it('should return false for non-existent reminder', () => {
      const result = dbService.deleteReminder(999);
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', () => {
      dbService.isDisabled = true;
      expect(() => dbService.deleteReminder(1)).not.toThrow();
    });
  });
});
