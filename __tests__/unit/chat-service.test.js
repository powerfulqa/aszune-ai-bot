/**
 * Tests for chat service
 */
const chatService = require('../../src/services/chat');
const perplexityService = require('../../src/services/perplexity');
const conversationManager = require('../../src/utils/conversation');
const emojiManager = require('../../src/utils/emoji');
const commandHandler = require('../../src/commands');

// Mock dependencies
jest.mock('../../src/services/perplexity');
jest.mock('../../src/utils/conversation');
jest.mock('../../src/utils/emoji');
jest.mock('../../src/commands');

describe('Chat Service', () => {
  // Create a mock message
  const createMessage = (content = 'hello') => ({
    content,
    author: { bot: false, id: '123' },
    reply: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue({}),
    channel: { sendTyping: jest.fn() }
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks
    conversationManager.isRateLimited.mockReturnValue(false);
    conversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'hello' }]);
    perplexityService.generateChatResponse.mockResolvedValue('AI response');
    emojiManager.addEmojisToResponse.mockReturnValue('AI response 😊');
    commandHandler.handleTextCommand.mockResolvedValue();
  });
  
  it('handles a normal message and sends a reply', async () => {
    const message = createMessage('hello');
    
    await chatService(message);
    
    expect(commandHandler.handleTextCommand).not.toHaveBeenCalled();
    expect(conversationManager.addMessage).toHaveBeenCalledWith('123', 'user', 'hello');
    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        description: 'AI response 😊'
      })]
    });
    expect(emojiManager.addReactionsToMessage).toHaveBeenCalled();
  });

  it('calls command handler for messages starting with "!"', async () => {
    const message = createMessage('!help');
    
    await chatService(message);
    
    expect(commandHandler.handleTextCommand).toHaveBeenCalledWith(message);
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });
  
  it('ignores messages from bots', async () => {
    const message = createMessage();
    message.author.bot = true;
    
    await chatService(message);
    
    expect(message.reply).not.toHaveBeenCalled();
    expect(conversationManager.addMessage).not.toHaveBeenCalled();
  });
  
  it('applies rate limiting', async () => {
    const message = createMessage();
    conversationManager.isRateLimited.mockReturnValue(true);
    
    await chatService(message);
    
    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
    expect(conversationManager.addMessage).not.toHaveBeenCalled();
  });
  
  it('handles API errors gracefully', async () => {
    const message = createMessage();
    perplexityService.generateChatResponse.mockRejectedValue(new Error('API error'));
    
    await chatService(message);
    
    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('error'));
  });
  
  it('adds the bot response to conversation history', async () => {
    const message = createMessage();
    
    await chatService(message);
    
    expect(conversationManager.addMessage).toHaveBeenCalledWith('123', 'user', 'hello');
    expect(conversationManager.addMessage).toHaveBeenCalledWith('123', 'assistant', 'AI response 😊');
  });
});
