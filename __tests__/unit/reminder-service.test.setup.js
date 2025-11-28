const reminderService = require('../../src/services/reminder-service');
const databaseService = require('../../src/services/database');
const logger = require('../../src/utils/logger');

jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');

function initializeReminderServiceTestDefaults() {
  jest.clearAllMocks();
  reminderService.activeTimers.clear();
  reminderService.isInitialized = false;
  reminderService.eventListeners = new Map();

  databaseService.getActiveReminders.mockReturnValue([]);
  databaseService.createReminder.mockImplementation((userId, message, time, timezone, channelId, serverId) => ({
    id: 1,
    user_id: userId,
    message,
    scheduled_time: time,
    timezone,
    channel_id: channelId,
    server_id: serverId,
    status: 'pending',
  }));
  databaseService.completeReminder.mockReturnValue(true);
  databaseService.cancelReminder.mockReturnValue(true);
  databaseService.deleteReminder.mockReturnValue(true);
}

module.exports = {
  reminderService,
  databaseService,
  logger,
  initializeReminderServiceTestDefaults,
};

describe('Reminder service setup helper', () => {
  it('exposes initialization helpers', () => {
    expect(typeof initializeReminderServiceTestDefaults).toBe('function');
    expect(typeof reminderService).toBe('object');
  });
});
