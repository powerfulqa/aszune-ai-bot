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

// Mock ConversationManager
jest.mock('../../src/utils/conversation', () => {
  const mockConversationManager = {
    isRateLimited: jest.fn().mockReturnValue(false),
    getHistory: jest.fn().mockReturnValue([{ role: 'user', content: 'hello' }]),
    addMessage: jest.fn(),
    updateTimestamp: jest.fn(),
  };
  return jest.fn().mockImplementation(() => mockConversationManager);
});

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

  let mockConversationManager;
  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock instance
    mockConversationManager = new ConversationManager();
    // Reset mock return values
    mockConversationManager.isRateLimited.mockReturnValue(false);
    mockConversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'hello' }]);
    mockConversationManager.addMessage.mockImplementation(() => {});
    mockConversationManager.updateTimestamp.mockImplementation(() => {});
    
    perplexityService.generateChatResponse.mockResolvedValue('AI response');
    emojiManager.addEmojisToResponse.mockReturnValue('AI response 😊');
    commandHandler.handleTextCommand.mockResolvedValue();
  });

  it('should ignore bot messages', async () => {
    const botMessage = createMessage('hello');
    botMessage.author.bot = true;

    await chatService(botMessage);

    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(botMessage.reply).not.toHaveBeenCalled();
  });

  it('should ignore empty messages', async () => {
    const emptyMessage = createMessage('');

    await chatService(emptyMessage);

    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(emptyMessage.reply).not.toHaveBeenCalled();
  });

  it('should handle regular chat messages', async () => {
    const message = createMessage('Hello, how are you?');

    await chatService(message);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalled();
  });

  it('should handle command messages', async () => {
    const commandMessage = createMessage('!help');

    await chatService(commandMessage);

    expect(commandHandler.handleTextCommand).toHaveBeenCalledWith(commandMessage);
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });

  it('should handle rate limited users', async () => {
    mockConversationManager.isRateLimited.mockReturnValue(true);
    const message = createMessage('Hello');

    await chatService(message);

    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });
});
