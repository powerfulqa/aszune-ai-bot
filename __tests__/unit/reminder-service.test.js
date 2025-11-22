const reminderService = require('../../src/services/reminder-service');
const databaseService = require('../../src/services/database');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');

describe('ReminderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset internal state
    reminderService.activeTimers.clear();
    reminderService.isInitialized = false;
    reminderService.eventListeners = new Map();

    // Setup default mock implementations
    databaseService.getActiveReminders.mockReturnValue([]);
    databaseService.createReminder.mockImplementation(
      (userId, message, time, timezone, channelId, serverId) => ({
        id: 1,
        user_id: userId,
        message,
        scheduled_time: time,
        timezone,
        channel_id: channelId,
        server_id: serverId,
        status: 'pending',
      })
    );
    databaseService.completeReminder.mockReturnValue(true);
    databaseService.cancelReminder.mockReturnValue(true);
    databaseService.deleteReminder.mockReturnValue(true);
  });

  afterEach(() => {
    reminderService.shutdown();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await reminderService.initialize();
      expect(reminderService.isInitialized).toBe(true);
      expect(databaseService.getActiveReminders).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('ReminderService initialized successfully');
    });

    it('should not initialize twice', async () => {
      await reminderService.initialize();
      databaseService.getActiveReminders.mockClear();
      await reminderService.initialize();
      expect(databaseService.getActiveReminders).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const error = new Error('DB Error');
      databaseService.getActiveReminders.mockImplementation(() => {
        throw error;
      });

      await expect(reminderService.initialize()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize ReminderService:', error);
    });
  });

  describe('loadAndScheduleReminders', () => {
    it('should load and schedule active reminders', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const reminders = [
        { id: 1, scheduled_time: futureTime, user_id: 'user1' },
        { id: 2, scheduled_time: futureTime, user_id: 'user2' },
      ];
      databaseService.getActiveReminders.mockReturnValue(reminders);

      // Spy on scheduleReminder
      const scheduleSpy = jest.spyOn(reminderService, 'scheduleReminder');

      await reminderService.loadAndScheduleReminders();

      expect(scheduleSpy).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Loaded and scheduled 2 active reminders');
    });

    it('should handle errors during loading', async () => {
      const error = new Error('Load Error');
      databaseService.getActiveReminders.mockImplementation(() => {
        throw error;
      });

      await expect(reminderService.loadAndScheduleReminders()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to load and schedule reminders:', error);
    });
  });

  describe('scheduleReminder', () => {
    it('should complete past due reminders immediately', async () => {
      const pastTime = new Date(Date.now() - 10000).toISOString();
      const reminder = { id: 1, scheduled_time: pastTime };

      await reminderService.scheduleReminder(reminder);

      expect(databaseService.completeReminder).toHaveBeenCalledWith(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already past due'));
    });

    it('should schedule future reminders with setTimeout', async () => {
      jest.useFakeTimers();
      const futureTime = new Date(Date.now() + 5000).toISOString();
      const reminder = { id: 1, scheduled_time: futureTime };

      await reminderService.scheduleReminder(reminder);

      expect(reminderService.activeTimers.has(1)).toBe(true);
      expect(reminderService.activeTimers.get(1).type).toBe('timeout');

      // Fast forward time
      jest.runAllTimers();

      expect(databaseService.completeReminder).toHaveBeenCalledWith(1);
      jest.useRealTimers();
    });

    it('should schedule long-term reminders with interval check', async () => {
      jest.useFakeTimers();
      // 25 hours in future
      const futureTime = new Date(Date.now() + 25 * 60 * 60 * 1000);
      const reminder = { id: 1, scheduled_time: futureTime.toISOString() };

      await reminderService.scheduleReminder(reminder);

      expect(reminderService.activeTimers.has(1)).toBe(true);
      expect(reminderService.activeTimers.get(1).type).toBe('interval');

      // Advance time to 2 minutes before
      jest.setSystemTime(new Date(futureTime.getTime() - 120000));
      jest.advanceTimersByTime(60000); // Check interval
      expect(databaseService.completeReminder).not.toHaveBeenCalled();

      // Advance time to after
      jest.setSystemTime(new Date(futureTime.getTime() + 1000));
      jest.advanceTimersByTime(60000); // Check interval

      expect(databaseService.completeReminder).toHaveBeenCalledWith(1);
      jest.useRealTimers();
    });

    it('should clear existing timer before scheduling new one', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const reminder = { id: 1, scheduled_time: futureTime };

      // Schedule first time
      await reminderService.scheduleReminder(reminder);
      const firstTimer = reminderService.activeTimers.get(1);

      // Schedule again
      await reminderService.scheduleReminder(reminder);
      const secondTimer = reminderService.activeTimers.get(1);

      expect(firstTimer).not.toBe(secondTimer);
    });

    it('should handle scheduling errors', async () => {
      const reminder = { id: 1, scheduled_time: 'invalid-date' };

      await expect(reminderService.scheduleReminder(reminder)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule reminder'),
        expect.any(Error)
      );
    });
  });

  describe('executeReminder', () => {
    it('should execute reminder successfully', async () => {
      const reminder = { id: 1, user_id: 'user1' };
      const emitSpy = jest.spyOn(reminderService, 'emit');

      await reminderService.executeReminder(reminder);

      expect(databaseService.completeReminder).toHaveBeenCalledWith(1);
      expect(emitSpy).toHaveBeenCalledWith('reminderDue', reminder);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Executed reminder'));
    });

    it('should not emit if database completion fails', async () => {
      databaseService.completeReminder.mockReturnValue(false);
      const reminder = { id: 1, user_id: 'user1' };
      const emitSpy = jest.spyOn(reminderService, 'emit');

      await reminderService.executeReminder(reminder);

      expect(emitSpy).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to mark reminder'));
    });

    it('should handle execution errors', async () => {
      const error = new Error('Exec Error');
      databaseService.completeReminder.mockImplementation(() => {
        throw error;
      });
      const reminder = { id: 1 };

      await reminderService.executeReminder(reminder);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute reminder'),
        error
      );
    });
  });

  describe('createReminder', () => {
    it('should create and schedule a reminder', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const scheduleSpy = jest.spyOn(reminderService, 'scheduleReminder');

      const result = await reminderService.createReminder('user1', 'test', futureTime);

      expect(databaseService.createReminder).toHaveBeenCalled();
      expect(scheduleSpy).toHaveBeenCalledWith(result);
      expect(result.status).toBe('pending');
    });

    it('should validate scheduled time format', async () => {
      await expect(reminderService.createReminder('user1', 'test', 'invalid')).rejects.toThrow(
        'Invalid scheduled time format'
      );
    });

    it('should validate future time', async () => {
      const pastTime = new Date(Date.now() - 10000).toISOString();
      await expect(reminderService.createReminder('user1', 'test', pastTime)).rejects.toThrow(
        'Scheduled time must be in the future'
      );
    });

    it('should handle database creation failure', async () => {
      databaseService.createReminder.mockReturnValue(null);
      const futureTime = new Date(Date.now() + 10000).toISOString();

      await expect(reminderService.createReminder('user1', 'test', futureTime)).rejects.toThrow(
        'Failed to create reminder in database'
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Create Error');
      databaseService.createReminder.mockImplementation(() => {
        throw error;
      });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      await expect(reminderService.createReminder('user1', 'test', futureTime)).rejects.toThrow(
        error
      );
    });
  });

  describe('cancelReminder', () => {
    it('should cancel existing reminder', async () => {
      // Setup active timer
      reminderService.activeTimers.set(1, { type: 'timeout', timer: setTimeout(() => {}, 1000) });

      const result = await reminderService.cancelReminder(1, 'user1');

      expect(result).toBe(true);
      expect(databaseService.cancelReminder).toHaveBeenCalledWith(1, 'user1');
      expect(reminderService.activeTimers.has(1)).toBe(false);
    });

    it('should return false if reminder not found', async () => {
      databaseService.cancelReminder.mockReturnValue(false);

      const result = await reminderService.cancelReminder(999, 'user1');

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      const error = new Error('Cancel Error');
      databaseService.cancelReminder.mockImplementation(() => {
        throw error;
      });

      await expect(reminderService.cancelReminder(1, 'user1')).rejects.toThrow(error);
    });
  });

  describe('setReminder', () => {
    it('should parse "in X minutes" format', async () => {
      const createSpy = jest.spyOn(reminderService, 'createReminder');

      await reminderService.setReminder('user1', 'in 5 minutes', 'test message');

      expect(createSpy).toHaveBeenCalledWith(
        'user1',
        'test message',
        expect.any(String),
        expect.any(String),
        null,
        null
      );
    });

    it('should parse "in X hours" format', async () => {
      const createSpy = jest.spyOn(reminderService, 'createReminder');

      await reminderService.setReminder('user1', 'in 2 hours', 'test message');

      expect(createSpy).toHaveBeenCalledWith(
        'user1',
        'test message',
        expect.any(String),
        expect.any(String),
        null,
        null
      );
    });

    it('should parse "tomorrow" format', async () => {
      const createSpy = jest.spyOn(reminderService, 'createReminder');

      await reminderService.setReminder('user1', 'tomorrow', 'test message');

      expect(createSpy).toHaveBeenCalledWith(
        'user1',
        'test message',
        expect.any(String),
        expect.any(String),
        null,
        null
      );
    });

    it('should throw on unsupported format', async () => {
      await expect(reminderService.setReminder('user1', 'not a time', 'test')).rejects.toThrow(
        'Unsupported time format'
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Set Error');
      jest.spyOn(reminderService, 'createReminder').mockRejectedValue(error);

      await expect(reminderService.setReminder('user1', 'in 1 minute', 'test')).rejects.toThrow(
        error
      );
    });
  });

  describe('deleteReminder', () => {
    it('should delete reminder and clear timer', async () => {
      reminderService.activeTimers.set(1, { type: 'timeout', timer: setTimeout(() => {}, 1000) });

      const result = await reminderService.deleteReminder(1, 'user1');

      expect(result).toBe(true);
      expect(databaseService.deleteReminder).toHaveBeenCalledWith(1, 'user1');
      expect(reminderService.activeTimers.has(1)).toBe(false);
    });

    it('should return false if delete fails', async () => {
      databaseService.deleteReminder.mockReturnValue(false);

      const result = await reminderService.deleteReminder(1, 'user1');

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      const error = new Error('Delete Error');
      databaseService.deleteReminder.mockImplementation(() => {
        throw error;
      });

      await expect(reminderService.deleteReminder(1, 'user1')).rejects.toThrow(error);
    });
  });

  describe('Event Emitter', () => {
    it('should register and emit events', () => {
      const listener = jest.fn();
      reminderService.on('test', listener);

      reminderService.emit('test', 'data');

      expect(listener).toHaveBeenCalledWith('data');
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener Error');
      });
      reminderService.on('test', errorListener);

      expect(() => reminderService.emit('test')).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in event listener'),
        expect.any(Error)
      );
    });
  });

  describe('getUserReminders', () => {
    it('should delegate to database service', () => {
      reminderService.getUserReminders('user1', true);
      expect(databaseService.getUserReminders).toHaveBeenCalledWith('user1', true);
    });
  });
});
