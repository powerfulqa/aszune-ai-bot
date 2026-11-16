/**
 * Additional tests for src/services/chat.js - Part 2: Error Handling Branch Coverage
 * Focus on error handling and Pi optimization branches
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
  updateTimestamp: jest.fn(),
};
jest.mock('../../src/utils/conversation', () => jest.fn(() => mockConversationManager));

const mockEmojiManager = {
  addEmojis: jest.fn(),
  addEmojisToResponse: jest.fn().mockReturnValue('enhanced response'),
  addReactionsToMessage: jest.fn(),
};
jest.mock('../../src/utils/emoji', () => mockEmojiManager);

const mockErrorHandler = {
  handleError: jest.fn(),
};
jest.mock('../../src/utils/error-handler', () => ({
  ErrorHandler: mockErrorHandler,
}));

const mockInputValidator = {
  validateUserId: jest.fn(),
  validateAndSanitize: jest.fn(),
};
jest.mock('../../src/utils/input-validator', () => ({
  InputValidator: mockInputValidator,
}));

const mockMessageFormatter = {
  createCompactEmbed: jest.fn().mockReturnValue({ description: 'Error embed' }),
  formatResponse: jest.fn().mockImplementation((text) => text),
};
jest.mock('../../src/utils/message-formatter', () => mockMessageFormatter);

const mockChunkMessage = jest.fn();
jest.mock('../../src/utils/message-chunking', () => ({
  chunkMessage: mockChunkMessage,
}));

const mockCommandHandler = {
  handleTextCommand: jest.fn(),
};
jest.mock('../../src/commands', () => mockCommandHandler);

const mockConfig = {
  COLORS: {
    ERROR: '#ED4245',
    PRIMARY: '#5865F2',
  },
  PI_OPTIMIZATIONS: {
    LOW_CPU_MODE: false,
    ENABLED: true,
    EMBEDDED_REACTION_LIMIT: 3,
  },
  MESSAGE_LIMITS: {
    EMBED_MAX_LENGTH: 1900,
  },
};
jest.mock('../../src/config/config', () => mockConfig);

describe('Chat Service - Error Handling Branch Coverage', () => {
  let chatService;
  let mockMessage;

  // What handleChatError must do with a failure: classify it once with the
  // original error, build the embed from the classified message and reply.
  // `user` is null when the failure happens before the message was processed.
  function expectErrorReported(error, userMessage, user = 'user123') {
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    expect(mockErrorHandler.handleError.mock.calls[0][0]).toBe(error);
    expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'chat generation', {
      userId: user || 'unknown',
      messageLength: 'test message'.length,
      sanitizedContent: user ? 'test message'.length : 0,
    });
    expect(mockMessageFormatter.createCompactEmbed).toHaveBeenCalledWith({
      color: '#5865F2',
      description: userMessage,
      footer: { text: 'Aszai Bot' },
    });
    expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    expect(mockMessage.reply).toHaveBeenCalledWith({ embeds: [{ description: 'Error embed' }] });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock behaviors
    mockInputValidator.validateUserId.mockReturnValue({ valid: true });
    mockInputValidator.validateAndSanitize.mockReturnValue({
      valid: true,
      sanitized: 'test message',
      warnings: [],
    });
    mockConversationManager.isRateLimited.mockReturnValue(false);
    mockConversationManager.getHistory.mockReturnValue([]);
    mockChunkMessage.mockResolvedValue(['Response chunk']);
    mockErrorHandler.handleError.mockReturnValue({
      type: 'ERROR',
      message: 'An error occurred',
    });

    chatService = require('../../src/services/chat');

    // Mock Discord message
    mockMessage = {
      author: {
        id: 'user123',
        bot: false,
      },
      content: 'test message',
      channel: {
        sendTyping: jest.fn(),
      },
      reply: jest.fn(),
    };
  });

  describe('Input Validation Error Branches', () => {
    it('should handle invalid input validation', async () => {
      mockInputValidator.validateUserId.mockReturnValue({
        valid: false,
        error: 'Invalid user ID format',
      });

      const result = await chatService(mockMessage);

      expect(result).toBeNull();
      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
    });

    it('should handle input validation exceptions', async () => {
      const validationError = new Error('Validation failed');
      mockInputValidator.validateUserId.mockImplementation(() => {
        throw validationError;
      });
      mockErrorHandler.handleError.mockReturnValue({
        type: 'VALIDATION_ERROR',
        message: 'Validation error occurred',
      });

      // Should handle the error gracefully
      await chatService(mockMessage);

      expectErrorReported(validationError, 'Validation error occurred', null);
      expect(mockPerplexityService.generateChatResponse).not.toHaveBeenCalled();
    });
  });

  describe('AI Service Error Branches', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ETIMEDOUT';
      mockPerplexityService.generateChatResponse.mockRejectedValue(timeoutError);
      mockErrorHandler.handleError.mockReturnValue({
        type: 'TIMEOUT_ERROR',
        message: 'Request timed out',
      });

      await chatService(mockMessage);

      expectErrorReported(timeoutError, 'Request timed out');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limited');
      rateLimitError.status = 429;
      mockPerplexityService.generateChatResponse.mockRejectedValue(rateLimitError);
      mockErrorHandler.handleError.mockReturnValue({
        type: 'RATE_LIMIT_ERROR',
        message: 'Too many requests',
      });

      await chatService(mockMessage);

      expectErrorReported(rateLimitError, 'Too many requests');
    });

    it('should handle generic API errors', async () => {
      const apiError = new Error('Service error');
      apiError.status = 500;
      mockPerplexityService.generateChatResponse.mockRejectedValue(apiError);
      mockErrorHandler.handleError.mockReturnValue({
        type: 'API_ERROR',
        message: 'Service unavailable',
      });

      await chatService(mockMessage);

      expectErrorReported(apiError, 'Service unavailable');
    });
  });

  describe('Pi Optimization Branch Coverage', () => {
    it('should skip emoji processing in low CPU mode', async () => {
      mockConfig.PI_OPTIMIZATIONS.LOW_CPU_MODE = true;
      mockPerplexityService.generateChatResponse.mockResolvedValue('Response');

      await chatService(mockMessage);

      expect(mockEmojiManager.addReactionsToMessage).not.toHaveBeenCalled();
    });

    it('should process emojis when not in low CPU mode', async () => {
      mockConfig.PI_OPTIMIZATIONS.LOW_CPU_MODE = false;
      mockPerplexityService.generateChatResponse.mockResolvedValue('Response');
      // Set up successful chunking to ensure the flow reaches emoji processing
      mockChunkMessage.mockReturnValue(['Single chunk response']);

      await chatService(mockMessage);

      expect(mockEmojiManager.addReactionsToMessage).toHaveBeenCalledWith(mockMessage);
    });

    afterEach(() => {
      // Reset config to default state
      mockConfig.PI_OPTIMIZATIONS.LOW_CPU_MODE = false;
    });

    it('should handle emoji processing errors gracefully', async () => {
      mockConfig.PI_OPTIMIZATIONS.LOW_CPU_MODE = false;
      mockPerplexityService.generateChatResponse.mockResolvedValue('Response');
      mockEmojiManager.addReactionsToMessage.mockRejectedValue(new Error('Emoji error'));

      // Should not throw error despite emoji processing failure
      await expect(chatService(mockMessage)).resolves.toBeUndefined();

      // Should still send response even if emoji processing fails
      expect(mockChunkMessage).toHaveBeenCalled();
    });
  });

  describe('Message Formatting Error Branches', () => {
    it('should handle message formatting errors', async () => {
      const formatError = new Error('Formatting blew up');
      mockPerplexityService.generateChatResponse.mockResolvedValue('Response');
      mockMessageFormatter.formatResponse.mockImplementationOnce(() => {
        throw formatError;
      });
      mockErrorHandler.handleError.mockReturnValue({
        type: 'FORMAT_ERROR',
        message: 'Formatting failed',
      });

      await chatService(mockMessage);

      expectErrorReported(formatError, 'Formatting failed');
    });

    it('should handle chunking errors', async () => {
      mockPerplexityService.generateChatResponse.mockResolvedValue('Response');
      const chunkError = new Error('Chunking error');
      mockChunkMessage.mockImplementation(() => {
        throw chunkError;
      });
      mockErrorHandler.handleError.mockReturnValue({
        type: 'CHUNK_ERROR',
        message: 'Message chunking failed',
      });

      await chatService(mockMessage);

      expectErrorReported(chunkError, 'Message chunking failed');
    });
  });

  // BUG (src/services/chat.js, handleChatMessage catch block): handleChatError
  // is called with null instead of processedData, so the error log and the
  // chat_error_time metric always record userId 'unknown' and
  // sanitizedContent 0, even when the user is known.
  it('reports the failing user to the error handler', async () => {
    const apiError = new Error('Service error');
    mockPerplexityService.generateChatResponse.mockRejectedValue(apiError);

    await chatService(mockMessage);

    expect(mockErrorHandler.handleError).toHaveBeenCalledWith(apiError, 'chat generation', {
      userId: 'user123',
      messageLength: 'test message'.length,
      sanitizedContent: 'test message'.length,
    });
  });
});
