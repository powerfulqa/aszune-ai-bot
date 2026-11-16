jest.mock('../../src/utils/logger');
jest.mock('../../src/services/reminder-service', () => ({
  isInitialized: true,
  initialize: jest.fn(),
  setReminder: jest.fn(),
}));

const { checkForSimpleReminderRequest } = require('../../src/services/chat');

// The message comes before the time in some phrasings and after it in others.
describe('simple reminder phrasing', () => {
  it.each([
    ['remind me in 2 hours about the raid', 'in 2 hours', 'the raid'],
    ['remind me in 5 minutes to check the oven', 'in 5 minutes', 'check the oven'],
    ['remind me to check the oven in 5 minutes', 'in 5 minutes', 'check the oven'],
    ['remind me in 1 day', 'in 1 day', 'Reminder'],
  ])('maps time and message for "%s"', async (text, timeString, message) => {
    const reminderService = require('../../src/services/reminder-service');
    reminderService.setReminder = jest.fn().mockResolvedValue({ id: 1 });
    reminderService.isInitialized = true;

    const result = await checkForSimpleReminderRequest(text, 'user123', 'channel456', 'server789');

    expect(reminderService.setReminder).toHaveBeenCalledWith(
      'user123',
      timeString,
      message,
      'channel456',
      'server789'
    );
    expect(result.success).toBe(true);
  });
});
