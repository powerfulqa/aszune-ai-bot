/**
 * Input Validator - User ID Tests
 * Tests Discord user ID validation functionality
 */

const { InputValidator } = require('../../src/utils/input-validator');

describe('InputValidator - User ID', () => {
  describe('validateUserId', () => {
    it('should validate correct Discord user IDs', () => {
      const validIds = ['123456789012345678', '987654321098765432', '111111111111111111'];

      validIds.forEach((id) => {
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
        '123456789012345678', // number instead of string - fixed precision issue
      ];

      invalidIds.forEach((id) => {
        const result = InputValidator.validateUserId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should accept valid user IDs', () => {
      const validIds = ['123456789012345678', '987654321098765432', '111111111111111111'];

      validIds.forEach((id) => {
        const result = InputValidator.validateUserId(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        { input: '123456789012345678', expected: true },
        { input: '000000000000000001', expected: true },
        { input: '999999999999999999', expected: true },
        { input: '12345678901234567', expected: false }, // 17 digits
        { input: '1234567890123456789', expected: false }, // 19 digits
      ];

      edgeCases.forEach(({ input, expected }) => {
        const result = InputValidator.validateUserId(input);
        expect(result.valid).toBe(expected);
      });
    });
  });
});
