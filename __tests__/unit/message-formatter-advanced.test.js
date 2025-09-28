/**
 * Tests for the Message Formatter utility - Advanced functionality
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

describe('Message Formatter - Advanced', () => {
  describe('createCompactEmbed', () => {
    it('should return original embed when not in compact mode', () => {
      // Temporarily override compact mode
      const originalCompact = messageFormatter.compact;
      messageFormatter.compact = false;

      const embed = {
        title: 'Test Title',
        description: 'Test Description',
        fields: [{ name: 'Field', value: 'Value' }],
      };

      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBe(embed);

      // Restore original value
      messageFormatter.compact = originalCompact;
    });

    it('should create compact embed when in compact mode', () => {
      const originalCompact = messageFormatter.compact;
      messageFormatter.compact = true;

      const embed = {
        title: 'Test Title',
        description: 'Test Description',
        fields: [{ name: 'Field', value: 'Value' }],
      };

      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();
      expect(result).not.toBe(embed);

      // Restore original value
      messageFormatter.compact = originalCompact;
    });

    it('should handle embeds without fields', () => {
      const originalCompact = messageFormatter.compact;
      messageFormatter.compact = true;

      const embed = {
        title: 'Test Title',
        description: 'Test Description',
      };

      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();

      // Restore original value
      messageFormatter.compact = originalCompact;
    });

    it('should handle embeds without description', () => {
      const originalCompact = messageFormatter.compact;
      messageFormatter.compact = true;

      const embed = {
        title: 'Test Title',
        fields: [{ name: 'Field', value: 'Value' }],
      };

      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();

      // Restore original value
      messageFormatter.compact = originalCompact;
    });
  });

  describe('formatResponse with special content', () => {
    it('should handle messages with markdown formatting', () => {
      const message = '**Bold text** and *italic text* and `code`';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('**Bold text**');
      expect(formattedMessage).toContain('*italic text*');
      expect(formattedMessage).toContain('`code`');
    });

    it('should handle messages with URLs', () => {
      const message = 'Check out https://example.com for more info';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('https://example.com');
    });

    it('should handle messages with emojis', () => {
      const message = 'Hello 👋 World 🌍';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('👋');
      expect(formattedMessage).toContain('🌍');
    });

    it('should handle messages with unicode characters', () => {
      const message = 'Hello 世界 🌍';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('世界');
      expect(formattedMessage).toContain('🌍');
    });

    it('should handle messages with special characters', () => {
      const message = 'Text with !@#$%^&*()_+-=[]{}|;:,.<>?';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('!@#$%^&*()');
    });

    it('should handle messages with code blocks', () => {
      const message = '```javascript\nconsole.log("Hello");\n```';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('```javascript');
      expect(formattedMessage).toContain('```');
    });

    it('should handle messages with quotes', () => {
      const message = '> This is a quote\n> With multiple lines';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('> This is a quote');
    });

    it('should handle messages with spoilers', () => {
      const message = 'The answer is ||spoiler text||';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('||spoiler text||');
    });
  });

  describe('edge cases', () => {
    it('should handle very long single word', () => {
      const longWord = 'A'.repeat(1000);
      const formattedMessage = messageFormatter.formatResponse(longWord, { maxLength: 100 });
      expect(formattedMessage.length).toBeLessThanOrEqual(100);
    });

    it('should handle messages with mixed content types', () => {
      const mixedMessage =
        'Text with **bold** and *italic* and `code` and https://example.com and emoji 🎉';
      const formattedMessage = messageFormatter.formatResponse(mixedMessage);
      expect(formattedMessage).toContain('**bold**');
      expect(formattedMessage).toContain('*italic*');
      expect(formattedMessage).toContain('`code`');
      expect(formattedMessage).toContain('https://example.com');
      expect(formattedMessage).toContain('🎉');
    });

    it('should handle messages with carriage returns', () => {
      const message = 'Text\rwith\rcarriage\rreturns';
      const formattedMessage = messageFormatter.formatResponse(message);
      expect(formattedMessage).toContain('\r');
    });
  });
});
