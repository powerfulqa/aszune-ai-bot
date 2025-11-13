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

describe('Reminder Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock implementations
    reminderService.setReminder.mockResolvedValue({
      id: '123',
      time: 'in 5 minutes',
      message: 'Test reminder',
      createdAt: new Date(),
      dueDate: 'Wed Oct 09 2025',
    });
    reminderService.getUserReminders.mockResolvedValue([]);
    reminderService.cancelReminder.mockResolvedValue(true);

    ErrorHandler.handleError.mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'error',
      context: 'reminder creation',
      timestamp: new Date().toISOString(),
    });

    InputValidator.validateUserId.mockReturnValue({ valid: true });
    InputValidator.validateReminderMessage.mockReturnValue({ valid: true });
    InputValidator.validateTimeString.mockReturnValue({ valid: true });
  });

  describe('/remind command', () => {
    it('should handle /remind command successfully', async () => {
      const mockReminder = {
        id: '123',
        time: 'in 5 minutes',
        message: 'Test reminder',
        createdAt: new Date(),
        dueDate: 'Wed Oct 09 2025',
      };

      reminderService.setReminder.mockResolvedValue(mockReminder);

      const interaction = {
        commandName: 'remind',
        user: { id: 'user123' },
        options: {
          getString: jest
            .fn()
            .mockReturnValueOnce('in 5 minutes') // time
            .mockReturnValueOnce('Test reminder'), // message
        },
        reply: jest.fn(),
      };

      await handleSlashCommand(interaction);

      expect(reminderService.setReminder).toHaveBeenCalledWith(
        'user123',
        'in 5 minutes',
        'Test reminder'
      );
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x00ff00,
            title: '⏰ Reminder Set',
            description: `I'll remind you: **Test reminder**\n⏰ ${mockReminder.dueDate}`,
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    });

    it('should handle /remind command with invalid message', async () => {
      InputValidator.validateReminderMessage.mockReturnValue({
        valid: false,
        error: 'Message too long',
      });

      const interaction = {
        commandName: 'remind',
        user: { id: 'user123' },
        options: {
          getString: jest
            .fn()
            .mockReturnValueOnce('in 5 minutes')
            .mockReturnValueOnce('Invalid message'),
        },
        reply: jest.fn(),
      };

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        '❌ Invalid reminder message: Message too long'
      );
    });

    it('should handle /remind command API error', async () => {
      reminderService.setReminder.mockRejectedValue(new Error('API Error'));

      const interaction = {
        commandName: 'remind',
        user: { id: 'user123' },
        options: {
          getString: jest
            .fn()
            .mockReturnValueOnce('in 5 minutes')
            .mockReturnValueOnce('Test reminder'),
        },
        reply: jest.fn(),
      };

      await handleSlashCommand(interaction);

      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again later.'
      );
    });
  });

  describe('/reminders command', () => {
    it('should handle /reminders command successfully with reminders', async () => {
      const mockReminders = [
        {
          id: '123',
          time: 'in 5 minutes',
          message: 'Test reminder 1',
          createdAt: new Date(),
          dueDate: 'Wed Oct 09 2025',
        },
        {
          id: '124',
          time: 'tomorrow',
          message: 'Test reminder 2',
          createdAt: new Date(),
          dueDate: 'Wed Oct 09 2025',
        },
      ];

      reminderService.getUserReminders.mockResolvedValue(mockReminders);

      const interaction = {
        commandName: 'reminders',
        user: { id: 'user123' },
        reply: jest.fn(),
      };

      await handleSlashCommand(interaction);

      expect(reminderService.getUserReminders).toHaveBeenCalledWith('user123');
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x0099ff,
            title: '📝 Your Active Reminders',
            description:
              '**123**: Test reminder 1\n⏰ Wed Oct 09 2025\n\n**124**: Test reminder 2\n⏰ Wed Oct 09 2025',
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    });

    it('should handle /reminders command with no reminders', async () => {
      reminderService.getUserReminders.mockResolvedValue([]);

      const interaction = {
        commandName: 'reminders',
        user: { id: 'user123' },
        reply: jest.fn(),
      };

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

      const interaction = {
        commandName: 'reminders',
        user: { id: 'user123' },
        reply: jest.fn(),
      };

      await handleSlashCommand(interaction);

      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again later.'
      );
    });
  });

  describe('/cancelreminder command', () => {
    it('should handle /cancelreminder command successfully', async () => {
      reminderService.cancelReminder.mockResolvedValue(true);

      const interaction = {
        commandName: 'cancelreminder',
        user: { id: 'user123' },
        options: {
          getString: jest.fn().mockReturnValue('123'),
        },
        reply: jest.fn(),
      };

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

      const interaction = {
        commandName: 'cancelreminder',
        user: { id: 'user123' },
        options: {
          getString: jest.fn().mockReturnValue('999'),
        },
        reply: jest.fn(),
      };

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

      const interaction = {
        commandName: 'cancelreminder',
        user: { id: 'user123' },
        options: {
          getString: jest.fn().mockReturnValue('123'),
        },
        reply: jest.fn(),
      };

      await handleSlashCommand(interaction);

      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again later.'
      );
    });
  });
});
