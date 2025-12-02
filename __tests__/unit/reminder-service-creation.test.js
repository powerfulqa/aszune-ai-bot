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
});
