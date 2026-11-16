const {
  reminderService,
  databaseService,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

describe('ReminderService creation', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
  });

  describe('createReminder', () => {
    it('should create and schedule a reminder', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const scheduleSpy = jest.spyOn(reminderService, 'scheduleReminder');

      const result = await reminderService.createReminder('user1', {
        message: 'test',
        scheduledTime: futureTime,
      });

      expect(databaseService.createReminder).toHaveBeenCalled();
      expect(scheduleSpy).toHaveBeenCalledWith(result);
      expect(result.status).toBe('pending');
    });

    it('should validate scheduled time format', async () => {
      await expect(
        reminderService.createReminder('user1', {
          message: 'test',
          scheduledTime: 'invalid',
        })
      ).rejects.toThrow('Invalid scheduled time format');
    });

    it('should validate future time', async () => {
      const pastTime = new Date(Date.now() - 10000).toISOString();
      await expect(
        reminderService.createReminder('user1', {
          message: 'test',
          scheduledTime: pastTime,
        })
      ).rejects.toThrow('Scheduled time must be in the future');
    });

    it('should handle database creation failure', async () => {
      databaseService.createReminder.mockReturnValue(null);
      const futureTime = new Date(Date.now() + 10000).toISOString();

      await expect(
        reminderService.createReminder('user1', {
          message: 'test',
          scheduledTime: futureTime,
        })
      ).rejects.toThrow('Failed to create reminder in database');
    });

    it('should handle errors', async () => {
      const error = new Error('Create Error');
      databaseService.createReminder.mockImplementation(() => {
        throw error;
      });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      await expect(
        reminderService.createReminder('user1', {
          message: 'test',
          scheduledTime: futureTime,
        })
      ).rejects.toThrow(error);
    });
  });

  describe('cancelReminder', () => {
    it('should cancel existing reminder', async () => {
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

  describe('per-user cap and updateReminder', () => {
    it('refuses a new reminder once the user has 25 active ones', async () => {
      databaseService.getUserReminderCount.mockReturnValue(25);

      await expect(
        reminderService.createReminder('user1', {
          message: 'one too many',
          scheduledTime: new Date(Date.now() + 60000).toISOString(),
        })
      ).rejects.toThrow('You already have 25 active reminders. Cancel one first.');
      expect(databaseService.createReminder).not.toHaveBeenCalled();
    });

    it('stores an edit and re-arms the timer for the new time', async () => {
      const scheduledTime = new Date(Date.now() + 60000).toISOString();
      const row = { id: 9, user_id: 'user1', message: 'new', scheduled_time: scheduledTime };
      databaseService.updateReminder.mockReturnValue(row);

      const result = await reminderService.updateReminder(9, 'user1', {
        message: 'new',
        scheduledTime,
      });

      expect(databaseService.updateReminder).toHaveBeenCalledWith(9, 'user1', {
        message: 'new',
        scheduledTime,
      });
      expect(result).toBe(row);
      expect(reminderService.activeTimers.has(9)).toBe(true);
      reminderService.shutdown();
    });

    it('returns null and arms nothing when no active reminder matched', async () => {
      databaseService.updateReminder.mockReturnValue(null);
      expect(await reminderService.updateReminder(9, 'user1', { message: 'x' })).toBeNull();
      expect(reminderService.activeTimers.size).toBe(0);
    });

    it('rejects an edit that moves the reminder into the past', async () => {
      await expect(
        reminderService.updateReminder(9, 'user1', { scheduledTime: '2020-01-01T00:00:00Z' })
      ).rejects.toThrow('Scheduled time must be in the future');
    });
  });
});
