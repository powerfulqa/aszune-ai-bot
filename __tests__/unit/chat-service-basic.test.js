/**
 * Tests for chat service basic functionality
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

describe('Chat Service - Basic', () => {
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

  it('should ignore bot messages', async () => {
    const botMessage = createMessage('hello');
    botMessage.author.bot = true;

    await chatService.handleChatMessage(botMessage);

    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(botMessage.reply).not.toHaveBeenCalled();
  });

  it('should ignore empty messages', async () => {
    const emptyMessage = createMessage('');

    await chatService.handleChatMessage(emptyMessage);

    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(emptyMessage.reply).not.toHaveBeenCalled();
  });

  it('should handle regular chat messages', async () => {
    const message = createMessage('Hello, how are you?');

    await chatService.handleChatMessage(message);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalled();
  });

  it('should handle command messages', async () => {
    const commandMessage = createMessage('!help');

    await chatService.handleChatMessage(commandMessage);

    expect(commandHandler.handleTextCommand).toHaveBeenCalledWith(commandMessage);
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });

  it('should handle rate limited users', async () => {
    jest.spyOn(conversationManager, 'isRateLimited').mockReturnValue(true);
    const message = createMessage('Hello');

    await chatService.handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });
});
