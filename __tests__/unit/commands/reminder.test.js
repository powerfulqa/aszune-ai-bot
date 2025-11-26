// Mock dependencies
jest.mock('../../../src/services/reminder-service', () => ({
  setReminder: jest.fn(),
  getUserReminders: jest.fn(),
  cancelReminder: jest.fn(),
}));
jest.mock('../../../src/services/database', () => ({
  saveReminder: jest.fn(),
  getUserReminders: jest.fn(),
  cancelReminder: jest.fn(),
}));
jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn(),
  },
}));
jest.mock('../../../src/utils/input-validator', () => ({
  InputValidator: {
    validateUserId: jest.fn(),
    validateReminderMessage: jest.fn(),
    validateTimeString: jest.fn(),
  },
}));

const { handleSlashCommand } = require('../../../src/commands/index');
const reminderService = require('../../../src/services/reminder-service');
const { ErrorHandler } = require('../../../src/utils/error-handler');
const { InputValidator } = require('../../../src/utils/input-validator');

// Helper function to set up mocks
function setupReminderServiceMocks() {
  reminderService.setReminder.mockResolvedValue({
    id: '123',
    time: 'in 5 minutes',
    message: 'Test reminder',
    createdAt: new Date(),
    dueDate: 'Wed Oct 09 2025',
  });
  reminderService.getUserReminders.mockResolvedValue([]);
  reminderService.cancelReminder.mockResolvedValue(true);
}

function setupErrorHandlerMocks() {
  ErrorHandler.handleError.mockReturnValue({
    message: 'An unexpected error occurred. Please try again later.',
    type: 'error',
    context: 'reminder creation',
    timestamp: new Date().toISOString(),
  });
}

function setupValidatorMocks() {
  InputValidator.validateUserId.mockReturnValue({ valid: true });
  InputValidator.validateReminderMessage.mockReturnValue({ valid: true });
  InputValidator.validateTimeString.mockReturnValue({ valid: true });
}

// Helper functions for test data
function createRemindInteraction(overrides = {}) {
  return {
    commandName: 'remind',
    user: { id: 'user123' },
    channelId: 'channel123',
    guildId: 'guild123',
    options: {
      getString: jest
        .fn()
        .mockReturnValueOnce('in 5 minutes')
        .mockReturnValueOnce('Test reminder'),
    },
    deferReply: jest.fn(),
    editReply: jest.fn(),
    ...overrides,
  };
}

function createRemindersInteraction(overrides = {}) {
  return {
    commandName: 'reminders',
    user: { id: 'user123' },
    reply: jest.fn(),
    ...overrides,
  };
}

function createCancelReminderInteraction(reminderId = '123', overrides = {}) {
  return {
    commandName: 'cancelreminder',
    user: { id: 'user123' },
    options: {
      getString: jest.fn().mockReturnValue(reminderId),
    },
    reply: jest.fn(),
    ...overrides,
  };
}

describe('Reminder Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupReminderServiceMocks();
    setupErrorHandlerMocks();
    setupValidatorMocks();
  });

  describe('/remind command', () => {
    it('should handle /remind command successfully', async () => {
      const mockReminder = {
        id: '123',
        message: 'Test reminder',
        scheduled_time: new Date(Date.now() + 5 * 60000).toISOString(),
      };
      reminderService.setReminder.mockResolvedValue(mockReminder);
      await handleSlashCommand(createRemindInteraction());
      expect(reminderService.setReminder).toHaveBeenCalledWith(
        'user123',
        'in 5 minutes',
        'Test reminder',
        'channel123',
        'guild123'
      );
      expect(createRemindInteraction().editReply).not.toHaveBeenCalled(); // New interaction object
    });

    it('should handle /remind command with invalid message', async () => {
      InputValidator.validateReminderMessage.mockReturnValue({
        valid: false,
        error: 'Message too long',
      });
      const interaction = createRemindInteraction();
      await handleSlashCommand(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        '❌ Invalid reminder message: Message too long'
      );
    });

    it('should handle /remind command API error', async () => {
      reminderService.setReminder.mockRejectedValue(new Error('API Error'));
      const interaction = createRemindInteraction({ replied: false, deferred: true });
      await handleSlashCommand(interaction);
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  describe('/reminders command', () => {
    it('should handle /reminders command successfully with reminders', async () => {
      const mockReminders = [
        {
          id: '123',
          message: 'Test reminder 1',
          scheduled_time: new Date(Date.now() + 5 * 60000).toISOString(),
        },
        {
          id: '124',
          message: 'Test reminder 2',
          scheduled_time: new Date(Date.now() + 24 * 3600000).toISOString(),
        },
      ];
      reminderService.getUserReminders.mockResolvedValue(mockReminders);
      const interaction = createRemindersInteraction();
      await handleSlashCommand(interaction);
      expect(reminderService.getUserReminders).toHaveBeenCalledWith('user123');
      expect(interaction.reply).toHaveBeenCalled();
      const callArgs = interaction.reply.mock.calls[0][0];
      expect(callArgs.embeds).toBeDefined();
      expect(callArgs.embeds[0].title).toBe('📝 Your Active Reminders');
    });

    it('should handle /reminders command with no reminders', async () => {
      reminderService.getUserReminders.mockResolvedValue([]);
      const interaction = createRemindersInteraction();
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0xffa500,
            title: '📝 Your Reminders',
            description: 'You have no active reminders.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    });

    it('should handle /reminders command API error', async () => {
      reminderService.getUserReminders.mockRejectedValue(new Error('API Error'));
      const interaction = createRemindersInteraction({ replied: false });
      await handleSlashCommand(interaction);
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe('/cancelreminder command', () => {
    it('should handle /cancelreminder command successfully', async () => {
      reminderService.cancelReminder.mockResolvedValue(true);
      const interaction = createCancelReminderInteraction();
      await handleSlashCommand(interaction);
      expect(reminderService.cancelReminder).toHaveBeenCalledWith('user123', '123');
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x00ff00,
            title: '✅ Reminder Cancelled',
            description: 'Reminder 123 has been cancelled.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    });

    it('should handle /cancelreminder command with non-existent reminder', async () => {
      reminderService.cancelReminder.mockResolvedValue(false);
      const interaction = createCancelReminderInteraction('999');
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0xff0000,
            title: '❌ Reminder Not Found',
            description:
              'Could not find reminder 999. Use `/reminders` to see your active reminders.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    });

    it('should handle /cancelreminder command API error', async () => {
      reminderService.cancelReminder.mockRejectedValue(new Error('API Error'));
      const interaction = createCancelReminderInteraction();
      await handleSlashCommand(interaction);
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again later.'
      );
    });
  });
});
