/**
 * Validation Helpers - Utilities Tests
 * Tests for sanitizeString, runChecks
 */

const {
  sanitizeString,
  runChecks,
  checkStringType,
  checkMaxLength,
  checkNotEmpty,
  invalidResult,
} = require('../../src/utils/validation-helpers');

describe('Validation Helpers - Utilities', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace by default', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should not trim when disabled', () => {
      expect(sanitizeString('  hello  ', { trimWhitespace: false })).toBe('  hello  ');
    });

    it('should remove control characters by default', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
      expect(sanitizeString('hello\x1Fworld')).toBe('helloworld');
      expect(sanitizeString('hello\x7Fworld')).toBe('helloworld');
    });

    it('should preserve newlines and tabs', () => {
      expect(sanitizeString('hello\nworld')).toBe('hello\nworld');
      expect(sanitizeString('hello\tworld')).toBe('hello\tworld');
    });

    it('should not remove control chars when disabled', () => {
      expect(sanitizeString('hello\x00world', { removeControlChars: false })).toBe(
        'hello\x00world'
      );
    });

    it('should truncate to maxLength', () => {
      expect(sanitizeString('hello world', { maxLength: 5 })).toBe('hello');
    });

    it('should handle non-string values', () => {
      expect(sanitizeString(123)).toBe('123');
      expect(sanitizeString(null)).toBe('null');
      expect(sanitizeString(undefined)).toBe('undefined');
    });

    it('should combine all options', () => {
      const result = sanitizeString('  hello\x00world  ', {
        trimWhitespace: true,
        removeControlChars: true,
        maxLength: 8,
      });
      expect(result).toBe('hellowor');
    });
  });

  describe('runChecks', () => {
    it('should return null when all checks pass', () => {
      const result = runChecks(
        () => checkStringType('hello'),
        () => checkNotEmpty('hello'),
        () => checkMaxLength('hello', 10)
      );
      expect(result).toBeNull();
    });

    it('should return first error encountered', () => {
      const result = runChecks(
        () => checkStringType('hello'),
        () => checkMaxLength('hello', 3, 'Name'),
        () => checkNotEmpty('hello')
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name too long. Maximum length is 3 characters');
    });

    it('should stop at first error', () => {
      const checkCalled = jest.fn(() => null);
      const result = runChecks(() => invalidResult('First error'), checkCalled);
      expect(result.error).toBe('First error');
      expect(checkCalled).not.toHaveBeenCalled();
    });

    it('should handle empty checks', () => {
      const result = runChecks();
      expect(result).toBeNull();
    });
  });
});
