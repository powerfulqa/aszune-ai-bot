/**
 * Tests for the Message Formatter utility - Basic functionality
 */
jest.mock('../../src/utils/logger');
const messageFormatter = require('../../src/utils/message-formatter');
const config = require('../../src/config/config');

// Mock config for testing
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    COMPACT_MODE: true,
    LOW_CPU_MODE: false,
  },
  MESSAGE_LIMITS: {
    EMBED_DESCRIPTION_MAX_LENGTH: 2048,
    MAX_PARAGRAPH_LENGTH: 1000,
  },
}));

describe('Message Formatter - Basic', () => {
  describe('formatResponse', () => {
    it('should format a response message with default options', () => {
      const message = 'Hello, world!';
      const formattedMessage = messageFormatter.formatResponse(message);

      expect(formattedMessage).toBeDefined();
      expect(formattedMessage).toBe('Hello, world!');
    });

    it('should remove excessive whitespace', () => {
      const message = 'Hello\n\n\n\nworld!';
      const formattedMessage = messageFormatter.formatResponse(message);

      expect(formattedMessage).toBe('Hello\n\nworld!');
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(2000);
      const formattedMessage = messageFormatter.formatResponse(longMessage, { maxLength: 1000 });

      expect(formattedMessage.length).toBeLessThanOrEqual(1000);
      expect(formattedMessage.endsWith('...')).toBe(true);
    });

    it('should handle empty messages', () => {
      const formattedMessage = messageFormatter.formatResponse('');
      expect(formattedMessage).toBe('');
    });

    it('should handle null or undefined messages', () => {
      expect(() => messageFormatter.formatResponse(null)).not.toThrow();
      expect(() => messageFormatter.formatResponse(undefined)).not.toThrow();
    });

    it('should handle messages with only whitespace', () => {
      const formattedMessage = messageFormatter.formatResponse('   \n\t  ');
      expect(formattedMessage.trim()).toBe('');
    });

    it('should preserve single line breaks', () => {
      const message = 'Line 1\nLine 2';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toBe('Line 1\nLine 2');
    });

    it('should handle messages with tabs', () => {
      const message = 'Text\twith\ttabs';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toBe('Text\twith\ttabs');
    });
  });
});
