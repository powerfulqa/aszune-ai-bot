/**
 * Validation Helpers - Result Creators Tests
 * Tests for invalidResult, createValidationResult
 */

const { createValidationResult, invalidResult } = require('../../src/utils/validation-helpers');

describe('Validation Helpers - Result Creators', () => {
  describe('createValidationResult', () => {
    it('should create a valid result object', () => {
      const result = createValidationResult(true, null, 'sanitized');
      expect(result).toEqual({
        valid: true,
        isValid: true,
        error: null,
        sanitized: 'sanitized',
      });
    });

    it('should create an invalid result object', () => {
      const result = createValidationResult(false, 'Error message', null);
      expect(result).toEqual({
        valid: false,
        isValid: false,
        error: 'Error message',
        sanitized: null,
      });
    });

    it('should include additional metadata', () => {
      const result = createValidationResult(true, null, 'value', { extra: 'data' });
      expect(result.extra).toBe('data');
    });
  });

  describe('invalidResult', () => {
    it('should create a failure result', () => {
      const result = invalidResult('Something went wrong');
      expect(result.valid).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Something went wrong');
      expect(result.sanitized).toBeNull();
    });

    it('should include metadata', () => {
      const result = invalidResult('Error', { code: 'INVALID_INPUT' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });
});
