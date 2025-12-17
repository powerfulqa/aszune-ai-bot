const {
  reminderService,
  databaseService,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

describe('ReminderService command parsing', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
  });

  afterEach(() => {
    // Ensure no timers leak between tests (and avoid Jest open-handle warnings)
    reminderService.shutdown();
    jest.restoreAllMocks();
  });

  describe('setReminder', () => {
    it('should parse "in X minutes" format', async () => {
      const createSpy = jest.spyOn(reminderService, 'createReminder').mockResolvedValue({ id: 1 });

      await reminderService.setReminder('user1', 'in 5 minutes', 'test message');

      expect(createSpy).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          message: 'test message',
          scheduledTime: expect.any(String),
          timezone: expect.any(String),
          channelId: null,
          serverId: null,
        })
      );
    });

    it('should parse "in X hours" format', async () => {
      const createSpy = jest.spyOn(reminderService, 'createReminder').mockResolvedValue({ id: 1 });

      await reminderService.setReminder('user1', 'in 2 hours', 'test message');

      expect(createSpy).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          message: 'test message',
          scheduledTime: expect.any(String),
          timezone: expect.any(String),
          channelId: null,
          serverId: null,
        })
      );
    });

    it('should parse "tomorrow" format', async () => {
      const createSpy = jest.spyOn(reminderService, 'createReminder').mockResolvedValue({ id: 1 });

      await reminderService.setReminder('user1', 'tomorrow', 'test message');

      expect(createSpy).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          message: 'test message',
          scheduledTime: expect.any(String),
          timezone: expect.any(String),
          channelId: null,
          serverId: null,
        })
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
      expect(reminderService.activeTimers.has(1)).toBe(false);
    });

    it('should return false if delete fails', async () => {
      databaseService.deleteReminder.mockReturnValueOnce(false);

      const result = await reminderService.deleteReminder(999, 'nonexistent-user');

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      const error = new Error('Delete Error');
      jest.spyOn(reminderService, 'deleteReminder').mockRejectedValue(error);

      await expect(reminderService.deleteReminder(1, 'user1')).rejects.toThrow(error);
    });
  });
});
