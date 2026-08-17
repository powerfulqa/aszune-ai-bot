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

  describe('sanitizeContent regression: everyday vocabulary is preserved', () => {
    // Regression for the off-by-one sanitization-rule mapping that applied
    // the SQL-keyword regex as a removal rule, mangling ordinary chat
    // messages before they reached the AI or conversation history.
    const gamingPhrases = [
      "what's the drop rate for this boss?",
      'can you create a build for a paladin?',
      'when is the next update coming?',
      'select the best class for beginners',
      'how do I delete my save file?',
      'insert coin to continue',
      'the union of both factions',
      'alter time is a mage spell',
      'exec summary of the patch notes',
    ];

    it.each(gamingPhrases)('preserves %j unchanged', (phrase) => {
      const result = InputValidator.sanitizeContent(phrase);
      expect(result.content).toBe(phrase);
      expect(result.warnings).toEqual([]);
    });

    it('preserves gaming vocabulary through the chat message pipeline', () => {
      const phrase = "what's the drop rate on the new update?";
      const result = InputValidator.validateAndSanitize(phrase, {
        type: 'message',
        strict: false,
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(phrase);
    });

    it('does not emit SQL injection warnings for plain text', () => {
      const result = InputValidator.sanitizeContent('drop table manners and select a chair');
      expect(result.warnings).not.toContain('Potential SQL injection pattern detected');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('sanitizeContent still removes genuinely dangerous content', () => {
    it('removes path traversal sequences with the correct warning', () => {
      const result = InputValidator.sanitizeContent('open ../../etc/passwd now');
      expect(result.content).not.toContain('../');
      expect(result.warnings).toContain('Path traversal pattern removed');
    });

    it('removes unclosed embedded-content tags', () => {
      const result = InputValidator.sanitizeContent('hello <iframe src=evil');
      expect(result.content).not.toContain('<iframe');
      expect(result.warnings).toContain('Embedded content removed');
    });

    it('removes script tags with the correct warning', () => {
      const result = InputValidator.sanitizeContent('hi <script>alert(1)</script> there');
      expect(result.content).not.toContain('<script>');
      expect(result.warnings).toContain('Script tags removed');
    });

    it('is stateless across repeated calls (no /g lastIndex leakage)', () => {
      const input = 'javascript:alert(1) and ../secret';
      const first = InputValidator.sanitizeContent(input);
      const second = InputValidator.sanitizeContent(input);
      expect(second.content).toBe(first.content);
      expect(second.warnings).toEqual(first.warnings);
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
