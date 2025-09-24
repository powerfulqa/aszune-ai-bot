/**
 * Input Validator - General Validation Tests
 * Tests general validation patterns and limits
 */

const {
  InputValidator,
  VALIDATION_LIMITS,
} = require('../../src/utils/input-validator');

describe('InputValidator - General Validation', () => {
  describe('validateInput', () => {
    it('should validate text input correctly', () => {
      const validInputs = [
        'Hello world',
        'This is a test message',
        'User input with numbers 123',
        'Special chars: !@#$%^&*()',
      ];

      validInputs.forEach((input) => {
        const result = InputValidator.validateInput(input, 'text');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject inputs that exceed length limits', () => {
      const longInput = 'a'.repeat(VALIDATION_LIMITS.TEXT_MAX_LENGTH + 1);
      const result = InputValidator.validateInput(longInput, 'text');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should reject inputs with dangerous patterns', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'eval("malicious code")',
      ];

      dangerousInputs.forEach((input) => {
        const result = InputValidator.validateInput(input, 'text');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('unsafe');
      });
    });

    it('should validate email format', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
      ];

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
      ];

      validEmails.forEach((email) => {
        const result = InputValidator.validateInput(email, 'email');
        expect(result.valid).toBe(true);
      });

      invalidEmails.forEach((email) => {
        const result = InputValidator.validateInput(email, 'email');
        expect(result.valid).toBe(false);
      });
    });

    it('should validate URL format', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org',
        'https://subdomain.example.com/path',
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'javascript:alert("xss")',
      ];

      validUrls.forEach((url) => {
        const result = InputValidator.validateInput(url, 'url');
        expect(result.valid).toBe(true);
      });

      invalidUrls.forEach((url) => {
        const result = InputValidator.validateInput(url, 'url');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML content', () => {
      const input = '<p>Hello <strong>world</strong>!</p>';
      const result = InputValidator.sanitizeInput(input);
      
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<strong>');
      expect(result).toContain('Hello world!');
    });

    it('should remove dangerous scripts', () => {
      const input = 'Hello <script>alert("xss")</script> world';
      const result = InputValidator.sanitizeInput(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Hello');
      expect(result).toContain('world');
    });

    it('should preserve safe content', () => {
      const input = 'This is safe content with numbers 123 and symbols !@#';
      const result = InputValidator.sanitizeInput(input);
      
      expect(result).toBe(input);
    });
  });
});
