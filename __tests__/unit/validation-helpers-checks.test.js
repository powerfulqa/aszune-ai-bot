/**
 * Validation Helpers - Check Functions Tests
 * Tests for checkRequired, checkStringType, checkArrayType, etc.
 */

const {
  checkRequired,
  checkStringType,
  checkArrayType,
  checkMaxLength,
  checkMinLength,
  checkNotEmpty,
} = require('../../src/utils/validation-helpers');

describe('Validation Helpers - Check Functions', () => {
  describe('checkRequired', () => {
    it('should return null for valid values', () => {
      expect(checkRequired('hello')).toBeNull();
      expect(checkRequired(0)).toBeNull();
      expect(checkRequired(false)).toBeNull();
      expect(checkRequired([])).toBeNull();
      expect(checkRequired({})).toBeNull();
    });

    it('should return error for null', () => {
      const result = checkRequired(null, 'Username');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username is required');
    });

    it('should return error for undefined', () => {
      const result = checkRequired(undefined, 'Email');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return error for empty string', () => {
      const result = checkRequired('', 'Password');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should use default field name', () => {
      const result = checkRequired(null);
      expect(result.error).toBe('Value is required');
    });
  });

  describe('checkStringType', () => {
    it('should return null for strings', () => {
      expect(checkStringType('hello')).toBeNull();
      expect(checkStringType('')).toBeNull();
    });

    it('should return error for non-strings', () => {
      expect(checkStringType(123, 'Name').error).toBe('Name must be a string');
      expect(checkStringType(null, 'Name').error).toBe('Name must be a string');
      expect(checkStringType(undefined, 'Name').error).toBe('Name must be a string');
      expect(checkStringType([], 'Name').error).toBe('Name must be a string');
      expect(checkStringType({}, 'Name').error).toBe('Name must be a string');
    });

    it('should use default field name', () => {
      const result = checkStringType(123);
      expect(result.error).toBe('Value must be a string');
    });
  });

  describe('checkArrayType', () => {
    it('should return null for arrays', () => {
      expect(checkArrayType([])).toBeNull();
      expect(checkArrayType([1, 2, 3])).toBeNull();
      expect(checkArrayType(['a', 'b'])).toBeNull();
    });

    it('should return error for non-arrays', () => {
      expect(checkArrayType('string', 'Items').error).toBe('Items must be an array');
      expect(checkArrayType(123, 'Items').error).toBe('Items must be an array');
      expect(checkArrayType({}, 'Items').error).toBe('Items must be an array');
      expect(checkArrayType(null, 'Items').error).toBe('Items must be an array');
    });

    it('should use default field name', () => {
      const result = checkArrayType('not array');
      expect(result.error).toBe('Value must be an array');
    });
  });

  describe('checkMaxLength', () => {
    it('should return null when within limit', () => {
      expect(checkMaxLength('hello', 10)).toBeNull();
      expect(checkMaxLength('hello', 5)).toBeNull();
      expect(checkMaxLength('', 5)).toBeNull();
    });

    it('should return error when exceeding limit', () => {
      const result = checkMaxLength('hello world', 5, 'Message');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message too long. Maximum length is 5 characters');
    });

    it('should handle non-string values gracefully', () => {
      expect(checkMaxLength(123, 5)).toBeNull();
      expect(checkMaxLength(null, 5)).toBeNull();
    });

    it('should use default field name', () => {
      const result = checkMaxLength('hello world', 5);
      expect(result.error).toBe('Value too long. Maximum length is 5 characters');
    });
  });

  describe('checkMinLength', () => {
    it('should return null when meeting minimum', () => {
      expect(checkMinLength('hello', 3)).toBeNull();
      expect(checkMinLength('hello', 5)).toBeNull();
    });

    it('should return error when below minimum', () => {
      const result = checkMinLength('hi', 3, 'Password');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 3 characters');
    });

    it('should handle non-string values gracefully', () => {
      expect(checkMinLength(123, 5)).toBeNull();
      expect(checkMinLength(null, 5)).toBeNull();
    });

    it('should use default field name', () => {
      const result = checkMinLength('hi', 5);
      expect(result.error).toBe('Value must be at least 5 characters');
    });
  });

  describe('checkNotEmpty', () => {
    it('should return null for non-empty strings', () => {
      expect(checkNotEmpty('hello')).toBeNull();
      expect(checkNotEmpty('  hello  ')).toBeNull();
      expect(checkNotEmpty('a')).toBeNull();
    });

    it('should return error for empty strings', () => {
      const result = checkNotEmpty('', 'Content');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Content cannot be empty');
    });

    it('should return error for whitespace-only strings', () => {
      const result = checkNotEmpty('   ', 'Content');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Content cannot be empty');
    });

    it('should handle non-string values gracefully', () => {
      expect(checkNotEmpty(123)).toBeNull();
      expect(checkNotEmpty(null)).toBeNull();
    });

    it('should use default field name', () => {
      const result = checkNotEmpty('');
      expect(result.error).toBe('Value cannot be empty');
    });
  });
});
