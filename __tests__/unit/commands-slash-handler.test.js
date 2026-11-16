/**
 * Commands - Slash Command Handler Tests
 * Tests slash command handling functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/perplexity-secure');

// Mock database service
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
  clearUserData: jest.fn(),
  clearUserConversationData: jest.fn(),
  trackCommandUsage: jest.fn(),
  logError: jest.fn(),
}));

// Mock the conversation module
jest.mock('../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
    isRateLimited: jest.fn().mockReturnValue(false),
    updateTimestamp: jest.fn(),
  };

  return jest.fn().mockImplementation(() => mockInstance);
});

const { handleSlashCommand } = require('../../src/commands');
const ConversationManager = require('../../src/utils/conversation');
const perplexityService = require('../../src/services/perplexity-secure');
const { createMockInteraction, resetMocks } = require('../utils/testUtils');

const HELP_TEXT = [
  '**Aszai Bot Commands:**',
  '`/help` - Show this help message',
  '`/clearhistory` - Clear your conversation history (keeps your stats)',
  '`/summary` - Summarise your current conversation',
  '`/summarise <text>` - Summarise provided text',
  '`/stats` - Show your usage stats',
  '`/analytics` - Show Discord server analytics',
  '`/dashboard` - Show performance dashboard',
  '`/resources` - Show resource optimization status',
  '`/cache` - Show cache statistics',
  '`/remind <time> <message>` - Set a reminder',
  '`/reminders` - List your active reminders',
  '`/cancelreminder <id>` - Cancel a specific reminder',
  '`/userinfo [user]` - Show detailed user information',
  '`/serverinfo` - Show detailed server information',
  '`/diag [live]` - Bot diagnostics (owner only, private)',
  'Simply chat as normal to talk to the bot!',
].join('\n');

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

      expect(interaction.reply).toHaveBeenCalledWith(HELP_TEXT);
    });

    it('should handle /clearhistory command', async () => {
      const interaction = createMockInteraction({ commandName: 'clearhistory' });
      await handleSlashCommand(interaction);

      expect(conversationManager.clearHistory).toHaveBeenCalledWith(interaction.user.id);
      expect(interaction.reply).toHaveBeenCalledWith(
        'Conversation history cleared! Your stats have been preserved.'
      );
    });

    it('should handle /summary command', async () => {
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

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 15548997,
            description: 'The service is temporarily unavailable. Please try again later.',
          },
        ],
      });
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

      expect(conversationManager.getUserStats).toHaveBeenCalledWith(interaction.user.id);
      expect(interaction.reply).toHaveBeenCalledWith(
        '**Your Aszai Bot Stats:**\nMessages sent: 10\nSummaries requested: 2\nActive reminders: 0'
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

    it('should rate limit /summarise like chat and not call Perplexity', async () => {
      conversationManager.isRateLimited.mockReturnValueOnce(true);
      const interaction = createMockInteraction({
        commandName: 'summarise',
        options: {
          getString: jest.fn().mockReturnValue('Hello world'),
        },
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Please wait a few seconds before sending another request.',
        ephemeral: true,
      });
      expect(perplexityService.generateSummary).not.toHaveBeenCalled();
      expect(conversationManager.updateTimestamp).not.toHaveBeenCalled();
    });

    it('should record the rate-limit timestamp for an allowed /summary', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });

      await handleSlashCommand(interaction);

      expect(conversationManager.isRateLimited).toHaveBeenCalledWith(interaction.user.id);
      expect(conversationManager.updateTimestamp).toHaveBeenCalledWith(interaction.user.id);
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

      expect(interaction.reply).toHaveBeenCalledWith(
        '❌ Invalid text input: Content contains unsafe elements that were removed.'
      );
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

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 15548997,
            description: 'The service is temporarily unavailable. Please try again later.',
          },
        ],
      });
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

      expect(interaction.reply).toHaveBeenCalledWith(HELP_TEXT);
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
  });
});
