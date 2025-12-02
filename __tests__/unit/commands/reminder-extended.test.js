/* eslint-disable max-lines-per-function */
/**
 * Reminder Command Extended Coverage Tests
 * Additional tests for reminder.js to improve branch and statement coverage
 */

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
  handleError: jest.fn().mockReturnValue({ message: 'Error occurred' }),
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const reminderService = require('../../../src/services/reminder-service');
const timeParser = require('../../../src/utils/time-parser');
const logger = require('../../../src/utils/logger');
const { handleReminderCommand, handleReminderDue } = require('../../../src/commands/reminder');

describe('Reminder Command Extended Coverage', () => {
  const createMessage = (content, overrides = {}) => ({
    content,
    author: { id: 'user-123' },
    channel: { id: 'channel-123' },
    guild: { id: 'guild-123' },
    reply: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCommandAliases', () => {
    describe('!reminders alias', () => {
      it('should list reminders when using !reminders alias', async () => {
        const reminders = [
          { id: 1, message: 'Test', scheduled_time: new Date().toISOString(), timezone: 'UTC' },
        ];
        reminderService.getUserReminders.mockReturnValue(reminders);
        timeParser.getRelativeTime.mockReturnValue('in 5 minutes');
        timeParser.formatTime.mockReturnValue('12:00 UTC');

        const message = createMessage('!reminders');
        await handleReminderCommand(message, []);

        expect(reminderService.getUserReminders).toHaveBeenCalledWith('user-123');
        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: expect.stringContaining('Reminders') }),
            ]),
          })
        );
      });
    });

    describe('!cancelreminder alias', () => {
      it('should show error when !cancelreminder is used without ID', async () => {
        const message = createMessage('!cancelreminder');
        await handleReminderCommand(message, []);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: 'Missing Reminder ID' }),
            ]),
          })
        );
      });

      it('should cancel reminder when !cancelreminder is used with valid ID', async () => {
        reminderService.cancelReminder.mockResolvedValue(true);

        const message = createMessage('!cancelreminder 5');
        await handleReminderCommand(message, ['5']);

        expect(reminderService.cancelReminder).toHaveBeenCalledWith(5, 'user-123');
        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: '✅ Reminder Cancelled' }),
            ]),
          })
        );
      });
    });
  });

  describe('handleReminderSubcommands', () => {
    describe('set/create subcommand', () => {
      it('should handle "set" subcommand', async () => {
        const future = new Date(Date.now() + 60000);
        timeParser.parseTimeExpression.mockReturnValue({
          scheduledTime: future,
          timezone: 'UTC',
        });
        timeParser.getRelativeTime.mockReturnValue('in 1 minute');
        timeParser.formatTime.mockReturnValue('12:00 UTC');
        reminderService.createReminder.mockResolvedValue({ id: '1' });

        const message = createMessage('!reminder set "in 1 minute" Test');
        await handleReminderCommand(message, ['set', 'in 1 minute', 'Test']);

        expect(reminderService.createReminder).toHaveBeenCalled();
        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: '✅ Reminder Set!' }),
            ]),
          })
        );
      });

      it('should handle "create" subcommand', async () => {
        const future = new Date(Date.now() + 60000);
        timeParser.parseTimeExpression.mockReturnValue({
          scheduledTime: future,
          timezone: 'UTC',
        });
        timeParser.getRelativeTime.mockReturnValue('in 1 minute');
        timeParser.formatTime.mockReturnValue('12:00 UTC');
        reminderService.createReminder.mockResolvedValue({ id: '2' });

        const message = createMessage('!reminder create "in 1 minute" Test');
        await handleReminderCommand(message, ['create', 'in 1 minute', 'Test']);

        expect(reminderService.createReminder).toHaveBeenCalled();
      });

      it('should show invalid format when set has insufficient args', async () => {
        const message = createMessage('!reminder set "in 5 min"');
        await handleReminderCommand(message, ['set', 'in 5 min']);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: 'Invalid Reminder Format' }),
            ]),
          })
        );
      });
    });

    describe('list/show subcommand', () => {
      it('should handle "show" subcommand', async () => {
        reminderService.getUserReminders.mockReturnValue([]);

        const message = createMessage('!reminder show');
        await handleReminderCommand(message, ['show']);

        expect(reminderService.getUserReminders).toHaveBeenCalledWith('user-123');
      });

      it('should truncate long reminder list', async () => {
        const longMessage = 'A'.repeat(500);
        const manyReminders = Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          message: longMessage,
          scheduled_time: new Date().toISOString(),
          timezone: 'UTC',
        }));
        reminderService.getUserReminders.mockReturnValue(manyReminders);
        timeParser.getRelativeTime.mockReturnValue('in 5 minutes');
        timeParser.formatTime.mockReturnValue('12:00 UTC');

        const message = createMessage('!reminder list');
        await handleReminderCommand(message, ['list']);

        expect(message.reply).toHaveBeenCalled();
        const callArg = message.reply.mock.calls[0][0];
        // The description may be truncated
        expect(callArg.embeds[0].description.length).toBeLessThanOrEqual(4003); // 4000 + "..."
      });

      it('should handle error during list reminders', async () => {
        reminderService.getUserReminders.mockImplementation(() => {
          throw new Error('Database error');
        });

        const message = createMessage('!reminder list');
        await handleReminderCommand(message, ['list']);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: 'Failed to List Reminders' }),
            ]),
          })
        );
      });
    });

    describe('cancel/delete subcommand', () => {
      it('should handle "delete" subcommand', async () => {
        reminderService.cancelReminder.mockResolvedValue(true);

        const message = createMessage('!reminder delete 3');
        await handleReminderCommand(message, ['delete', '3']);

        expect(reminderService.cancelReminder).toHaveBeenCalledWith(3, 'user-123');
      });

      it('should show error for non-numeric reminder ID', async () => {
        const message = createMessage('!reminder cancel abc');
        await handleReminderCommand(message, ['cancel', 'abc']);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: 'Invalid Reminder ID' }),
            ]),
          })
        );
      });

      it('should handle cancel error', async () => {
        reminderService.cancelReminder.mockRejectedValue(new Error('Cancel failed'));

        const message = createMessage('!reminder cancel 5');
        await handleReminderCommand(message, ['cancel', '5']);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: 'Failed to Cancel Reminder' }),
            ]),
          })
        );
      });
    });

    describe('help subcommand and default', () => {
      it('should show help for help subcommand', async () => {
        const message = createMessage('!reminder help');
        await handleReminderCommand(message, ['help']);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: '⏰ Reminder System Help' }),
            ]),
          })
        );
      });

      it('should show help for unknown subcommand', async () => {
        const message = createMessage('!reminder unknown');
        await handleReminderCommand(message, ['unknown']);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: '⏰ Reminder System Help' }),
            ]),
          })
        );
      });

      it('should show help when no args provided to !reminder', async () => {
        const message = createMessage('!reminder');
        await handleReminderCommand(message, []);

        expect(message.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({ title: '⏰ Reminder System Help' }),
            ]),
          })
        );
      });
    });
  });

  describe('handleSetReminder error paths', () => {
    it('should handle time parser error', async () => {
      timeParser.parseTimeExpression.mockImplementation(() => {
        throw new Error('Invalid time format');
      });

      const message = createMessage('!reminder set "invalid time" Test');
      await handleReminderCommand(message, ['set', 'invalid time', 'Test']);

      expect(message.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({ title: 'Failed to Set Reminder' }),
          ]),
        })
      );
    });

    it('should handle database error during reminder creation', async () => {
      const future = new Date(Date.now() + 60000);
      timeParser.parseTimeExpression.mockReturnValue({
        scheduledTime: future,
        timezone: 'UTC',
      });
      reminderService.createReminder.mockRejectedValue(new Error('Database error'));

      const message = createMessage('!reminder set "in 1 minute" Test');
      await handleReminderCommand(message, ['set', 'in 1 minute', 'Test']);

      expect(message.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({ title: 'Failed to Set Reminder' }),
          ]),
        })
      );
    });
  });

  describe('handleReminderCommand top-level error handling', () => {
    it('should catch and handle unexpected errors', async () => {
      const message = createMessage('!reminder list');
      // First call throws to test outer catch
      message.reply.mockRejectedValueOnce(new Error('Reply failed'));
      // Second call should succeed for error reply
      message.reply.mockResolvedValueOnce();

      reminderService.getUserReminders.mockReturnValue([]);

      await handleReminderCommand(message, ['list']);

      expect(logger.error).toHaveBeenCalledWith('Error in reminder command:', expect.any(Error));
    });
  });

  describe('handleReminderDue', () => {
    it('should log reminder due event', async () => {
      const reminder = {
        id: 42,
        user_id: 'user-123',
        message: 'Test reminder message',
      };

      await handleReminderDue(reminder);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Reminder due: 42'));
    });

    it('should handle errors during reminder due processing', async () => {
      // Make logger.info throw to test error handling
      logger.info.mockImplementationOnce(() => {
        throw new Error('Log failed');
      });

      const reminder = {
        id: 99,
        user_id: 'user-123',
        message: 'Test',
      };

      await handleReminderDue(reminder);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to handle reminder due'),
        expect.any(Error)
      );
    });
  });

  describe('DM context handling', () => {
    it('should handle reminder in DM context (no guild)', async () => {
      const future = new Date(Date.now() + 60000);
      timeParser.parseTimeExpression.mockReturnValue({
        scheduledTime: future,
        timezone: 'UTC',
      });
      timeParser.getRelativeTime.mockReturnValue('in 1 minute');
      timeParser.formatTime.mockReturnValue('12:00 UTC');
      reminderService.createReminder.mockResolvedValue({ id: '1' });

      const message = createMessage('!remind in 1 minute Test', { guild: null });
      await handleReminderCommand(message, ['in 1 minute', 'Test']);

      expect(reminderService.createReminder).toHaveBeenCalledWith(
        'user-123',
        'Test',
        expect.any(String),
        'UTC',
        'channel-123',
        undefined // guild?.id is undefined
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty args array for !remind', async () => {
      const message = createMessage('!remind');
      await handleReminderCommand(message, []);

      expect(message.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({ title: '⏰ Reminder System Help' }),
          ]),
        })
      );
    });

    it('should handle single arg for !remind', async () => {
      const message = createMessage('!remind test');
      await handleReminderCommand(message, ['test']);

      expect(message.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({ title: '⏰ Reminder System Help' }),
          ]),
        })
      );
    });

    it('should correctly call createReminder with proper parameters', async () => {
      const future = new Date(Date.now() + 3600000);
      timeParser.parseTimeExpression.mockReturnValue({
        scheduledTime: future,
        timezone: 'PST',
      });
      timeParser.getRelativeTime.mockReturnValue('in 1 hour');
      timeParser.formatTime.mockReturnValue('3:00 PM PST');
      reminderService.createReminder.mockResolvedValue({ id: '100' });

      const message = createMessage('!remind "in 1 hour" Important meeting');
      await handleReminderCommand(message, ['in 1 hour', 'Important', 'meeting']);

      expect(reminderService.createReminder).toHaveBeenCalledWith(
        'user-123',
        'Important meeting',
        expect.any(String),
        'PST',
        'channel-123',
        'guild-123'
      );
    });
  });
});
