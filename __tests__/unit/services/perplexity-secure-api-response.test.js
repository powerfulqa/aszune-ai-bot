/**
 * Perplexity Secure Service - API Response Handling Tests
 * Tests for _handleApiResponse method
 */

const PerplexityService = require('../../../src/services/perplexity-secure');

jest.mock('undici', () => ({
  request: jest.fn(),
}));

describe('PerplexitySecure Service - API Response Handling', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;
  });

  describe('_handleApiResponse method', () => {
    it('should throw error for null response', async () => {
      await expect(perplexityService._handleApiResponse(null)).rejects.toThrow(
        'Invalid response: response is null or undefined'
      );
    });

    it('should throw error for undefined response', async () => {
      await expect(perplexityService._handleApiResponse(undefined)).rejects.toThrow(
        'Invalid response: response is null or undefined'
      );
    });

    it('should handle error status codes', async () => {
      const response = {
        statusCode: 400,
        body: {
          text: jest.fn().mockResolvedValue('{"error":"Bad request"}'),
        },
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'API request failed'
      );
    });

    it('should handle response without body', async () => {
      const response = {
        statusCode: 200,
        body: null,
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: body is missing or does not have json method'
      );
    });

    it('should handle body without json method', async () => {
      const response = {
        statusCode: 200,
        body: {},
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: body is missing or does not have json method'
      );
    });

    it('should handle JSON parsing errors', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockRejectedValue(new Error('JSON parse error')),
        },
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Failed to parse response as JSON'
      );
    });

    it('should handle invalid response object', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue('not-an-object'),
        },
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: response is not a valid object'
      );
    });

    it('should handle missing choices array', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({}),
        },
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: missing or empty choices array'
      );
    });

    it('should handle invalid choice structure', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            choices: ['not-an-object'],
          }),
        },
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: invalid choice structure'
      );
    });

    it('should handle missing message field', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            choices: [{}],
          }),
        },
      };

      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: choice missing required message field'
      );
    });

    it('should return valid response data', async () => {
      const responseData = {
        choices: [
          {
            message: {
              content: 'Valid response',
            },
          },
        ],
      };
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue(responseData),
        },
      };

      const result = await perplexityService._handleApiResponse(response);
      expect(result).toEqual(responseData);
    });
  });
});