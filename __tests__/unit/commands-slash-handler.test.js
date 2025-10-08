/**
 * Commands - Slash Command Handler Tests
 * Tests core slash command handling functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/perplexity-secure');

// Create a mock database service instance
const mockDatabaseService = {
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
  clearUserData: jest.fn(),
  clearUserConversationData: jest.fn(),
  trackCommandUsage: jest.fn(),
  logError: jest.fn(),
  getUserStats: jest.fn().mockReturnValue({
    message_count: 10,
    total_summaries: 2,
  }),
  getUserReminderCount: jest.fn().mockReturnValue(3),
};

jest.mock('../../src/services/database', () => mockDatabaseService);

// Mock the conversation module
jest.mock('../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
  };

  return jest.fn().mockImplementation(() => mockInstance);
});

const { handleSlashCommand } = require('../../src/commands');
const ConversationManager = require('../../src/utils/conversation');
const perplexityService = require('../../src/services/perplexity-secure');
const { createMockInteraction, resetMocks } = require('../../src/utils/testUtils');

describe('Commands - Slash Command Handler', () => {
  let conversationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    conversationManager = new ConversationManager();
  });

  afterEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('handleSlashCommand', () => {
    it('should handle /help command', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Commands'));
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Aszai Bot'));
    });

    it('should handle /clearhistory command', async () => {
      const interaction = createMockInteraction({ commandName: 'clearhistory' });
      await handleSlashCommand(interaction);

      expect(conversationManager.clearHistory).toHaveBeenCalledWith(interaction.user.id);
      expect(interaction.reply).toHaveBeenCalledWith(
        'Conversation history cleared! Your stats have been preserved.'
      );
    });

    it('should handle /summary command with history', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);

      await handleSlashCommand(interaction);

      expect(perplexityService.generateSummary).toHaveBeenCalled();
      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should handle /summary command API error', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'Hello' }]);
      perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('service is temporarily unavailable')
      );
    });

    it('should handle /summary command with only assistant messages in history', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([{ role: 'assistant', content: 'Hello!' }]);

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith('No conversation history to summarize.');
    });

    it('should handle /summary command with no history', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([]);

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith('No conversation history to summarize.');
    });

    it('should handle /stats command', async () => {
      const interaction = createMockInteraction({ commandName: 'stats' });

      await handleSlashCommand(interaction);

      expect(mockDatabaseService.getUserStats).toHaveBeenCalledWith(interaction.user.id);
      expect(mockDatabaseService.getUserReminderCount).toHaveBeenCalledWith(interaction.user.id);
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Messages sent: 10'));
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining('Summaries requested: 2')
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining('Active reminders: 3')
      );
    });

    it('should handle /summarise command with text', async () => {
      const interaction = createMockInteraction({
        commandName: 'summarise',
        options: {
          getString: jest.fn().mockReturnValue('Hello world'),
        },
      });

      await handleSlashCommand(interaction);

      expect(perplexityService.generateSummary).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello world' }],
        true
      );
      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should handle /summarise command without text', async () => {
      const interaction = createMockInteraction({
        commandName: 'summarise',
        options: {
          getString: jest.fn().mockReturnValue(null),
        },
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith('Please provide text to summarize.');
    });

    it('should handle /summarise command with empty text', async () => {
      const interaction = createMockInteraction({
        commandName: 'summarise',
        options: {
          getString: jest.fn().mockReturnValue('   '),
        },
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith('Please provide text to summarize.');
    });

    it('should handle /summarise command with invalid text', async () => {
      const interaction = createMockInteraction({
        commandName: 'summarise',
        options: {
          getString: jest.fn().mockReturnValue('<script>alert("xss")</script>'),
        },
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid text input'));
    });

    it('should handle /summarise command API error', async () => {
      const interaction = createMockInteraction({
        commandName: 'summarise',
        options: {
          getString: jest.fn().mockReturnValue('Hello world'),
        },
      });
      perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('service is temporarily unavailable')
      );
    });

    it('should handle command execution error when not deferred', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      interaction.reply.mockRejectedValue(new Error('Reply failed'));

      // Should not throw, error should be handled gracefully
      await expect(handleSlashCommand(interaction)).resolves.not.toThrow();
    });

    it('should handle unknown command', async () => {
      const interaction = createMockInteraction({ commandName: 'unknown' });
      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Unknown command',
        ephemeral: true,
      });
    });

    it('should handle command execution error', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      interaction.reply.mockRejectedValue(new Error('Reply failed'));

      // Should not throw, error should be handled gracefully
      await expect(handleSlashCommand(interaction)).resolves.not.toThrow();
    });

    it('should handle slash command with invalid user ID', async () => {
      const interaction = createMockInteraction({
        commandName: 'help',
        userId: 'invalid-id',
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Commands'));
    });

    it('should handle slash command when already replied', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      interaction.replied = true;

      await handleSlashCommand(interaction);

      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should handle slash command when already deferred and replied', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      interaction.deferred = true;
      interaction.replied = true;

      await handleSlashCommand(interaction);

      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should handle remind command execution', async () => {
      const interaction = createMockInteraction({ commandName: 'remind' });
      interaction.options = {
        getString: jest
          .fn()
          .mockReturnValueOnce('in 5 minutes') // time
          .mockReturnValueOnce('Test reminder'), // message
      };

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should handle reminders command execution', async () => {
      const interaction = createMockInteraction({ commandName: 'reminders' });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should handle cancelreminder command execution', async () => {
      const interaction = createMockInteraction({ commandName: 'cancelreminder' });
      interaction.options = {
        getInteger: jest.fn().mockReturnValue(1), // reminder ID
      };

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
