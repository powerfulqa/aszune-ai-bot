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
    const listenerError = new Error('Listener Error');
    const errorListener = jest.fn(() => {
      throw listenerError;
    });
    reminderService.on('test', errorListener);

    expect(() => reminderService.emit('test')).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Error in event listener for test:', listenerError);
    expect(logger.error.mock.calls[0][1]).toBe(listenerError);
  });
});
