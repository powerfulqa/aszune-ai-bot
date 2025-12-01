const { reminderService, databaseService, logger, initializeReminderServiceTestDefaults } = require('./reminder-service.test.setup');

describe('ReminderService scheduling', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
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

      jest.runAllTimers();

      expect(databaseService.completeReminder).toHaveBeenCalledWith(1);
      jest.useRealTimers();
    });

    it('should schedule long-term reminders with interval check', async () => {
      jest.useFakeTimers();
      const futureTime = new Date(Date.now() + 25 * 60 * 60 * 1000);
      const reminder = { id: 1, scheduled_time: futureTime.toISOString() };

      await reminderService.scheduleReminder(reminder);

      expect(reminderService.activeTimers.has(1)).toBe(true);
      expect(reminderService.activeTimers.get(1).type).toBe('interval');

      jest.setSystemTime(new Date(futureTime.getTime() - 120000));
      jest.advanceTimersByTime(60000);
      expect(databaseService.completeReminder).not.toHaveBeenCalled();

      jest.setSystemTime(new Date(futureTime.getTime() + 1000));
      jest.advanceTimersByTime(60000);

      expect(databaseService.completeReminder).toHaveBeenCalledWith(1);
      jest.useRealTimers();
    });

    it('should clear existing timer before scheduling new one', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const reminder = { id: 1, scheduled_time: futureTime };

      await reminderService.scheduleReminder(reminder);
      const firstTimer = reminderService.activeTimers.get(1);

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
});
