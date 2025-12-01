/**
 * Validation Helpers - Full Validators Tests
 * Tests for validateStringLength, validateNumericRange, validateArrayLength, etc.
 */

const {
  validateStringLength,
  validateNonEmptyString,
  validateNumericRange,
  validateArrayLength,
} = require('../../src/utils/validation-helpers');

describe('Validation Helpers - Full Validators', () => {
  describe('validateStringLength', () => {
    it('should validate strings within bounds', () => {
      const result = validateStringLength('hello', 1, 10, 'Name');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('hello');
    });

    it('should trim whitespace', () => {
      const result = validateStringLength('  hello  ', 1, 10);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('hello');
    });

    it('should reject non-strings', () => {
      const result = validateStringLength(123, 1, 10, 'Name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be a string');
    });

    it('should reject strings below minimum', () => {
      const result = validateStringLength('hi', 5, 10, 'Name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at least 5 characters');
    });

    it('should reject strings above maximum', () => {
      const result = validateStringLength('hello world', 1, 5, 'Name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name too long. Maximum length is 5 characters');
    });

    it('should validate trimmed length', () => {
      // '  hi  ' trimmed is 'hi' (2 chars), which is below min of 3
      const result = validateStringLength('  hi  ', 3, 10);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      const result = validateNonEmptyString('hello', 'Message');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('hello');
    });

    it('should trim whitespace', () => {
      const result = validateNonEmptyString('  hello  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('hello');
    });

    it('should reject non-strings', () => {
      const result = validateNonEmptyString(123, 'Message');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message must be a string');
    });

    it('should reject empty strings', () => {
      const result = validateNonEmptyString('', 'Message');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('should reject whitespace-only strings', () => {
      const result = validateNonEmptyString('   ', 'Message');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });
  });

  describe('validateNumericRange', () => {
    it('should validate numbers within range', () => {
      const result = validateNumericRange(5, 1, 10, 'Score');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(5);
    });

    it('should accept boundary values', () => {
      expect(validateNumericRange(1, 1, 10).valid).toBe(true);
      expect(validateNumericRange(10, 1, 10).valid).toBe(true);
    });

    it('should reject non-numbers', () => {
      const result = validateNumericRange('5', 1, 10, 'Score');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Score must be a valid number');
    });

    it('should reject NaN', () => {
      const result = validateNumericRange(NaN, 1, 10, 'Score');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Score must be a valid number');
    });

    it('should reject values below minimum', () => {
      const result = validateNumericRange(0, 1, 10, 'Score');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Score must be at least 1');
    });

    it('should reject values above maximum', () => {
      const result = validateNumericRange(11, 1, 10, 'Score');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Score must not exceed 10');
    });

    it('should handle negative ranges', () => {
      const result = validateNumericRange(-5, -10, 0);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(-5);
    });

    it('should handle decimal numbers', () => {
      const result = validateNumericRange(5.5, 1, 10);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(5.5);
    });
  });

  describe('validateArrayLength', () => {
    it('should validate arrays within bounds', () => {
      const result = validateArrayLength([1, 2, 3], 1, 5, 'Items');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toEqual([1, 2, 3]);
    });

    it('should accept boundary values', () => {
      expect(validateArrayLength([1], 1, 5).valid).toBe(true);
      expect(validateArrayLength([1, 2, 3, 4, 5], 1, 5).valid).toBe(true);
    });

    it('should reject non-arrays', () => {
      const result = validateArrayLength('not array', 1, 5, 'Items');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Items must be an array');
    });

    it('should reject arrays below minimum', () => {
      const result = validateArrayLength([], 1, 5, 'Items');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Items must have at least 1 items');
    });

    it('should reject arrays above maximum', () => {
      const result = validateArrayLength([1, 2, 3, 4, 5, 6], 1, 5, 'Items');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Items must not exceed 5 items');
    });
  });
});
