const { request } = require('undici');
const handleChatMessage = require('../../src/services/chat');
const { handleTextCommand } = require('../../src/commands');
const conversationManager = require('../../src/utils/conversation');
const logger = require('../../src/utils/logger');

jest.mock('undici', () => ({
  request: jest.fn(),
}));
jest.mock('../../src/utils/conversation');
jest.mock('../../src/utils/logger');

describe('Error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the logger to return a simple error message
    logger.handleError.mockImplementation((error, context) => {
      return `An error occurred during ${context}.`;
    });
  });

  it('handles failed Perplexity API response during chat', async () => {
    // Arrange
    request.mockRejectedValueOnce(new Error('API Error'));
    conversationManager.isRateLimited.mockReturnValue(false);
    conversationManager.getHistory.mockReturnValue([]);

    const fakeMessage = {
      content: 'test',
      author: { bot: false, id: '123' },
      reply: jest.fn(),
      channel: { sendTyping: jest.fn() }
    };

    // Act
    await handleChatMessage(fakeMessage);

    // Assert
    expect(fakeMessage.channel.sendTyping).toHaveBeenCalled();
    expect(fakeMessage.reply).toHaveBeenCalledWith('An error occurred during chat generation.');
  });

  it('handles failed summary API response', async () => {
    // Arrange
    request.mockRejectedValueOnce(new Error('Summary API Error'));
    conversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'hello' }]);

    const fakeMessage = {
      content: '!summary',
      author: { bot: false, id: '123' },
      reply: jest.fn(),
      channel: { sendTyping: jest.fn() }
    };

    // Act
    await handleTextCommand(fakeMessage);

    // Assert
    expect(fakeMessage.channel.sendTyping).toHaveBeenCalled();
    expect(fakeMessage.reply).toHaveBeenCalledWith('An error occurred during summary generation.');
  });
});
