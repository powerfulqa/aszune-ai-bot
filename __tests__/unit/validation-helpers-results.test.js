/**
 * Validation Helpers - Result Creators Tests
 * Tests for validResult, invalidResult, createValidationResult
 */

const {
  createValidationResult,
  validResult,
  invalidResult,
} = require('../../src/utils/validation-helpers');

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

  describe('validResult', () => {
    it('should create a success result', () => {
      const result = validResult('cleaned value');
      expect(result.valid).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.sanitized).toBe('cleaned value');
    });

    it('should handle null sanitized value', () => {
      const result = validResult();
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeNull();
    });

    it('should include metadata', () => {
      const result = validResult('value', { fieldName: 'test' });
      expect(result.fieldName).toBe('test');
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
