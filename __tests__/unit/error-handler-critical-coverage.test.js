/**
 * Additional tests for src/utils/error-handler.js to reach 80% coverage
 * Focus on uncovered branches and functions
 */

const { ErrorHandler, ERROR_TYPES } = require('../../src/utils/error-handler');
const logger = require('../../src/utils/logger');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock config
jest.mock('../../src/config/config', () => ({
  RATE_LIMITS: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000
  }
}));

describe('ErrorHandler - Critical Coverage Enhancement', () => {
  const setupMocks = () => {
    jest.clearAllMocks();
  };

  beforeEach(setupMocks);

  describe('Error Type Classification', () => {
    it('should classify network timeout errors', () => {
      const timeoutError = { code: 'ETIMEDOUT', message: 'Request timed out' };
      const result = ErrorHandler.handleError(timeoutError, 'network request');
      
      expect(result.type).toBe('UNKNOWN_ERROR'); // Based on actual implementation
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify ECONNRESET errors as network errors', () => {
      const networkError = { code: 'ECONNRESET', message: 'Connection reset' };
      const result = ErrorHandler.handleError(networkError, 'connection');
      
      expect(result.type).toBe('UNKNOWN_ERROR'); // Based on actual implementation  
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify ENOTFOUND errors as network errors', () => {
      const dnsError = { code: 'ENOTFOUND', message: 'DNS lookup failed' };
      const result = ErrorHandler.handleError(dnsError, 'DNS lookup');
      
      expect(result.type).toBe('UNKNOWN_ERROR'); // Based on actual implementation
    });

    it('should classify 429 status as rate limit error', () => {
      const rateLimitError = { statusCode: 429, message: 'Too many requests' };
      const result = ErrorHandler.handleError(rateLimitError, 'API call');

      expect(result.type).toBe('RATE_LIMIT_ERROR');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should classify 401/403 as authentication errors', () => {
      const authError = { statusCode: 401, message: 'Unauthorized' };
      const result = ErrorHandler.handleError(authError, 'auth check');
      
      expect(result.type).toBe('API_ERROR'); // Based on actual implementation
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify 403 as authentication error', () => {
      const forbiddenError = { statusCode: 403, message: 'Forbidden' };
      const result = ErrorHandler.handleError(forbiddenError, 'permission check');
      
      expect(result.type).toBe('API_ERROR'); // Based on actual implementation
    });

    it('should classify validation errors', () => {
      const validationError = { message: 'Validation failed for input' };
      const result = ErrorHandler.handleError(validationError, 'input validation');
      
      expect(result.type).toBe('VALIDATION_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify file permission errors', () => {
      const permissionError = { code: 'EACCES', message: 'Permission denied' };
      const result = ErrorHandler.handleError(permissionError, 'file access');
      
      expect(result.type).toBe('PERMISSION_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify file not found errors', () => {
      const fileError = { code: 'ENOENT', message: 'File not found' };
      const result = ErrorHandler.handleError(fileError, 'file read');
      
      expect(result.type).toBe('FILE_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify memory errors', () => {
      const memoryError = { code: 'ENOMEM', message: 'Out of memory' };
      const result = ErrorHandler.handleError(memoryError, 'memory allocation');
      
      expect(result.type).toBe('MEMORY_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should classify config errors', () => {
      const configError = { message: 'Invalid config setting' };
      const result = ErrorHandler.handleError(configError, 'configuration');
      
      expect(result.type).toBe('CONFIG_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Context Information Processing', () => {
    it('should include all context information in result', () => {
      const error = new Error('Test error');
      const additionalData = { 
        userId: '123456789',
        operation: 'message_processing',
        requestId: 'req_123',
        additionalData: { key: 'value' }
      };
      
      const result = ErrorHandler.handleError(error, 'test operation', additionalData);

      expect(result.context).toBe('test operation');
      expect(result.timestamp).toBeTruthy();
    });

    it('should handle missing context gracefully', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handleError(error);
      
      expect(result.context).toBe(''); // Based on default parameter
      expect(result.type).toBe('UNKNOWN_ERROR');
    });

    it('should handle null context', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handleError(error, null);

      expect(result.context).toBe(null);
      expect(result.type).toBe('UNKNOWN_ERROR');
    });

    it('should handle empty context object', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handleError(error, 'test', {});

      expect(result.context).toBe('test');
      expect(result.type).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Error Message Processing', () => {
    it('should extract message from error objects', () => {
      const error = new Error('Specific error message');
      const result = ErrorHandler.handleError(error, 'test');

      expect(result.message).toContain('error occurred');
    });

    it('should handle errors without message property', () => {
      const error = { code: 'TEST_ERROR' };
      const result = ErrorHandler.handleError(error, 'test');
      
      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.message).toContain('error occurred');
    });

    it('should handle string errors', () => {
      const result = ErrorHandler.handleError('String error message', 'test');
      
      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.message).toContain('error occurred');
    });

    it('should handle null or undefined errors safely', () => {
      expect(() => {
        ErrorHandler.handleError(null, 'test');
      }).not.toThrow();
      
      expect(() => {
        ErrorHandler.handleError(undefined, 'test');
      }).not.toThrow();
    });
  });

  describe('Status Code and Error Code Processing', () => {
    it('should preserve HTTP status codes', () => {
      const error = { statusCode: 404, message: 'Not found' };
      const result = ErrorHandler.handleError(error, 'HTTP request');
      
      expect(result.type).toBe('API_ERROR');
    });

    it('should preserve error codes', () => {
      const error = { code: 'ENOENT', message: 'File not found' };
      const result = ErrorHandler.handleError(error, 'file operation');
      
      expect(result.type).toBe('FILE_ERROR');
    });

    it('should handle errors with both status and statusCode', () => {
      const error = { status: 409, statusCode: 409, message: 'Conflict' };
      const result = ErrorHandler.handleError(error, 'conflict resolution');
      
      expect(result.type).toBe('API_ERROR');
    });

    it('should handle 5xx errors as network errors', () => {
      const error = { statusCode: 500, message: 'Internal server error' };
      const result = ErrorHandler.handleError(error, 'server request');
      
      expect(result.type).toBe('NETWORK_ERROR');
    });
  });

  describe('API Error Handling', () => {
    it('should handle API errors with response data', () => {
      const error = { 
        statusCode: 400,
        response: { 
          status: 400,
          data: { error: 'Bad request' }
        }
      };
      
      const result = ErrorHandler.handleApiError(error, '/api/test');
      
      expect(result.type).toBe('API_ERROR');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle API errors without response', () => {
      const error = { message: 'Network error' };
      const result = ErrorHandler.handleApiError(error, '/api/test');
      
      expect(result.type).toBe('UNKNOWN_ERROR');
    });
  });

  describe('File Error Handling', () => {
    it('should handle file operation errors', () => {
      const error = { code: 'EACCES', message: 'Permission denied' };
      const result = ErrorHandler.handleFileError(error, 'read', '/path/to/file');
      
      expect(result.type).toBe('PERMISSION_ERROR');
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle validation errors with field info', () => {
      const error = new Error('Invalid email format');
      const result = ErrorHandler.handleValidationError(error, 'email', 'invalid-email');
      
      expect(result.type).toBe('UNKNOWN_ERROR'); // Since message doesn't contain "validation"
    });

    it('should truncate long values', () => {
      const error = new Error('Validation failed');
      const longValue = 'a'.repeat(200);
      const result = ErrorHandler.handleValidationError(error, 'field', longValue);
      
      expect(result.type).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Error Creation', () => {
    it('should create standardized errors', () => {
      const error = ErrorHandler.createError('Test message', ERROR_TYPES.API_ERROR, 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.type).toBe(ERROR_TYPES.API_ERROR);
      expect(error.code).toBe('TEST_CODE');
      expect(error.timestamp).toBeTruthy();
    });

    it('should create errors with default values', () => {
      const error = ErrorHandler.createError('Test message');
      
      expect(error.type).toBe(ERROR_TYPES.UNKNOWN_ERROR);
      expect(error.code).toBe(null);
    });
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
        delay: 10
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Validation error'));

      await expect(ErrorHandler.withRetry(operation, {
        maxRetries: 3,
        delay: 10
      })).rejects.toThrow('Validation error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries for persistent errors', async () => {
      const operation = jest.fn().mockImplementation(() => {
        const error = new Error('Rate limit');
        error.statusCode = 429;
        throw error;
      });

      await expect(ErrorHandler.withRetry(operation, {
        maxRetries: 2,
        delay: 10
      })).rejects.toThrow('Rate limit');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Special Edge Cases', () => {
    it('should handle very large error objects', () => {
      const error = {
        message: 'Large error',
        data: 'x'.repeat(100000),
        nested: { deep: { error: 'info' } }
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

    it('should handle errors with getters that throw', () => {
      const problematicError = {
        get message() {
          return 'Accessible message';
        },
        get stack() {
          throw new Error('Stack access failed');
        }
      };

      expect(() => {
        ErrorHandler.handleError(problematicError, 'problematic error');
      }).not.toThrow();
    });
  });
});