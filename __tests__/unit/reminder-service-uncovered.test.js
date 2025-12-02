/**
 * ReminderService - Uncovered Path Tests
 * Tests for methods with low coverage: shutdown, getUserReminders, clearReminderTimer edge cases
 */

const {
  reminderService,
  databaseService,
  logger,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

describe('ReminderService - Uncovered Paths', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
  });

  describe('shutdown', () => {
    it('should clear all active timeout timers on shutdown', () => {
      // Set up a timeout timer
      const timer = setTimeout(() => {}, 10000);
      reminderService.activeTimers.set(1, { type: 'timeout', timer });
      reminderService.isInitialized = true;

      reminderService.shutdown();

      expect(reminderService.activeTimers.size).toBe(0);
      expect(reminderService.isInitialized).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('ReminderService shut down');
    });

    it('should clear all active interval timers on shutdown', () => {
      // Set up an interval timer
      const interval = setInterval(() => {}, 60000);
      reminderService.activeTimers.set(1, { type: 'interval', timer: interval });
      reminderService.isInitialized = true;

      reminderService.shutdown();

      expect(reminderService.activeTimers.size).toBe(0);
      expect(reminderService.isInitialized).toBe(false);
    });

    it('should handle multiple timers of different types', () => {
      const timeout1 = setTimeout(() => {}, 5000);
      const timeout2 = setTimeout(() => {}, 10000);
      const interval1 = setInterval(() => {}, 60000);

      reminderService.activeTimers.set(1, { type: 'timeout', timer: timeout1 });
      reminderService.activeTimers.set(2, { type: 'timeout', timer: timeout2 });
      reminderService.activeTimers.set(3, { type: 'interval', timer: interval1 });
      reminderService.isInitialized = true;

      reminderService.shutdown();

      expect(reminderService.activeTimers.size).toBe(0);
      expect(reminderService.isInitialized).toBe(false);
    });

    it('should handle shutdown when no timers are active', () => {
      reminderService.activeTimers.clear();
      reminderService.isInitialized = true;

      reminderService.shutdown();

      expect(reminderService.activeTimers.size).toBe(0);
      expect(reminderService.isInitialized).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('ReminderService shut down');
    });
  });

  describe('getUserReminders', () => {
    it('should return user reminders from database', () => {
      const mockReminders = [
        { id: 1, user_id: 'user1', message: 'Test 1', status: 'pending' },
        { id: 2, user_id: 'user1', message: 'Test 2', status: 'pending' },
      ];
      databaseService.getUserReminders = jest.fn().mockReturnValue(mockReminders);

      const result = reminderService.getUserReminders('user1');

      expect(databaseService.getUserReminders).toHaveBeenCalledWith('user1', false);
      expect(result).toEqual(mockReminders);
    });

    it('should include completed reminders when requested', () => {
      const mockReminders = [
        { id: 1, user_id: 'user1', message: 'Test 1', status: 'completed' },
        { id: 2, user_id: 'user1', message: 'Test 2', status: 'pending' },
      ];
      databaseService.getUserReminders = jest.fn().mockReturnValue(mockReminders);

      const result = reminderService.getUserReminders('user1', true);

      expect(databaseService.getUserReminders).toHaveBeenCalledWith('user1', true);
      expect(result).toEqual(mockReminders);
    });

    it('should return empty array when user has no reminders', () => {
      databaseService.getUserReminders = jest.fn().mockReturnValue([]);

      const result = reminderService.getUserReminders('user-no-reminders');

      expect(result).toEqual([]);
    });
  });

  describe('clearReminderTimer', () => {
    it('should clear timeout timer', () => {
      const timer = setTimeout(() => {}, 10000);
      reminderService.activeTimers.set(1, { type: 'timeout', timer });

      reminderService.clearReminderTimer(1);

      expect(reminderService.activeTimers.has(1)).toBe(false);
    });

    it('should clear interval timer', () => {
      const timer = setInterval(() => {}, 60000);
      reminderService.activeTimers.set(1, { type: 'interval', timer });

      reminderService.clearReminderTimer(1);

      expect(reminderService.activeTimers.has(1)).toBe(false);
    });

    it('should handle legacy direct timer objects', () => {
      const timer = setTimeout(() => {}, 10000);
      reminderService.activeTimers.set(1, timer); // Legacy format without type wrapper

      reminderService.clearReminderTimer(1);

      expect(reminderService.activeTimers.has(1)).toBe(false);
    });

    it('should do nothing for non-existent reminder', () => {
      expect(reminderService.activeTimers.has(999)).toBe(false);

      reminderService.clearReminderTimer(999);

      expect(reminderService.activeTimers.has(999)).toBe(false);
    });
  });

  describe('emit and event handling', () => {
    it('should handle listener errors gracefully', () => {
      const error = new Error('Listener error');
      const faultyListener = jest.fn().mockImplementation(() => {
        throw error;
      });

      reminderService.on('reminderDue', faultyListener);
      reminderService.emit('reminderDue', { id: 1 });

      expect(faultyListener).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in event listener'),
        error
      );
    });

    it('should call all listeners even if one fails', () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Fail');
      });
      const goodListener = jest.fn();

      reminderService.on('reminderDue', faultyListener);
      reminderService.on('reminderDue', goodListener);
      reminderService.emit('reminderDue', { id: 1 });

      expect(faultyListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });

    it('should handle emit when no listeners registered', () => {
      reminderService.eventListeners = new Map();

      // Should not throw
      expect(() => {
        reminderService.emit('unknownEvent', { id: 1 });
      }).not.toThrow();
    });

    it('should handle emit when eventListeners is undefined', () => {
      reminderService.eventListeners = undefined;

      // Should not throw
      expect(() => {
        reminderService.emit('someEvent', { id: 1 });
      }).not.toThrow();
    });
  });

  describe('loadAndScheduleReminders', () => {
    it('should load and schedule multiple reminders', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const mockReminders = [
        { id: 1, scheduled_time: futureTime, user_id: 'user1', message: 'Test 1' },
        { id: 2, scheduled_time: futureTime, user_id: 'user2', message: 'Test 2' },
      ];
      databaseService.getActiveReminders.mockReturnValue(mockReminders);
      const scheduleSpy = jest.spyOn(reminderService, 'scheduleReminder');

      await reminderService.loadAndScheduleReminders();

      expect(databaseService.getActiveReminders).toHaveBeenCalled();
      expect(scheduleSpy).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded and scheduled 2'));
    });

    it('should handle database errors during load', async () => {
      const error = new Error('Database error');
      databaseService.getActiveReminders.mockImplementation(() => {
        throw error;
      });

      await expect(reminderService.loadAndScheduleReminders()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load and schedule reminders'),
        error
      );
    });
  });

  describe('executeReminder', () => {
    it('should handle completeReminder returning false', async () => {
      const reminder = { id: 1, user_id: 'user1', message: 'Test' };
      databaseService.completeReminder.mockReturnValue(false);

      await reminderService.executeReminder(reminder);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to mark reminder 1 as completed')
      );
    });

    it('should emit reminderDue event on successful execution', async () => {
      const reminder = { id: 1, user_id: 'user1', message: 'Test' };
      databaseService.completeReminder.mockReturnValue(true);
      const emitSpy = jest.spyOn(reminderService, 'emit');

      await reminderService.executeReminder(reminder);

      expect(emitSpy).toHaveBeenCalledWith('reminderDue', reminder);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Executed reminder 1'));
    });

    it('should handle errors during execution', async () => {
      const reminder = { id: 1, user_id: 'user1', message: 'Test' };
      const error = new Error('Execution error');
      databaseService.completeReminder.mockImplementation(() => {
        throw error;
      });

      // Should not throw, should log error
      await reminderService.executeReminder(reminder);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute reminder 1'),
        error
      );
    });
  });
});
