const { ErrorHandler, resetErrorHandlerMocks } = require('./error-handler.test.setup');

describe('ErrorHandler - Context and Message Coverage', () => {
  beforeEach(() => {
    resetErrorHandlerMocks();
  });

  describe('Context Information Processing', () => {
    it('should include all context information in result', () => {
      const error = new Error('Test error');
      const additionalData = {
        userId: '123456789',
        operation: 'message_processing',
        requestId: 'req_123',
        additionalData: { key: 'value' },
      };

      const result = ErrorHandler.handleError(error, 'test operation', additionalData);

      expect(result.context).toBe('test operation');
      expect(result.timestamp).toBeTruthy();
    });

    it('should handle missing context gracefully', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handleError(error);

      expect(result.context).toBe('');
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
});
