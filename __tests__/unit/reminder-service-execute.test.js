const {
  reminderService,
  databaseService,
  logger,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

describe('ReminderService execution', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
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

    it('should warn if database completion fails after delivery', async () => {
      databaseService.completeReminder.mockReturnValue(false);
      const reminder = { id: 1, user_id: 'user1' };
      const emitSpy = jest.spyOn(reminderService, 'emit');

      await reminderService.executeReminder(reminder);

      expect(emitSpy).toHaveBeenCalledWith('reminderDue', reminder);
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

  describe('delivery failure', () => {
    const reminder = { id: 7, user_id: 'user1' };

    beforeEach(() => {
      jest.useFakeTimers();
      reminderService.eventListeners = new Map();
    });

    afterEach(() => {
      reminderService.shutdown();
      reminderService.eventListeners = new Map();
      jest.useRealTimers();
    });

    it('keeps the reminder active and retries until the send succeeds', async () => {
      const listener = jest
        .fn()
        .mockRejectedValueOnce(new Error('Discord unavailable'))
        .mockResolvedValueOnce(undefined);
      reminderService.on('reminderDue', listener);

      await reminderService.executeReminder(reminder);

      expect(databaseService.completeReminder).not.toHaveBeenCalled();
      expect(reminderService.activeTimers.has(7)).toBe(true);

      await jest.advanceTimersByTimeAsync(60000);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(databaseService.completeReminder).toHaveBeenCalledWith(7);
      expect(reminderService.activeTimers.has(7)).toBe(false);
    });

    it('stops after five attempts and leaves the reminder for the next start', async () => {
      const listener = jest.fn().mockRejectedValue(new Error('Discord unavailable'));
      reminderService.on('reminderDue', listener);

      await reminderService.executeReminder(reminder);
      await jest.advanceTimersByTimeAsync(10 * 60000);

      expect(listener).toHaveBeenCalledTimes(5);
      expect(databaseService.completeReminder).not.toHaveBeenCalled();
      expect(reminderService.activeTimers.has(7)).toBe(false);
    });

    it('completes a reminder whose channel no longer exists without retrying', async () => {
      const gone = new Error('Unknown Channel');
      gone.code = 10003;
      const listener = jest.fn().mockRejectedValue(gone);
      reminderService.on('reminderDue', listener);

      await reminderService.executeReminder(reminder);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(databaseService.completeReminder).toHaveBeenCalledWith(7);
      expect(reminderService.activeTimers.has(7)).toBe(false);
    });
  });
});
