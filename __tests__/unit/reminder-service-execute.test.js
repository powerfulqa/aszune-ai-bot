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
});
