/**
 * Tests for perplexity service - Basic functionality
 */
const { request } = require('undici');
const PerplexityService = require('../../src/services/perplexity-secure');
const config = require('../../src/config/config');
const { mockSuccessResponse, mockErrorResponse } = require('../utils/undici-mock-helpers');

jest.mock('undici', () => ({
  request: jest.fn(),
}));

describe('Perplexity Service - Basic', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    // The module exports the PerplexityService class
    perplexityService = PerplexityService;
  });

  describe('sendChatRequest', () => {
    it('sends a request to the API with correct parameters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.sendChatRequest(messages);

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining(config.PERPLEXITY_API_KEY),
            'Content-Type': 'application/json',
          }),
          body: expect.any(String),
        })
      );

      expect(response).toEqual(mockResponse);
    });

    it('throws an error when API request fails', async () => {
      const mockError = { error: 'Bad request' };

      request.mockResolvedValueOnce(mockErrorResponse(mockError, 400));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow();
    });

    it('handles network errors gracefully', async () => {
      request.mockRejectedValueOnce(new Error('Network error'));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow('Network error');
    });

    it('handles empty messages array', async () => {
      const messages = [];

      // Our new message validation should reject empty arrays
      await expect(perplexityService.sendChatRequest(messages)).rejects.toThrow(
        'Messages array cannot be empty'
      );
    });

    it('handles single message', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.sendChatRequest(messages);

      expect(response).toEqual(mockResponse);
    });

    it('handles multiple messages', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];
      const response = await perplexityService.sendChatRequest(messages);

      expect(response).toEqual(mockResponse);
    });
  });
});
