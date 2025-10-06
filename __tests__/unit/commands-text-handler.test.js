/**
 * Commands - Text Command Handler Tests
 * Tests text command handling functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/perplexity-secure');

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

const { handleTextCommand } = require('../../src/commands');
const ConversationManager = require('../../src/utils/conversation');
const perplexityService = require('../../src/services/perplexity-secure');
const { createMockMessage, resetMocks } = require('../../src/utils/testUtils');

describe('Commands - Text Command Handler', () => {
  let conversationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    conversationManager = new ConversationManager();
  });

  afterEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('handleTextCommand', () => {
    it('should handle !help command', async () => {
      const message = createMockMessage({ content: '!help' });
      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Commands'));
      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Aszai Bot'));
    });

    it('should handle !clearhistory command', async () => {
      const message = createMockMessage({ content: '!clearhistory' });
      await handleTextCommand(message);

      expect(conversationManager.clearHistory).toHaveBeenCalledWith(message.author.id);
      expect(message.reply).toHaveBeenCalledWith(
        'Conversation history cleared! Your stats have been preserved.'
      );
    });

    it('should handle !summary command with history', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);

      await handleTextCommand(message);

      expect(perplexityService.generateSummary).toHaveBeenCalled();
      expect(message.reply).toHaveBeenCalled();
    });

    it('should handle !summary command with no history', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([]);

      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith('No conversation history to summarize.');
    });

    it('should handle !summary command with only assistant messages in history', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([{ role: 'assistant', content: 'Hello!' }]);

      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith('No conversation history to summarize.');
    });

    it('should handle errors during text command execution', async () => {
      const message = createMockMessage({ content: '!help' });
      message.reply.mockRejectedValue(new Error('Reply failed'));

      // Should not throw, error should be handled gracefully
      await expect(handleTextCommand(message)).resolves.not.toThrow();
    });

    it('should handle !summary command API error', async () => {
      const message = createMockMessage({ content: '!summary' });
      conversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'Hello' }]);
      perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));

      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('service is temporarily unavailable')
      );
    });

    it('should handle !stats command', async () => {
      const message = createMockMessage({ content: '!stats' });
      await handleTextCommand(message);

      expect(conversationManager.getUserStats).toHaveBeenCalledWith(message.author.id);
      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Messages sent'));
    });

    it('should handle !summarise command with text', async () => {
      const message = createMockMessage({ content: '!summarise Hello world' });
      await handleTextCommand(message);

      expect(perplexityService.generateSummary).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello world' }],
        true
      );
      expect(message.reply).toHaveBeenCalled();
    });

    it('should handle !summerise command with text (alternative spelling)', async () => {
      const message = createMockMessage({ content: '!summerise Hello world' });
      await handleTextCommand(message);

      expect(perplexityService.generateSummary).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello world' }],
        true
      );
      expect(message.reply).toHaveBeenCalled();
    });

    it('should handle !summarise command without text', async () => {
      const message = createMockMessage({ content: '!summarise' });
      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith('Please provide text to summarize.');
    });

    it('should handle !summarise command with empty text', async () => {
      const message = createMockMessage({ content: '!summarise   ' });
      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith('Please provide text to summarize.');
    });

    it('should handle !summarise command with invalid text', async () => {
      const message = createMockMessage({ content: '!summarise <script>alert("xss")</script>' });
      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid text input'));
    });

    it('should handle !summarise command API error', async () => {
      const message = createMockMessage({ content: '!summarise Hello world' });
      perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));

      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('service is temporarily unavailable')
      );
    });

    it('should handle text command with invalid user ID', async () => {
      const message = createMockMessage({ content: '!help', userId: 'invalid-id' });
      await handleTextCommand(message);

      expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Commands'));
    });

    it('should handle text command parsing for summarise', async () => {
      const message = createMockMessage({ content: '!summarise This is a test' });
      await handleTextCommand(message);

      expect(perplexityService.generateSummary).toHaveBeenCalledWith(
        [{ role: 'user', content: 'This is a test' }],
        true
      );
    });

    it('should handle text command parsing for summerise (alternative spelling)', async () => {
      const message = createMockMessage({ content: '!summerise This is a test' });
      await handleTextCommand(message);

      expect(perplexityService.generateSummary).toHaveBeenCalledWith(
        [{ role: 'user', content: 'This is a test' }],
        true
      );
    });

    it('should return null for unknown command', async () => {
      const message = createMockMessage({ content: '!unknown' });
      const result = await handleTextCommand(message);

      expect(result).toBeNull();
    });
  });
});
