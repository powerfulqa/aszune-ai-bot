const {
  reminderService,
  databaseService,
  logger,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

describe('ReminderService initialize', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
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

      const scheduleSpy = jest.spyOn(reminderService, 'scheduleReminder');

      await reminderService.loadAndScheduleReminders();

      expect(scheduleSpy).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Loaded and scheduled 2 active reminders');
    });

    it('delivers reminders that fell due while the bot was down', async () => {
      const pastDue = { id: 7, scheduled_time: '2020-01-01T00:00:00.000Z', user_id: 'user1' };
      databaseService.getDueReminders.mockReturnValue([pastDue]);
      databaseService.completeReminder.mockReturnValue(true);
      const listener = jest.fn().mockResolvedValue(undefined);
      reminderService.on('reminderDue', listener);

      await reminderService.loadAndScheduleReminders();

      expect(listener).toHaveBeenCalledWith(pastDue);
      expect(databaseService.completeReminder).toHaveBeenCalledWith(7);
    });

    it('keeps scheduling after one reminder fails to schedule', async () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      databaseService.getActiveReminders.mockReturnValue([
        { id: 1, scheduled_time: futureTime, user_id: 'user1' },
        { id: 2, scheduled_time: futureTime, user_id: 'user2' },
      ]);
      jest
        .spyOn(reminderService, 'scheduleReminder')
        .mockRejectedValueOnce(new Error('bad row'))
        .mockResolvedValueOnce(undefined);

      await reminderService.loadAndScheduleReminders();

      expect(reminderService.scheduleReminder).toHaveBeenCalledTimes(2);
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
});
