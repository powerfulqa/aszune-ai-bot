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

  describe('File Error Handling', () => {
    it('should handle file operation errors', () => {
      const error = { code: 'EACCES', message: 'Permission denied' };
      const result = ErrorHandler.handleFileError(error, 'read', '/path/to/file');

      expect(result.type).toBe('PERMISSION_ERROR');
    });
  });
});
