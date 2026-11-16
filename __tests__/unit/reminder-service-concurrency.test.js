const {
  reminderService,
  databaseService,
  initializeReminderServiceTestDefaults,
} = require('./reminder-service.test.setup');

const future = () => new Date(Date.now() + 60000).toISOString();

describe('ReminderService startup, edits and delivery', () => {
  beforeEach(() => {
    initializeReminderServiceTestDefaults();
    reminderService.delivering.clear();
    reminderService._initializing = null;
  });

  afterEach(() => reminderService.shutdown());

  it('runs one startup load when initialize() is called again while it is running', async () => {
    let release;
    const sending = new Promise((resolve) => (release = resolve));
    const pastDue = { id: 7, scheduled_time: '2020-01-01T00:00:00.000Z', user_id: 'u1' };
    databaseService.getDueReminders.mockReturnValue([pastDue]);
    databaseService.completeReminder.mockReturnValue(true);
    const listener = jest.fn(() => sending);
    reminderService.on('reminderDue', listener);

    const first = reminderService.initialize();
    const second = reminderService.initialize(); // e.g. a chat reminder during startup
    release();
    await Promise.all([first, second]);

    expect(databaseService.getDueReminders).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('can be initialized again after a failed load', async () => {
    databaseService.getActiveReminders.mockImplementationOnce(() => {
      throw new Error('db down');
    });
    await expect(reminderService.initialize()).rejects.toThrow('db down');

    await reminderService.initialize();
    expect(reminderService.isInitialized).toBe(true);
  });

  it('arms future reminders before it works through the overdue backlog', async () => {
    const order = [];
    databaseService.getDueReminders.mockReturnValue([{ id: 1, scheduled_time: '2020-01-01' }]);
    databaseService.getActiveReminders.mockReturnValue([{ id: 2, scheduled_time: future() }]);
    jest.spyOn(reminderService, 'scheduleReminder').mockImplementation(async (r) => {
      order.push(r.id);
    });

    await reminderService.loadAndScheduleReminders();

    expect(order).toEqual([2, 1]);
  });

  it.each([
    ['empty', '   ', 'Reminder message must not be empty'],
    ['not text', 42, 'Reminder message must not be empty'],
    ['too long for an embed', 'x'.repeat(4097), 'Reminder message must be at most 4096 characters'],
  ])('rejects an edit whose message is %s', async (_name, message, error) => {
    await expect(reminderService.updateReminder(9, 'u1', { message })).rejects.toThrow(error);
    expect(databaseService.updateReminder).not.toHaveBeenCalled();
  });

  it('rejects a new reminder whose message is too long for an embed', async () => {
    await expect(
      reminderService.createReminder('u1', { message: 'x'.repeat(4097), scheduledTime: future() })
    ).rejects.toThrow('Reminder message must be at most 4096 characters');
    expect(databaseService.createReminder).not.toHaveBeenCalled();
  });

  it('refuses an edit while that reminder is being delivered, and allows it afterwards', async () => {
    let release;
    const sending = new Promise((resolve) => (release = resolve));
    reminderService.on('reminderDue', () => sending);
    databaseService.completeReminder.mockReturnValue(true);
    const delivery = reminderService.executeReminder({ id: 9, user_id: 'u1' });

    await expect(reminderService.updateReminder('9', 'u1', { message: 'new' })).rejects.toThrow(
      'This reminder is being delivered right now. Try again in a moment.'
    );
    expect(databaseService.updateReminder).not.toHaveBeenCalled();

    release();
    await delivery;
    databaseService.updateReminder.mockReturnValue(null); // already completed by then
    expect(await reminderService.updateReminder('9', 'u1', { message: 'new' })).toBeNull();
  });
});
