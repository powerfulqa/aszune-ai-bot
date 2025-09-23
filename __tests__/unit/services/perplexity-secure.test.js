/**
 * Extended tests for perplexity-secure service
 * Focuses on improving test coverage
 */
const { request } = require('undici');
const fs = require('fs').promises;

const PerplexityService = require('../../../src/services/perplexity-secure');
const { mockSuccessResponse, mockErrorResponse } = require('../../utils/undici-mock-helpers');

jest.mock('undici', () => ({
  request: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    chmod: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('No access')),
    stat: jest.fn().mockResolvedValue({
      isDirectory: jest.fn().mockReturnValue(true),
    }),
  },
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('hashed-value'),
  }),
}));

describe('PerplexitySecure Service', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;

    // Default mock implementations
    fs.readFile.mockRejectedValue(new Error('File not found'));
  });

  describe('generateChatResponse', () => {
    it('should handle rate limiting with 429 status code', async () => {
      request.mockResolvedValueOnce(mockErrorResponse({ error: 'Rate limit exceeded' }, 429));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.generateChatResponse(messages)).rejects.toThrow(
        'API request failed with status 429'
      );
    });

    it('should handle server errors with 500+ status code', async () => {
      request.mockResolvedValueOnce(mockErrorResponse({ error: 'Internal Server Error' }, 500));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.generateChatResponse(messages)).rejects.toThrow(
        'API request failed with status 500'
      );
    });

    it('should handle network errors', async () => {
      request.mockRejectedValueOnce(new Error('Network failure'));

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.generateChatResponse(messages)).rejects.toThrow();
    });

    it('should handle parsing errors in response', async () => {
      // Create a response that will trigger a JSON parse error
      const invalidJsonResponse = {
        body: {
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
          text: jest.fn().mockResolvedValue('Not valid JSON'),
        },
        statusCode: 200,
        headers: {
          get: jest.fn((key) => (key.toLowerCase() === 'content-type' ? 'application/json' : null)),
        },
      };

      request.mockResolvedValueOnce(invalidJsonResponse);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(perplexityService.generateChatResponse(messages)).rejects.toThrow();
    });

    it('should successfully generate a chat response', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello there!' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.generateChatResponse(messages);

      expect(response).toBe('Hello there!');
    });
  });

  describe('generateSummary', () => {
    it('should generate a summary of conversation history', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Summary of conversation' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [
        { role: 'user', content: 'What is JavaScript?' },
        { role: 'assistant', content: 'JavaScript is a programming language.' },
      ];

      const summary = await perplexityService.generateSummary(messages);
      expect(summary).toBe('Summary of conversation');
    });

    it('should handle errors in summary generation', async () => {
      request.mockRejectedValueOnce(new Error('API unavailable'));

      const messages = [
        { role: 'user', content: 'What is JavaScript?' },
        { role: 'assistant', content: 'JavaScript is a programming language.' },
      ];

      await expect(perplexityService.generateSummary(messages)).rejects.toThrow();
    });
  });

  describe('question caching', () => {
    it('should return cached response if available', async () => {
      // Mock successful cache read
      fs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          'hashed-value': {
            answer: 'Cached answer',
            timestamp: Date.now(),
          },
        })
      );

      // Should not even call the API
      const messages = [{ role: 'user', content: 'Cached question' }];
      const response = await perplexityService.generateChatResponse(messages);

      expect(response).toBe('Cached answer');
      expect(request).not.toHaveBeenCalled();
    });

    it('should save response to cache on successful API call', async () => {
      // Mock cache miss
      fs.readFile.mockRejectedValueOnce(new Error('File not found'));

      // Mock successful API response
      const mockResponse = {
        choices: [{ message: { content: 'New response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'New question' }];
      const response = await perplexityService.generateChatResponse(messages);

      expect(response).toBe('New response');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle cache directory creation when it doesnt exist', async () => {
      // Mock cache miss
      fs.readFile.mockRejectedValueOnce(new Error('File not found'));

      // Mock directory not existing
      fs.access.mockRejectedValueOnce(new Error('No directory'));

      // Mock successful API response
      const mockResponse = {
        choices: [{ message: { content: 'New response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'New question' }];
      const response = await perplexityService.generateChatResponse(messages);

      expect(response).toBe('New response');
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should skip caching when disabled', async () => {
      // Mock successful API response
      const mockResponse = {
        choices: [{ message: { content: 'Uncached response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Question' }];
      const response = await perplexityService.generateChatResponse(messages, { caching: false });

      expect(response).toBe('Uncached response');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle expired cache entries', async () => {
      // Mock expired cache entry (older than cache TTL)
      const oldTimestamp = Date.now() - 1000 * 60 * 60 * 25; // 25 hours ago
      fs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          answer: 'Old cached answer',
          timestamp: oldTimestamp,
        })
      );

      // Mock successful API response for the refreshed data
      const mockResponse = {
        choices: [{ message: { content: 'Fresh response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Question' }];
      const response = await perplexityService.generateChatResponse(messages);

      expect(response).toBe('Fresh response');
      expect(request).toHaveBeenCalled();
    });
  });

  describe('file permission security', () => {
    it('should set secure file permissions when writing to cache', async () => {
      // Mock cache miss
      fs.readFile.mockRejectedValueOnce(new Error('File not found'));

      // Mock successful API response
      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
      };

      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Question' }];
      await perplexityService.generateChatResponse(messages);

      expect(fs.chmod).toHaveBeenCalled();
    });
  });

  describe('retry mechanism', () => {
    it('should retry API calls on transient errors', async () => {
      // First call fails with 429, second succeeds
      request.mockResolvedValueOnce(mockErrorResponse({ error: 'Rate limit exceeded' }, 429));

      const mockResponse = {
        choices: [{ message: { content: 'Retried response' } }],
      };
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.generateChatResponse(messages, {
        retryOnRateLimit: true,
      });

      expect(response).toBe('Retried response');
      expect(request).toHaveBeenCalledTimes(2);
    });
  });
});
