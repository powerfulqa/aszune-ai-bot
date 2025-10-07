/**
 * Additional tests for src/services/chat.js - Part 1: Basic Branch Coverage
 * Focus on message validation and rate limiting branches
 */

// Mock dependencies
const mockPerplexityService = {
  generateChatResponse: jest.fn(),
};
jest.mock('../../src/services/perplexity-secure', () => mockPerplexityService);

const mockConversationManager = {
  getHistory: jest.fn(),
  addMessage: jest.fn(),
  isRateLimited: jest.fn(),
  updateUserStats: jest.fn(),
  clearHistory: jest.fn(),
  updateTimestamp: jest.fn(),
};
jest.mock('../../src/utils/conversation', () => jest.fn(() => mockConversationManager));

const mockCommandHandler = {
  handleTextCommand: jest.fn(),
  isTextCommand: jest.fn(),
};
jest.mock('../../src/commands', () => mockCommandHandler);

const mockInputValidator = {
  validateUserId: jest.fn(),
  validateAndSanitize: jest.fn(),
};
jest.mock('../../src/utils/input-validator', () => ({
  InputValidator: mockInputValidator,
}));

const mockErrorHandler = {
  handleError: jest.fn().mockReturnValue({
    message: 'Something went wrong. Please try again.',
    type: 'GENERIC_ERROR',
  }),
};
jest.mock('../../src/utils/error-handler', () => ({
  ErrorHandler: mockErrorHandler,
}));

const mockEmojiManager = {
  addEmojis: jest.fn(),
  addEmojisToResponse: jest.fn().mockImplementation((text) => text),
  addReactionsToMessage: jest.fn().mockResolvedValue(),
};
jest.mock('../../src/utils/emoji', () => mockEmojiManager);

const mockMessageFormatter = {
  createCompactEmbed: jest.fn(),
  formatMessage: jest.fn(),
  formatResponse: jest.fn().mockImplementation((text) => text),
};
jest.mock('../../src/utils/message-formatter', () => mockMessageFormatter);

const mockChunkMessage = jest.fn();
jest.mock('../../src/utils/message-chunking', () => ({
  chunkMessage: mockChunkMessage,
  formatTablesForDiscord: jest.fn().mockImplementation((text) => text),
}));

jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockConfig = {
  MESSAGE_LIMITS: {
    EMBED_MAX_LENGTH: 1900,
  },
  COLORS: {
    PRIMARY: '#5865F2',
    ERROR: '#ED4245',
  },
  PI_OPTIMIZATIONS: {
    LOW_CPU_MODE: false,
  },
};
jest.mock('../../src/config/config', () => mockConfig);
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
}));

describe('Chat Service - Message Validation Branch Coverage', () => {
  let chatService;
  let handleChatMessage;
  let mockMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    chatService = require('../../src/services/chat');
    handleChatMessage = chatService.handleChatMessage || chatService.default || chatService;

    mockMessage = {
      author: {
        id: '123456789012345678',
        bot: false,
      },
      content: 'Hello bot!',
      reply: jest.fn().mockResolvedValue(),
      channel: {
        sendTyping: jest.fn().mockResolvedValue(),
        send: jest.fn().mockResolvedValue(),
      },
    };

    // Setup defaults
    mockConversationManager.isRateLimited.mockReturnValue(false);
    mockConversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'hello' }]);
    mockConversationManager.addMessage.mockImplementation(() => {});
    mockConversationManager.updateTimestamp.mockImplementation(() => {});
    mockCommandHandler.handleTextCommand.mockResolvedValue();
    mockCommandHandler.isTextCommand.mockReturnValue(false);
    mockChunkMessage.mockReturnValue(['Response']);
    mockMessageFormatter.createCompactEmbed.mockReturnValue({
      color: '#5865F2',
      description: 'Response',
      footer: { text: 'Aszai Bot' },
    });

    // Set up input validation defaults
    mockInputValidator.validateUserId.mockReturnValue({ valid: true });
    mockInputValidator.validateAndSanitize.mockReturnValue({
      valid: true,
      sanitized: 'Hello bot!',
      warnings: [],
    });
    mockPerplexityService.generateChatResponse.mockResolvedValue('Mock response');
  });

  describe('Bot Message Filtering', () => {
    it('should ignore messages from bots', async () => {
      mockMessage.author.bot = true;

      await handleChatMessage(mockMessage);

      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
      expect(mockMessage.reply).not.toHaveBeenCalled();
    });

    it('should process messages from real users', async () => {
      mockMessage.author.bot = false;
      mockMessage.content = 'Hello bot!';
      mockPerplexityService.generateChatResponse.mockResolvedValue('AI response');

      // Ensure all validation passes
      mockConversationManager.isRateLimited.mockReturnValue(false);
      mockCommandHandler.handleTextCommand.mockResolvedValue();
      mockInputValidator.validateUserId.mockReturnValue({ valid: true });
      mockInputValidator.validateAndSanitize.mockReturnValue({
        valid: true,
        sanitized: 'Hello bot!',
        warnings: [],
      });

      await handleChatMessage(mockMessage);

      expect(mockPerplexityService.generateChatResponse).toHaveBeenCalled();
    });
  });

  describe('Empty Message Filtering', () => {
    it('should ignore empty string messages', async () => {
      mockMessage.content = '';

      await chatService(mockMessage);

      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should ignore whitespace-only messages', async () => {
      mockMessage.content = '   \n  \t  ';

      // Mock validation to return invalid for whitespace-only content
      mockInputValidator.validateAndSanitize.mockReturnValue({
        valid: false,
        error: 'Message contains only whitespace',
        sanitized: '',
        warnings: [],
      });

      await chatService(mockMessage);

      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Message contains only whitespace');
    });

    it('should ignore null content', async () => {
      mockMessage.content = null;

      await chatService(mockMessage);

      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should ignore undefined content', async () => {
      mockMessage.content = undefined;

      await chatService(mockMessage);

      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should process valid non-empty messages', async () => {
      mockMessage.content = 'Valid message';
      mockMessage.author.bot = false;
      mockPerplexityService.generateChatResponse.mockResolvedValue('AI response');

      // Ensure all validation passes
      mockConversationManager.isRateLimited.mockReturnValue(false);
      mockCommandHandler.handleTextCommand.mockResolvedValue();
      mockInputValidator.validateUserId.mockReturnValue({ valid: true });
      mockInputValidator.validateAndSanitize.mockReturnValue({
        valid: true,
        sanitized: 'Valid message',
        warnings: [],
      });

      await handleChatMessage(mockMessage);

      expect(mockPerplexityService.generateChatResponse).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting Branch Coverage', () => {
    it('should show rate limit message when user is rate limited', async () => {
      mockConversationManager.isRateLimited.mockReturnValue(true);

      await chatService(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        'Please wait a few seconds before sending another message.'
      );
      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should proceed normally when user is not rate limited', async () => {
      mockMessage.content = 'Hello bot!';
      mockMessage.author.bot = false;
      mockConversationManager.isRateLimited.mockReturnValue(false);
      mockPerplexityService.generateChatResponse.mockResolvedValue('AI response');

      // Ensure all validation passes
      mockCommandHandler.handleTextCommand.mockResolvedValue();
      mockInputValidator.validateUserId.mockReturnValue({ valid: true });
      mockInputValidator.validateAndSanitize.mockReturnValue({
        valid: true,
        sanitized: 'Hello bot!',
        warnings: [],
      });

      await handleChatMessage(mockMessage);

      expect(mockPerplexityService.generateChatResponse).toHaveBeenCalled();
      expect(mockMessage.reply).toHaveBeenCalled();
    });
  });
});
