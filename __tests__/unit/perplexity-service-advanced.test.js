/**
 * Tests for perplexity service - Advanced functionality
 */
const { request } = require('undici');
const PerplexityService = require('../../src/services/perplexity-secure');
const { mockSuccessResponse, mockErrorResponse } = require('../utils/undici-mock-helpers');

jest.mock('undici', () => ({
  request: jest.fn(),
}));

describe('Perplexity Service - Advanced', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    // The module exports the PerplexityService class
    perplexityService = PerplexityService;
  });

  describe('sendChatRequest advanced scenarios', () => {
    it('handles rate limiting errors', async () => {
      const mockError = { error: 'Rate limit exceeded' };

      request.mockResolvedValueOnce(mockErrorResponse(mockError, 429));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles server errors', async () => {
      const mockError = { error: 'Internal server error' };

      request.mockResolvedValueOnce(mockErrorResponse(mockError, 500));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles unauthorized errors', async () => {
      const mockError = { error: 'Unauthorized' };

      request.mockResolvedValueOnce(mockErrorResponse(mockError, 401));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles forbidden errors', async () => {
      const mockError = { error: 'Forbidden' };

      request.mockResolvedValueOnce(mockErrorResponse(mockError, 403));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles timeout errors', async () => {
      request.mockRejectedValueOnce(new Error('Request timeout'));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow('Request timeout');
    });

    it('handles malformed response', async () => {
      const malformedResponse = { invalid: 'response' };

      request.mockResolvedValueOnce(mockSuccessResponse(malformedResponse));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles empty response', async () => {
      const emptyResponse = {};

      request.mockResolvedValueOnce(mockSuccessResponse(emptyResponse));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles response with no choices', async () => {
      const noChoicesResponse = { choices: [] };

      request.mockResolvedValueOnce(mockSuccessResponse(noChoicesResponse));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles response with invalid choice structure', async () => {
      const invalidChoiceResponse = { choices: [{ invalid: 'choice' }] };

      request.mockResolvedValueOnce(mockSuccessResponse(invalidChoiceResponse));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles very long messages', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const longMessage = 'A'.repeat(10000);
      const messages = [{ role: 'user', content: longMessage }];
      const response = await perplexityService.sendChatRequest(messages);

      expect(response).toEqual(mockResponse);
    });

    it('handles messages with special characters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const specialMessage = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?';
      const messages = [{ role: 'user', content: specialMessage }];
      const response = await perplexityService.sendChatRequest(messages);

      expect(response).toEqual(mockResponse);
    });

    it('handles messages with unicode characters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const unicodeMessage = 'Hello 世界 🌍';
      const messages = [{ role: 'user', content: unicodeMessage }];
      const response = await perplexityService.sendChatRequest(messages);

      expect(response).toEqual(mockResponse);
    });
  });
});
