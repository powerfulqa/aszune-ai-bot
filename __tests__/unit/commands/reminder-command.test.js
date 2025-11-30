jest.mock('../../../src/services/reminder-service', () => ({
  createReminder: jest.fn(),
  getUserReminders: jest.fn(),
  cancelReminder: jest.fn(),
}));
jest.mock('../../../src/utils/time-parser', () => ({
  parseTimeExpression: jest.fn(),
  getRelativeTime: jest.fn(),
  formatTime: jest.fn(),
}));
jest.mock('../../../src/utils/error-handler', () => ({
  handleError: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const reminderService = require('../../../src/services/reminder-service');
const timeParser = require('../../../src/utils/time-parser');
const ErrorHandler = require('../../../src/utils/error-handler');
const reminderModule = require('../../../src/commands/reminder');
const logger = require('../../../src/utils/logger');
const { handleReminderCommand, handleReminderDue } = reminderModule;

describe('Reminder command helpers', () => {
  const createMessage = (overrides = {}) => ({
    content: '!reminder help',
    author: { id: 'user-1' },
    channel: { id: 'channel-1' },
    guild: { id: 'guild-1' },
    reply: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    reminderService.createReminder.mockReset();
    reminderService.getUserReminders.mockReset();
    reminderService.cancelReminder.mockReset();
    timeParser.parseTimeExpression.mockReset();
    timeParser.getRelativeTime.mockReset();
    timeParser.formatTime.mockReset();
    ErrorHandler.handleError.mockReset();
  });

  it('handles the !remind alias and sets a reminder', async () => {
    const future = new Date(Date.now() + 60000);
    timeParser.parseTimeExpression.mockReturnValue({
      scheduledTime: future,
      timezone: 'UTC',
    });
    timeParser.getRelativeTime.mockReturnValue('in 1 minute');
    timeParser.formatTime.mockReturnValue('12:00 UTC');
    reminderService.createReminder.mockResolvedValue({ id: '99' });

    const message = createMessage({ content: '!remind in 1 minute Bake pie' });
    await handleReminderCommand(message, ['in 1 minute', 'Bake pie']);

    expect(reminderService.createReminder).toHaveBeenCalledWith(
      'user-1',
      'Bake pie',
      expect.any(String),
      'UTC',
      'channel-1',
      'guild-1'
    );
    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: '✅ Reminder Set!' }),
        ]),
      })
    );
  });

  it('shows help when !remind alias is missing arguments', async () => {
    const message = createMessage({ content: '!remind in 5 minutes' });
    await handleReminderCommand(message, ['in 5 minutes']);

    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: '⏰ Reminder System Help' }),
        ]),
      })
    );
  });

  it('lists reminders when the subcommand is list', async () => {
    const reminders = [
      { id: 1, message: 'A', scheduled_time: new Date().toISOString(), timezone: 'UTC' },
    ];
    reminderService.getUserReminders.mockReturnValue(reminders);
    timeParser.getRelativeTime.mockReturnValue('in 5 minutes');
    timeParser.formatTime.mockReturnValue('12:00 UTC');

    const message = createMessage({ content: '!reminder list' });
    await handleReminderCommand(message, ['list']);

    expect(reminderService.getUserReminders).toHaveBeenCalledWith('user-1');
    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: `Your Reminders (${reminders.length})`,
          }),
        ]),
      })
    );
  });

  it('returns a friendly reply when listing with no reminders', async () => {
    reminderService.getUserReminders.mockReturnValue([]);
    const message = createMessage({ content: '!reminder list' });

    await handleReminderCommand(message, ['list']);

    expect(message.reply).toHaveBeenCalledWith({
      embeds: [
        {
          color: 0x0099ff,
          title: 'Your Reminders',
          description: 'You have no active reminders.',
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
  });

  it('handles cancel with invalid id arguments', async () => {
    const message = createMessage({ content: '!reminder cancel' });
    await handleReminderCommand(message, ['cancel']);

    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: 'Invalid Cancel Format' }),
        ]),
      })
    );
  });

  it('informs the user when a reminder cannot be found during cancel', async () => {
    reminderService.cancelReminder.mockResolvedValue(false);
    const message = createMessage({ content: '!reminder cancel 5' });
    await handleReminderCommand(message, ['cancel', '5']);

    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ title: 'Reminder Not Found' }),
        ]),
      })
    );
  });

  it('handles unexpected errors at the command level', async () => {
    ErrorHandler.handleError.mockReturnValue({ message: 'Fallback message' });

    const message = createMessage({ content: '!remind help' });
    message.reply
      .mockImplementationOnce(() => Promise.reject(new Error('send failure')))
      .mockResolvedValue();

    await handleReminderCommand(message, ['help']);

    expect(ErrorHandler.handleError).toHaveBeenCalled();
    const lastCall = message.reply.mock.calls[message.reply.mock.calls.length - 1][0];
    expect(lastCall).toMatchObject({
      embeds: [
        expect.objectContaining({
          title: 'Reminder Error',
          description: 'Fallback message',
        }),
      ],
    });
  });

  it('logs reminder due events without throwing', async () => {
    const reminder = { id: 42, user_id: 'user-1', message: 'Reminder' };
    await handleReminderDue(reminder);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Reminder due: 42')
    );
  });
});
