const { InputValidator, VALIDATION_LIMITS } = require('../../../src/utils/input-validator');

describe('InputValidator', () => {
  describe('validateTimeString', () => {
    it('should return valid for normal time strings', () => {
      expect(InputValidator.validateTimeString('in 5 minutes').valid).toBe(true);
      expect(InputValidator.validateTimeString('tomorrow at 3pm').valid).toBe(true);
    });

    it('should return invalid for empty strings', () => {
      expect(InputValidator.validateTimeString('').valid).toBe(false);
      expect(InputValidator.validateTimeString(null).valid).toBe(false);
    });

    it('should return invalid for too long strings', () => {
      const longString = 'a'.repeat(101);
      expect(InputValidator.validateTimeString(longString).valid).toBe(false);
    });

    it('should return invalid for dangerous patterns', () => {
      expect(InputValidator.validateTimeString('<script>alert(1)</script>').valid).toBe(false);
      expect(InputValidator.validateTimeString('javascript:alert(1)').valid).toBe(false);
    });
  });

  describe('validateReminderMessage', () => {
    it('should return valid for normal messages', () => {
      expect(InputValidator.validateReminderMessage('Buy milk').valid).toBe(true);
      expect(InputValidator.validateReminderMessage('Meeting with team').valid).toBe(true);
    });

    it('should return invalid for empty messages', () => {
      expect(InputValidator.validateReminderMessage('').valid).toBe(false);
      expect(InputValidator.validateReminderMessage(null).valid).toBe(false);
    });

    it('should return invalid for too long messages', () => {
      const longString = 'a'.repeat(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH + 1);
      expect(InputValidator.validateReminderMessage(longString).valid).toBe(false);
    });

    it('should return invalid for dangerous patterns', () => {
      expect(InputValidator.validateReminderMessage('<script>alert(1)</script>').valid).toBe(false);
    });
  });
});
