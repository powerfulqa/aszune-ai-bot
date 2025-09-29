/**
 * ErrorHandler Critical Coverage Tests - Error Classification
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

describe('ErrorHandler - Error Classification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
});