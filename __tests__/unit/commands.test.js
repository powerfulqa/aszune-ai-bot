jest.useFakeTimers();

// We want to test the real commands module, not the mock
// jest.mock('../../src/commands', () => require('../../__mocks__/commands'));
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/conversation');
jest.mock('../../src/services/perplexity');

const { handleTextCommand, handleSlashCommand, getSlashCommandsData } = require('../../src/commands');
const conversationManager = require('../../src/utils/conversation');
const perplexityService = require('../../src/services/perplexity');
const { createMockMessage, createMockInteraction, resetMocks } = require('../../src/utils/testUtils');
const logger = require('../../src/utils/logger');

describe('Command Handlers', () => {
  beforeEach(() => {
    logger.handleError.mockReturnValue('There was an error executing this command.');
  });

  afterEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('getSlashCommandsData', () => {
    it('should return an array of slash command data', () => {
      const slashCommandsData = getSlashCommandsData();
      expect(Array.isArray(slashCommandsData)).toBe(true);
      expect(slashCommandsData.length).toBeGreaterThan(0);
      expect(slashCommandsData[0]).toHaveProperty('name');
      expect(slashCommandsData[0]).toHaveProperty('description');
    });
  });

  describe('handleTextCommand', () => {
    it('should handle !help command', async () => {
      const message = createMockMessage({ content: '!help' });
      await handleTextCommand(message);
      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Aszai Bot Commands'));
    });

    it('should handle !clearhistory command', async () => {
      const message = createMockMessage({ content: '!clearhistory' });
      await handleTextCommand(message);
      expect(conversationManager.clearHistory).toHaveBeenCalledWith(message.author.id);
      expect(message.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
    });

    it('should handle !summary command with history', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'user', content: 'Hello' }
      ]);
      perplexityService.generateSummary.mockResolvedValue('This is a summary.');
      await handleTextCommand(message);
      expect(message.channel.sendTyping).toHaveBeenCalled();
      expect(message.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: 'Conversation Summary',
            description: 'This is a summary.'
          })
        ]
      });
    });

    it('should handle !summary command with no history', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([]);
      await handleTextCommand(message);
      expect(message.reply).toHaveBeenCalledWith('No conversation history to summarise.');
    });

    it('should handle !summary command with only assistant messages in history', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'assistant', content: 'I am a bot.' }
      ]);
      await handleTextCommand(message);
      expect(message.reply).toHaveBeenCalledWith('No conversation history to summarise.');
    });

    it('should handle errors during text command execution', async () => {
      const message = createMockMessage({ content: '!help' });
      message.reply.mockRejectedValueOnce(new Error('Test Error'));
      await handleTextCommand(message);
      expect(message.reply).toHaveBeenCalledWith('There was an error executing this command.');
    });

    it('should handle !summary command API error', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'user', content: 'Hello' }
      ]);
      perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));
      await handleTextCommand(message);
      expect(message.reply).toHaveBeenCalledWith('There was an error executing this command.');
    });

    it('should handle !stats command', async () => {
      const message = createMockMessage({ content: '!stats' });
      conversationManager.getUserStats.mockReturnValue({ messages: 10, summaries: 2 });
      await handleTextCommand(message);
      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Your Aszai Bot Stats'));
    });

    it('should return null for unknown command', async () => {
      const message = createMockMessage({ content: '!unknown' });
      const result = await handleTextCommand(message);
      expect(result).toBeNull();
    });
  });

  describe('handleSlashCommand', () => {
    it('should handle /help command', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Aszai Bot Commands'));
    });

    it('should handle /clearhistory command', async () => {
      const interaction = createMockInteraction({ commandName: 'clearhistory' });
      await handleSlashCommand(interaction);
      expect(conversationManager.clearHistory).toHaveBeenCalledWith(interaction.user.id);
      expect(interaction.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
    });

    it('should handle /summary command with history', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'user', content: 'Hello' }
      ]);
      perplexityService.generateSummary.mockResolvedValue('This is a summary.');
      await handleSlashCommand(interaction);
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: 'Conversation Summary',
            description: 'This is a summary.'
          })
        ]
      });
    });

    it('should handle /summary command API error', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'user', content: 'Hello' }
      ]);
      perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));
      await handleSlashCommand(interaction);
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith('There was an error executing this command.');
    });

    it('should handle /summary command with only assistant messages in history', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'assistant', content: 'I am a bot.' }
      ]);
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith('No conversation history to summarise.');
    });

    it('should handle /summary command with no history', async () => {
      const interaction = createMockInteraction({ commandName: 'summary' });
      conversationManager.getHistory.mockReturnValue([]);
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith('No conversation history to summarise.');
    });

    it('should handle /stats command', async () => {
      const interaction = createMockInteraction({ commandName: 'stats' });
      conversationManager.getUserStats.mockReturnValue({ messages: 10, summaries: 2 });
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Your Aszai Bot Stats'));
    });

    it('should handle command execution error when not deferred', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      const error = new Error('Test Error');
      // This is a bit tricky. We need the command to fail, not the reply itself.
      // Let's mock the command's execute function to throw an error.
      // Since we can't easily mock just one command, we'll make the reply throw.
      // But we will set replied and deferred to false.
      interaction.reply.mockImplementationOnce(() => {
        throw error;
      });
      interaction.deferred = false;
      interaction.replied = false;

      await handleSlashCommand(interaction);

      // The code will try to call reply, which will throw, then it will try to call reply again in the catch block.
      expect(interaction.reply).toHaveBeenLastCalledWith({
        content: 'There was an error executing this command.',
        ephemeral: true
      });
    });

    it('should handle unknown command', async () => {
      const interaction = createMockInteraction({ commandName: 'unknown' });
      await handleSlashCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Unknown command',
        ephemeral: true
      });
    });

    it('should handle command execution error', async () => {
      const interaction = createMockInteraction({ commandName: 'help' });
      interaction.deferred = true; // Set deferred to true to test the editReply path
      const error = new Error('Test Error');
      interaction.reply.mockRejectedValue(error);

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: 'There was an error executing this command.',
        ephemeral: true
      });
    });
  });
});
