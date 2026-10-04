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

// What the client returns once an Agent API body is normalised
const NORMALIZED_MOCK = {
  choices: [{ message: { role: 'assistant', content: 'Mock response' } }],
  usage: undefined,
};

describe('Perplexity Service - Basic', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    // The module exports the PerplexityService class
    perplexityService = PerplexityService;
  });

  describe('getRuntimeInfo', () => {
    it('exposes the last reported model and last call from the API client', () => {
      perplexityService.apiClient.lastModel = 'openai/gpt-6-luna';
      perplexityService.apiClient.lastCall = { ok: true };
      expect(perplexityService.getRuntimeInfo()).toEqual({
        lastModel: 'openai/gpt-6-luna',
        lastCall: { ok: true },
      });
      perplexityService.apiClient.lastModel = '';
      perplexityService.apiClient.lastCall = null;
    });
  });

  describe('sendChatRequest', () => {
    it('sends a request to the API with correct parameters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      jest.useFakeTimers({ now: new Date('2026-10-04T12:00:00Z'), doNotFake: ['setTimeout'] });
      const messages = [{ role: 'user', content: 'Hello' }];
      let response;
      try {
        response = await perplexityService.sendChatRequest(messages);
      } finally {
        jest.useRealTimers();
      }

      const [url, init] = request.mock.calls[0];
      expect(url).toBe('https://api.perplexity.ai/v1/agent');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: `Bearer ${config.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init.body)).toEqual({
        preset: 'medium',
        input: [{ type: 'message', role: 'user', content: 'Hello' }],
        instructions:
          'Today is 2026-10-04.\n\n' +
          'If someone asks what model, AI or API you use, tell them: you run on the Perplexity Agent API (/v1/agent) with the "medium" preset, and the preset picks the model (not reported yet).',
        tools: [{ type: 'web_search' }, { type: 'fetch_url' }],
        max_output_tokens: 4096,
      });

      expect(response).toEqual(NORMALIZED_MOCK);
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

      expect(response).toEqual(NORMALIZED_MOCK);
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

      expect(response).toEqual(NORMALIZED_MOCK);
    });
  });
});
