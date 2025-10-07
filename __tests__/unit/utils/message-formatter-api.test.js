const { formatMessagesForAPI, validateMessageFormat, createAPICompatibilityError } = require('../../../src/utils/message-formatter-api');
const { ErrorHandler, ERROR_TYPES } = require('../../../src/utils/error-handler');

describe('Message Formatter API', () => {
  describe('formatMessagesForAPI', () => {
    it('should handle empty messages array', () => {
      const result = formatMessagesForAPI([]);
      expect(result).toEqual([]);
    });

    it('should remove consecutive messages from same role', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am fine' },
        { role: 'assistant', content: 'Thank you for asking' },
        { role: 'user', content: 'Good to hear' }
      ];

      const result = formatMessagesForAPI(messages);
      
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'I am fine' },
        { role: 'user', content: 'Good to hear' }
      ]);
    });

    it('should remove assistant message from start of conversation', () => {
      const messages = [
        { role: 'assistant', content: 'Hello there' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'How can I help?' }
      ];

      const result = formatMessagesForAPI(messages);
      
      expect(result).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'How can I help?' }
      ]);
    });

    it('should skip invalid messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: '' }, // Empty content
        null, // Invalid message
        { role: 'assistant' }, // Missing content
        { role: 'assistant', content: 'Hi there' }
      ];

      const result = formatMessagesForAPI(messages);
      
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ]);
    });

    it('should trim whitespace from content', () => {
      const messages = [
        { role: 'user', content: '  Hello  ' },
        { role: 'assistant', content: '\n  Response  \t' }
      ];

      const result = formatMessagesForAPI(messages);
      
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Response' }
      ]);
    });
  });

  describe('validateMessageFormat', () => {
    it('should validate proper message format', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];

      const result = validateMessageFormat(messages);
      
      expect(result).toEqual({
        valid: true,
        messageCount: 2
      });
    });

    it('should reject non-array input', () => {
      const result = validateMessageFormat('not an array');
      
      expect(result).toEqual({
        valid: false,
        error: 'Messages must be an array',
        code: 'INVALID_FORMAT'
      });
    });

    it('should reject empty messages array', () => {
      const result = validateMessageFormat([]);
      
      expect(result).toEqual({
        valid: false,
        error: 'Messages array cannot be empty',
        code: 'EMPTY_MESSAGES'
      });
    });

    it('should reject consecutive messages from same role', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = validateMessageFormat(messages);
      
      expect(result).toEqual({
        valid: false,
        error: 'Consecutive user messages at index 1',
        code: 'ALTERNATION_ERROR'
      });
    });

    it('should reject conversation not starting with user', () => {
      const messages = [
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Hi' }
      ];

      const result = validateMessageFormat(messages);
      
      expect(result).toEqual({
        valid: false,
        error: 'Conversation must start with a user message',
        code: 'MUST_START_WITH_USER'
      });
    });

    it('should reject invalid role', () => {
      const messages = [
        { role: 'invalid', content: 'Hello' }
      ];

      const result = validateMessageFormat(messages);
      
      expect(result).toEqual({
        valid: false,
        error: 'Invalid role "invalid" at index 0',
        code: 'INVALID_ROLE'
      });
    });

    it('should reject empty content', () => {
      const messages = [
        { role: 'user', content: '   ' } // Only whitespace
      ];

      const result = validateMessageFormat(messages);
      
      expect(result).toEqual({
        valid: false,
        error: 'Empty or invalid content at index 0',
        code: 'INVALID_CONTENT'
      });
    });
  });

  describe('createAPICompatibilityError', () => {
    it('should create conversation reset error for alternation issues', () => {
      const error = createAPICompatibilityError('should alternate with assistant message', 400);
      
      expect(error.statusCode).toBe(400);
      expect(error.needsConversationReset).toBe(true);
      expect(error.userMessage).toContain('reset our conversation');
    });

    it('should create generic API error for other 400 issues', () => {
      const error = createAPICompatibilityError('invalid_request_error', 400);
      
      expect(error.statusCode).toBe(400);
      expect(error.userMessage).toContain('request format');
    });

    it('should create generic API error for unknown issues', () => {
      const error = createAPICompatibilityError('unknown error', 400);
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('API request failed');
    });
  });
});