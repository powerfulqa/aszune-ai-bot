jest.mock('../../../../src/utils/logger');
jest.mock('../../../../src/services/database');
jest.mock('../../../../src/services/reminder-service', () => ({
  createReminder: jest.fn(),
  updateReminder: jest.fn(),
  deleteReminder: jest.fn(),
}));

const reminderService = require('../../../../src/services/reminder-service');
const {
  handleCreateReminder,
  handleEditReminder,
  handleDeleteReminder,
} = require('../../../../src/services/web-dashboard/handlers/reminderHandlers');

const USER = '123456789012345678';
const CHANNEL = '876543210987654321';
const WHEN = '2099-01-01T00:00:00.000Z';

// The handlers must go through the reminder service: writing the row alone
// leaves the timer out of step (a created reminder never fires, a deleted one
// still does).
describe('dashboard reminder handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates through the reminder service so the reminder is scheduled', async () => {
    const reminder = { id: 5, user_id: USER, message: 'raid' };
    reminderService.createReminder.mockResolvedValue(reminder);
    const callback = jest.fn();

    await handleCreateReminder(
      { userId: USER, channelId: CHANNEL, message: 'raid', scheduledTime: WHEN },
      callback
    );

    expect(reminderService.createReminder).toHaveBeenCalledWith(USER, {
      message: 'raid',
      scheduledTime: WHEN,
      channelId: CHANNEL,
    });
    expect(callback.mock.calls[0][0].created).toBe(true);
    expect(callback.mock.calls[0][0].reminder).toBe(reminder);
  });

  it.each([
    ['no channel', { userId: USER, message: 'm', scheduledTime: WHEN }],
    [
      'a placeholder user',
      { userId: 'dashboard-user', channelId: CHANNEL, message: 'm', scheduledTime: WHEN },
    ],
  ])('refuses to create with %s (it could never be delivered)', async (_name, data) => {
    const callback = jest.fn();
    await handleCreateReminder(data, callback);
    expect(reminderService.createReminder).not.toHaveBeenCalled();
    expect(callback.mock.calls[0][0].created).toBe(false);
  });

  it('persists an edit and reports the stored row', async () => {
    const reminder = { id: 5, message: 'new' };
    reminderService.updateReminder.mockResolvedValue(reminder);
    const callback = jest.fn();

    await handleEditReminder({ reminderId: '5', userId: USER, message: 'new' }, callback);

    expect(reminderService.updateReminder).toHaveBeenCalledWith('5', USER, {
      message: 'new',
      scheduledTime: undefined,
    });
    expect(callback.mock.calls[0][0].updated).toBe(true);
    expect(callback.mock.calls[0][0].reminder).toBe(reminder);
  });

  it('reports a failed edit when no active reminder matched', async () => {
    reminderService.updateReminder.mockResolvedValue(null);
    const callback = jest.fn();
    await handleEditReminder({ reminderId: '5', userId: USER, message: 'new' }, callback);
    expect(callback).toHaveBeenCalledWith({ error: 'Reminder not found: 5', updated: false });
  });

  it('deletes through the reminder service so the timer is cleared', async () => {
    reminderService.deleteReminder.mockResolvedValue(true);
    const callback = jest.fn();
    await handleDeleteReminder({ reminderId: '5', userId: USER }, callback);
    expect(reminderService.deleteReminder).toHaveBeenCalledWith('5', USER);
    expect(callback.mock.calls[0][0].deleted).toBe(true);
  });

  it('does not throw when the client sends a non-function as the callback', async () => {
    reminderService.deleteReminder.mockResolvedValue(false);
    await expect(
      handleDeleteReminder({ reminderId: '5', userId: USER }, 'x')
    ).resolves.toBeUndefined();
  });
});
