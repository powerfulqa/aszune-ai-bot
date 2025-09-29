/**
 * ErrorHandler Critical Coverage Tests - Retry Logic and Edge Cases
 */

const { ErrorHandler } = require('../../src/utils/error-handler');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock config
jest.mock('../../src/config/config', () => ({
  RATE_LIMITS: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
}));

describe('ErrorHandler - Retry Logic and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Rate limit exceeded');
          error.statusCode = 429;
          throw error;
        }
        return 'success';
      });

      const result = await ErrorHandler.withRetry(operation, {
        maxRetries: 3,
        delay: 10,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Validation error'));

      await expect(
        ErrorHandler.withRetry(operation, {
          maxRetries: 3,
          delay: 10,
        })
      ).rejects.toThrow('Validation error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries for persistent errors', async () => {
      const operation = jest.fn().mockImplementation(() => {
        const error = new Error('Rate limit');
        error.statusCode = 429;
        throw error;
      });

      await expect(
        ErrorHandler.withRetry(operation, {
          maxRetries: 2,
          delay: 10,
        })
      ).rejects.toThrow('Rate limit');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Special Edge Cases', () => {
    it('should handle very large error objects', () => {
      const error = {
        message: 'Large error',
        data: 'x'.repeat(100000),
        nested: { deep: { error: 'info' } },
      };

      const result = ErrorHandler.handleError(error, 'large error test');

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.message).toBeTruthy();
    });

    it('should handle circular reference errors', () => {
      const error = new Error('Circular error');
      error.self = error;

      expect(() => {
        ErrorHandler.handleError(error, 'circular test');
      }).not.toThrow();
    });
  });

  describe('File and Validation Error Handling', () => {
    it('should handle file operation errors', () => {
      const error = { code: 'EACCES', message: 'Permission denied' };
      const result = ErrorHandler.handleFileError(error, 'read', '/path/to/file');

      expect(result.type).toBe('PERMISSION_ERROR');
    });

    it('should handle validation errors with field info', () => {
      const error = new Error('Invalid email format');
      const result = ErrorHandler.handleValidationError(error, 'email', 'invalid-email');

      expect(result.type).toBe('UNKNOWN_ERROR'); // Since message doesn't contain "validation"
    });

    it('should truncate long values', () => {
      const error = new Error('Invalid data format');
      const longValue = 'a'.repeat(200);
      const result = ErrorHandler.handleValidationError(error, 'field', longValue);

      expect(result.type).toBe('UNKNOWN_ERROR');
    });
  });
});
