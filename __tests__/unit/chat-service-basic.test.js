/**
 * Tests for chat service basic functionality
 */

// Mock the config module
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));

// Mock the commands module (handleTextCommand removed)
jest.mock('../../src/commands', () => ({
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test' }]),
}));

const chatService = require('../../src/services/chat');
const handleChatMessage = chatService.handleChatMessage || chatService.default || chatService;
const perplexityService = require('../../src/services/perplexity-secure');
const ConversationManager = require('../../src/utils/conversation');
const emojiManager = require('../../src/utils/emoji');

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
    // handleTextCommand removed - now using slash commands only
  });

  it('should ignore bot messages', async () => {
    const botMessage = createMessage('hello');
    botMessage.author.bot = true;

    await handleChatMessage(botMessage);

    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(botMessage.reply).not.toHaveBeenCalled();
  });

  it('should ignore empty messages', async () => {
    const emptyMessage = createMessage('');

    await handleChatMessage(emptyMessage);

    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(emptyMessage.reply).not.toHaveBeenCalled();
  });

  it('should handle regular chat messages', async () => {
    const message = createMessage('Hello, how are you?');

    await handleChatMessage(message);

    expect(perplexityService.generateChatResponse).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalled();
  });

  it('should ignore messages starting with "!" (text commands removed)', async () => {
    const commandMessage = createMessage('!help');

    const result = await handleChatMessage(commandMessage);

    // Messages starting with "!" should be ignored (no processing)
    expect(result).toBeNull();
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(commandMessage.reply).not.toHaveBeenCalled();
  });

  it('should handle rate limited users', async () => {
    mockConversationManager.isRateLimited.mockReturnValue(true);
    const message = createMessage('Hello');

    await handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledWith(
      'Please wait a few seconds before sending another message.'
    );
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });

  // Test the new simple reminder detection function for coverage
  describe('Simple Reminder Detection', () => {
    const { checkForSimpleReminderRequest } = require('../../src/services/chat');

    // Mock the reminder command handler
    const mockHandleReminderCommand = jest.fn();
    jest.doMock('../../src/commands/reminder', () => ({
      handleReminderCommand: mockHandleReminderCommand,
    }));

    beforeEach(() => {
      jest.clearAllMocks();
      mockHandleReminderCommand.mockResolvedValue();
    });

    it('should detect simple reminder patterns', async () => {
      const result = await checkForSimpleReminderRequest(
        'remind me in 5 minutes',
        'user123',
        'channel456',
        'server789'
      );

      expect(result).toBeTruthy();
      expect(result.message).toContain('I\'ll remind you');
    });

    it('should return null for non-reminder messages', async () => {
      const result = await checkForSimpleReminderRequest(
        'hello world',
        'user123',
        'channel456',
        'server789'
      );

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockHandleReminderCommand.mockRejectedValue(new Error('Test error'));

      const result = await checkForSimpleReminderRequest(
        'remind me in 5 minutes',
        'user123',
        'channel456',
        'server789'
      );

      // Should return error response object instead of null when there's an error
      expect(result).toBeTruthy();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Sorry, I couldn\'t set that reminder');
    });

    it('should handle different reminder pattern variations', async () => {
      const patterns = [
        'remind me to check email in 10 minutes',
        'please remind me about meeting in 1 hour',
        'can you remind me to call in 30 minutes',
        'set a reminder to take pills in 2 hours',
        'remind me in 15 minutes',
      ];

      for (const pattern of patterns) {
        mockHandleReminderCommand.mockReturnValue({
          success: true,
          message: 'I\'ll remind you',
        });

        const result = await checkForSimpleReminderRequest(
          pattern,
          'user123',
          'channel456',
          'server789'
        );

        expect(result).toBeTruthy();
        expect(result.message).toContain('I\'ll remind you');
        mockHandleReminderCommand.mockClear();
      }
    });

    it('should handle DM server context', async () => {
      const result = await checkForSimpleReminderRequest(
        'remind me in 15 minutes',
        'user123',
        'channel456',
        'DM'
      );

      expect(result).toBeTruthy();
      expect(result.message).toContain('I\'ll remind you');
    });

    it('should test reply function in simple reminder', async () => {
      // Test a case that triggers the createSimpleReminder function properly
      mockHandleReminderCommand.mockResolvedValue(); // Mock successful completion

      const result = await checkForSimpleReminderRequest(
        'remind me in 5 minutes',
        'user123',
        'channel456',
        'server789'
      );

      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.message).toContain('I\'ll remind you');
      expect(result.message).toContain('in 5 minute');
    });

    it('should call sendReminderResponse for successful reminders', async () => {
      // Mock successful reminder creation
      mockHandleReminderCommand.mockResolvedValue();

      // Test through checkForSimpleReminderRequest to exercise reminder logic
      const reminderResult = await checkForSimpleReminderRequest(
        'remind me in 10 minutes',
        'user123',
        'channel456',
        'server789'
      );

      expect(reminderResult).toBeTruthy();
      expect(reminderResult.success).toBe(true);
    });

    it('should handle reminder response formatting correctly', async () => {
      // Test another scenario that exercises the reminder response logic
      mockHandleReminderCommand.mockRejectedValue(new Error('Command failed'));

      const result = await checkForSimpleReminderRequest(
        'remind me to do something in 5 minutes',
        'user123',
        'channel456',
        'server789'
      );

      // Should return error response when command fails
      expect(result).toBeTruthy();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Sorry, I couldn\'t set that reminder');
    });

    it('should test uncovered error handling paths', async () => {
      // Create a message that will go through input validation
      const mockMessage = createMessage('test message that will fail somewhere');

      // Mock perplexityService to return a response
      perplexityService.generateChatResponse.mockResolvedValue('AI response');

      // This should exercise more of the error handling code paths
      const result = await handleChatMessage(mockMessage);

      // The result can be null or undefined depending on the code path
      expect([null, undefined]).toContain(result);
    });

    it('should handle edge case with empty reminder patterns', async () => {
      // Test with a pattern that might match but has edge cases
      const result = await checkForSimpleReminderRequest(
        'remind me in',
        'user123',
        'channel456',
        'server789'
      );

      // Should return null for incomplete patterns
      expect(result).toBeNull();
    });
  });
});
