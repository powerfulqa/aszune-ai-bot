/**
 * Tests for chat service advanced functionality
 */

// Mock the config module
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));

// Mock the commands module first
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn(),
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test' }]),
}));

const chatService = require('../../src/services/chat');
const perplexityService = require('../../src/services/perplexity-secure');
const ConversationManager = require('../../src/utils/conversation');
const emojiManager = require('../../src/utils/emoji');
const commandHandler = require('../../src/commands');

// Mock dependencies
jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
}));
jest.mock('../../src/utils/conversation');
jest.mock('../../src/utils/emoji');
jest.mock('../../src/commands');

describe('Chat Service - Advanced', () => {
  // Create a mock message
  const createMessage = (content = 'hello') => ({
    content,
    author: { bot: false, id: '123456789012345678' },
    reply: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue({}),
    channel: { sendTyping: jest.fn() },
  });

  let conversationManager;
  beforeEach(() => {
    jest.clearAllMocks();
    conversationManager = new ConversationManager();
    jest.spyOn(conversationManager, 'isRateLimited').mockReturnValue(false);
    jest
      .spyOn(conversationManager, 'getHistory')
      .mockReturnValue([{ role: 'user', content: 'hello' }]);
    jest.spyOn(conversationManager, 'addMessage').mockImplementation(() => {});
    perplexityService.generateChatResponse.mockResolvedValue('AI response');
    emojiManager.addEmojisToResponse.mockReturnValue('AI response 😊');
    commandHandler.handleTextCommand.mockResolvedValue();
  });

  it('should handle AI response generation errors', async () => {
    perplexityService.generateChatResponse.mockRejectedValue(new Error('API Error'));
    const message = createMessage('Hello');

    await chatService(message);

    expect(message.reply).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('error'));
  });

  it('should add emojis to responses when not in low CPU mode', async () => {
    const message = createMessage('Hello');

    await chatService(message);

    expect(emojiManager.addEmojisToResponse).toHaveBeenCalled();
  });

  it('should handle long responses with chunking', async () => {
    const longResponse = 'A'.repeat(3000); // Long response
    perplexityService.generateChatResponse.mockResolvedValue(longResponse);
    const message = createMessage('Hello');

    await chatService(message);

    expect(message.reply).toHaveBeenCalled();
  });

  it('should handle special characters in messages', async () => {
    const specialMessage = createMessage('Hello! @#$%^&*()_+-=[]{}|;:,.<>?');

    await chatService.handleChatMessage(specialMessage);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
  });

  it('should handle multiline messages', async () => {
    const multilineMessage = createMessage('Line 1\nLine 2\nLine 3');

    await chatService.handleChatMessage(multilineMessage);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
  });

  it('should handle messages with URLs', async () => {
    const urlMessage = createMessage('Check out https://example.com');

    await chatService.handleChatMessage(urlMessage);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
  });

  it('should handle messages with emojis', async () => {
    const emojiMessage = createMessage('Hello 👋 World 🌍');

    await chatService.handleChatMessage(emojiMessage);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
  });

  it('should handle empty conversation history', async () => {
    jest.spyOn(conversationManager, 'getHistory').mockReturnValue([]);
    const message = createMessage('Hello');

    await chatService(message);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
  });

  it('should handle conversation history with multiple messages', async () => {
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];
    jest.spyOn(conversationManager, 'getHistory').mockReturnValue(history);
    const message = createMessage('What is your name?');

    await chatService(message);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
  });

  it('should handle network timeouts gracefully', async () => {
    perplexityService.generateChatResponse.mockRejectedValue(new Error('Request timeout'));
    const message = createMessage('Hello');

    await chatService(message);

    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('timeout'));
  });

  it('should handle rate limit errors from API', async () => {
    perplexityService.generateChatResponse.mockRejectedValue(new Error('Rate limit exceeded'));
    const message = createMessage('Hello');

    await chatService(message);

    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('rate limit'));
  });
});
