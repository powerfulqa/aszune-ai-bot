/**
 * Input Validator - Sanitization Tests
 * Tests input sanitization and validation functions
 */

const {
  InputValidator,
  VALIDATION_PATTERNS,
  VALIDATION_LIMITS,
  DANGEROUS_PATTERNS,
} = require('../../src/utils/input-validator');

describe('InputValidator - Sanitization', () => {
  describe('validateAndSanitize', () => {
    it('should validate and sanitize clean input', () => {
      const input = 'Hello world!';
      const result = InputValidator.validateAndSanitize(input, 'text');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(input);
      expect(result.error).toBeUndefined();
    });

    it('should sanitize HTML content', () => {
      const input = '<p>Hello <strong>world</strong>!</p>';
      const result = InputValidator.validateAndSanitize(input, 'text');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain('<p>');
      expect(result.sanitized).not.toContain('<strong>');
      expect(result.sanitized).toContain('Hello world!');
    });

    it('should reject dangerous content', () => {
      const input = '<script>alert("xss")</script>';
      const result = InputValidator.validateAndSanitize(input, 'text');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unsafe');
    });

    it('should handle empty input', () => {
      const result = InputValidator.validateAndSanitize('', 'text');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('');
    });

    it('should handle null input', () => {
      const result = InputValidator.validateAndSanitize(null, 'text');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate different input types', () => {
      const testCases = [
        { input: 'user@example.com', type: 'email', expected: true },
        { input: 'https://example.com', type: 'url', expected: true },
        { input: '123456789012345678', type: 'userId', expected: true },
        { input: 'invalid-email', type: 'email', expected: false },
        { input: 'not-a-url', type: 'url', expected: false },
        { input: '123', type: 'userId', expected: false },
      ];

      testCases.forEach(({ input, type, expected }) => {
        const result = InputValidator.validateAndSanitize(input, { type });
        expect(result.valid).toBe(expected);
      });
    });
  });

  describe('validation patterns', () => {
    it('should have correct validation patterns', () => {
      expect(VALIDATION_PATTERNS).toHaveProperty('USER_ID');
      expect(VALIDATION_PATTERNS).toHaveProperty('EMAIL');
      expect(VALIDATION_PATTERNS).toHaveProperty('URL');
      expect(VALIDATION_PATTERNS).toHaveProperty('TEXT');
    });

    it('should have correct validation limits', () => {
      expect(VALIDATION_LIMITS).toHaveProperty('TEXT_MAX_LENGTH');
      expect(VALIDATION_LIMITS).toHaveProperty('EMAIL_MAX_LENGTH');
      expect(VALIDATION_LIMITS).toHaveProperty('URL_MAX_LENGTH');
      expect(VALIDATION_LIMITS).toHaveProperty('USER_ID_LENGTH');
    });

    it('should have dangerous patterns defined', () => {
      expect(DANGEROUS_PATTERNS).toBeDefined();
      expect(Array.isArray(DANGEROUS_PATTERNS)).toBe(true);
      expect(DANGEROUS_PATTERNS.length).toBeGreaterThan(0);
    });
  });
});
