const {
  reminderService,
  logger,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

describe('ReminderService event emitter', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
  });

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
