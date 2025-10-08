/**
 * Reminder ID Display Fix Test
 * Verifies that reminder ID is correctly extracted from reminder object
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/reminder-service', () => ({
  createReminder: jest.fn().mockResolvedValue({
    id: 42,
    user_id: 'test-user-123',
    message: 'Test reminder',
    scheduled_time: new Date('2025-10-08T14:00:00Z').toISOString(),
    timezone: 'UTC',
    status: 'active',
  }),
  getUserReminders: jest.fn().mockReturnValue([]),
  cancelReminder: jest.fn(),
}));
jest.mock('../../../src/utils/time-parser', () => ({
  parseTimeExpression: jest.fn().mockReturnValue({
    scheduledTime: new Date('2025-10-08T14:00:00Z'),
    timezone: 'UTC',
  }),
  getRelativeTime: jest.fn().mockReturnValue('in 3 hours'),
  formatTime: jest.fn().mockReturnValue('Wednesday, October 8, 2025 at 11:00:00 AM'),
}));
jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockReturnValue({ message: 'Test error' }),
  },
}));

const { handleReminderCommand } = require('../../../src/commands/reminder');
const reminderService = require('../../../src/services/reminder-service');

describe('Reminder Command - ID Display Fix', () => {
  let mockMessage;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessage = {
      author: {
        id: 'test-user-123',
        username: 'testuser',
      },
      channel: {
        id: 'test-channel-123',
      },
      guild: {
        id: 'test-guild-123',
      },
      content: '!remind "in 3 hours" test',
      reply: jest.fn().mockResolvedValue({}),
    };
  });

  it('should display numeric reminder ID instead of [object Object]', async () => {
    mockMessage.content = '!remind "in 3 hours" Test reminder message';

    await handleReminderCommand(mockMessage, [
      'set',
      '"in 3 hours"',
      'Test',
      'reminder',
      'message',
    ]);

    // Verify reply was called
    expect(mockMessage.reply).toHaveBeenCalled();

    // Get the reply call
    const replyCall = mockMessage.reply.mock.calls[0][0];

    // Verify it's an embed
    expect(replyCall).toHaveProperty('embeds');
    expect(Array.isArray(replyCall.embeds)).toBe(true);
    expect(replyCall.embeds.length).toBe(1);

    const embed = replyCall.embeds[0];

    // Verify the embed has a footer with the reminder ID
    expect(embed).toHaveProperty('footer');
    expect(embed.footer).toHaveProperty('text');

    // CRITICAL: Verify the reminder ID is displayed as a number, not [object Object]
    expect(embed.footer.text).toContain('Reminder ID: 42');
    expect(embed.footer.text).not.toContain('[object Object]');
    expect(embed.footer.text).toMatch(/Reminder ID: \d+/);

    // Verify reminder service was called correctly
    // Note: The message includes the time expression because of how args are parsed
    expect(reminderService.createReminder).toHaveBeenCalledWith(
      'test-user-123',
      '"in 3 hours" Test reminder message', // Time expression is included in message
      expect.any(String), // ISO string
      'UTC',
      'test-channel-123',
      'test-guild-123'
    );
  });

  it('should handle reminder creation with correct ID extraction', async () => {
    // Mock a different reminder ID
    reminderService.createReminder.mockResolvedValueOnce({
      id: 999,
      user_id: 'test-user-123',
      message: 'Another test',
      scheduled_time: new Date('2025-10-09T10:00:00Z').toISOString(),
      timezone: 'America/New_York',
      status: 'active',
    });

    mockMessage.content = '!reminder set "tomorrow" Check email';

    await handleReminderCommand(mockMessage, ['set', '"tomorrow"', 'Check', 'email']);

    const replyCall = mockMessage.reply.mock.calls[0][0];
    const embed = replyCall.embeds[0];

    // Verify the correct ID is displayed
    expect(embed.footer.text).toContain('Reminder ID: 999');
    expect(embed.footer.text).not.toContain('[object Object]');
  });

  it('should include all reminder details in success message', async () => {
    mockMessage.content = '!remind "in 5 minutes" Important task';

    await handleReminderCommand(mockMessage, ['set', '"in 5 minutes"', 'Important', 'task']);

    const replyCall = mockMessage.reply.mock.calls[0][0];
    const embed = replyCall.embeds[0];

    // Verify embed structure
    expect(embed.color).toBe(0x00ff00); // Green color for success
    expect(embed.title).toBe('✅ Reminder Set!');
    expect(embed.description).toContain('Important task');
    expect(embed.description).toContain('in 3 hours');
    expect(embed.description).toContain('Wednesday, October 8, 2025');

    // Verify footer contains both ID and bot name
    expect(embed.footer.text).toMatch(/Reminder ID: \d+ \| Aszai Bot/);
  });
});
