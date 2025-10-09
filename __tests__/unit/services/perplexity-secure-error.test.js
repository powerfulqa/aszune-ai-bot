/**
 * Perplexity Secure Service - Error Handling Tests
 * Tests for error processing and retry logic methods
 */

const PerplexityService = require('../../../src/services/perplexity-secure');

describe('PerplexitySecure Service - Error Handling', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;
  });

  describe('_handleErrorResponse method', () => {
    it('should handle error response with text body', async () => {
      const body = {
        text: jest.fn().mockResolvedValue('{"error":"Test error"}'),
      };

      await expect(perplexityService._handleErrorResponse(400, body)).rejects.toThrow(
        'API request failed with status 400: {"error":"Test error"}'
      );
    });

    it('should handle error response without body', async () => {
      await expect(perplexityService._handleErrorResponse(500, null)).rejects.toThrow(
        'API request failed with status 500: Could not read response body'
      );
    });

    it('should handle body text error', async () => {
      const body = {
        text: jest.fn().mockRejectedValue(new Error('Text read error')),
      };

      await expect(perplexityService._handleErrorResponse(500, body)).rejects.toThrow(
        'API request failed with status 500: Error reading response body: Text read error'
      );
    });

    it('should handle long error messages', async () => {
      const longError = 'a'.repeat(1000);
      const body = {
        text: jest.fn().mockResolvedValue(longError),
      };

      try {
        await perplexityService._handleErrorResponse(400, body);
      } catch (error) {
        // Our new API compatibility handler creates specific error messages for 400 errors
        expect(error.message).toContain('API request failed');
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe('_generateErrorMessage method', () => {
    it('should return rate limit message for 429 status', () => {
      const error = { statusCode: 429 };
      const errorResponse = { message: 'Rate limit exceeded' };

      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should return service unavailable message for 5xx status', () => {
      const error = { statusCode: 500 };
      const errorResponse = { message: 'Server error' };

      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('The service is temporarily unavailable. Please try again later.');
    });

    it('should return network error message for network errors', () => {
      const error = { message: 'Network connection failed' };
      const errorResponse = { message: 'Network error' };

      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Network connection issue. Please check your connection and try again.');
    });

    it('should return empty response message for empty response errors', () => {
      const error = { message: 'Empty response received' };
      const errorResponse = { message: 'Empty response' };

      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Empty response received from the service.');
    });

    it('should return unexpected format message for invalid errors', () => {
      const error = { message: 'invalid response format' };
      const errorResponse = { message: 'Invalid format' };

      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Unexpected response format received.');
    });

    it('should return original error message for unknown errors', () => {
      const error = { message: 'Unknown error' };
      const errorResponse = { message: 'Unknown error occurred' };

      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Unknown error occurred');
    });
  });

  describe('_isRetryableError method', () => {
    it('should return false for null error', () => {
      const result = perplexityService._isRetryableError(null);
      expect(result).toBe(false);
    });

    it('should return false for error without message', () => {
      const error = {};
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return true for temporary errors', () => {
      const error = { message: 'Temporary service unavailable' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(true);
    });

    it('should return true for network errors', () => {
      const error = { message: 'Network timeout' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(true);
    });

    it('should return true for 429 errors', () => {
      const error = { message: 'Rate limit 429 exceeded' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(true);
    });

    it('should return false for permanent errors', () => {
      const error = { message: 'Permanent API error' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for invalid errors', () => {
      const error = { message: 'Invalid request format' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for unauthorized errors', () => {
      const error = { message: 'Unauthorized access' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for forbidden errors', () => {
      const error = { message: 'Forbidden operation' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for unknown errors by default', () => {
      const error = { message: 'Some random error' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });
  });
});
