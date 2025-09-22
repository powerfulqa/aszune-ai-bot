/**
 * Input Validator Tests
 * Comprehensive test coverage for input validation and sanitization
 */
const { InputValidator, VALIDATION_PATTERNS, VALIDATION_LIMITS, DANGEROUS_PATTERNS } = require('../../src/utils/input-validator');

describe('InputValidator', () => {
  describe('validateUserId', () => {
    it('should validate correct Discord user IDs', () => {
      const validIds = [
        '123456789012345678',
        '987654321098765432',
        '111111111111111111'
      ];

      validIds.forEach(id => {
        const result = InputValidator.validateUserId(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid user IDs', () => {
      const invalidIds = [
        '123', // too short
        '12345678901234567890', // too long (20 digits)
        'abc123456789012345', // contains letters
        '12345678901234567a', // contains letters
        '', // empty
        null, // null
        undefined, // undefined
        123456789012345678 // number instead of string
      ];

      invalidIds.forEach(id => {
        const result = InputValidator.validateUserId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should accept valid user IDs', () => {
      const validIds = [
        '123456789012345678',
        '987654321098765432',
        '111111111111111111'
      ];

      validIds.forEach(id => {
        const result = InputValidator.validateUserId(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should handle errors gracefully', () => {
      // Test with invalid input that would cause an error
      const result = InputValidator.validateUserId(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateMessageContent', () => {
    it('should validate normal message content', () => {
      const validMessages = [
        'Hello world!',
        'This is a test message.',
        'Message with numbers 123 and symbols !@#$%'
      ];

      validMessages.forEach(message => {
        const result = InputValidator.validateMessageContent(message);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH + 1);
      const result = InputValidator.validateMessageContent(longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject empty messages', () => {
      const result = InputValidator.validateMessageContent('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-string inputs', () => {
      const result = InputValidator.validateMessageContent(123);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org',
        'https://subdomain.example.com/path?query=value'
      ];

      validUrls.forEach(url => {
        const result = InputValidator.validateUrl(url);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      invalidUrls.forEach(url => {
        const result = InputValidator.validateUrl(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateCommand', () => {
    it('should validate correct commands', () => {
      const validCommands = [
        '!help',
        '/help',
        '!test_command',
        '/test-command'
      ];

      validCommands.forEach(command => {
        const result = InputValidator.validateCommand(command);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid commands', () => {
      const invalidCommands = [
        'help', // no prefix
        '!', // just prefix
        '!a'.repeat(50), // too long
        '!command@invalid', // invalid characters
        '' // empty
      ];

      invalidCommands.forEach(command => {
        const result = InputValidator.validateCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should accept valid commands with underscores and hyphens', () => {
      const validCommands = [
        '!test_command',
        '!test-command',
        '!test123',
        '/help',
        '/test_command'
      ];

      validCommands.forEach(command => {
        const result = InputValidator.validateCommand(command);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('sanitizeContent', () => {
    it('should remove dangerous HTML tags', () => {
      const dangerousContent = '<script>alert("xss")</script>Hello world';
      const result = InputValidator.sanitizeContent(dangerousContent);
      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('Hello world');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should remove JavaScript protocols', () => {
      const dangerousContent = 'javascript:alert("xss")';
      const result = InputValidator.sanitizeContent(dangerousContent);
      expect(result.content).not.toContain('javascript:');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect SQL injection attempts', () => {
      const dangerousContent = "'; DROP TABLE users; --";
      const result = InputValidator.sanitizeContent(dangerousContent);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle normal content without warnings', () => {
      const normalContent = 'This is normal text content.';
      const result = InputValidator.sanitizeContent(normalContent);
      expect(result.content).toBe(normalContent);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const htmlContent = '<div>Hello & "world"</div>';
      const result = InputValidator.escapeHtml(htmlContent);
      expect(result).toContain('&lt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should handle empty input', () => {
      const result = InputValidator.escapeHtml('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = InputValidator.escapeHtml(null);
      expect(result).toBe('');
    });
  });

  describe('validateAndSanitize', () => {
    it('should validate and sanitize text input', () => {
      const input = 'Hello world!';
      const result = InputValidator.validateAndSanitize(input, { type: 'text' });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(input);
      expect(result.warnings).toEqual([]);
    });

    it('should validate and sanitize message input', () => {
      const input = 'Hello world!';
      const result = InputValidator.validateAndSanitize(input, { type: 'message' });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    it('should validate and sanitize user ID input', () => {
      const input = '123456789012345678';
      const result = InputValidator.validateAndSanitize(input, { type: 'userId' });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    it('should validate and sanitize URL input', () => {
      const input = 'https://example.com';
      const result = InputValidator.validateAndSanitize(input, { type: 'url' });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    it('should validate and sanitize command input', () => {
      const input = '!help';
      const result = InputValidator.validateAndSanitize(input, { type: 'command' });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    it('should reject input that is too long', () => {
      const input = 'a'.repeat(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH + 1);
      const result = InputValidator.validateAndSanitize(input, { type: 'text' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject empty input', () => {
      const result = InputValidator.validateAndSanitize('', { type: 'text' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-string input', () => {
      const result = InputValidator.validateAndSanitize(123, { type: 'text' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should handle strict mode with warnings', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = InputValidator.validateAndSanitize(input, { type: 'text', strict: true });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous content');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle custom max length', () => {
      const input = 'a'.repeat(10);
      const result = InputValidator.validateAndSanitize(input, { type: 'text', maxLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should handle errors gracefully', () => {
      // Test with invalid input that would cause an error
      const result = InputValidator.validateAndSanitize(null, { type: 'text' });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Validation Patterns', () => {
    it('should export validation patterns', () => {
      expect(VALIDATION_PATTERNS).toBeDefined();
      expect(VALIDATION_PATTERNS.DISCORD_USER_ID).toBeDefined();
      expect(VALIDATION_PATTERNS.MESSAGE_CONTENT).toBeDefined();
      expect(VALIDATION_PATTERNS.URL_PATTERN).toBeDefined();
    });

    it('should export validation limits', () => {
      expect(VALIDATION_LIMITS).toBeDefined();
      expect(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH).toBeDefined();
      expect(VALIDATION_LIMITS.MAX_USERNAME_LENGTH).toBeDefined();
    });

    it('should export dangerous patterns', () => {
      expect(DANGEROUS_PATTERNS).toBeDefined();
      expect(DANGEROUS_PATTERNS.SCRIPT_TAGS).toBeDefined();
      expect(DANGEROUS_PATTERNS.XSS_PATTERNS).toBeDefined();
    });
  });
});
