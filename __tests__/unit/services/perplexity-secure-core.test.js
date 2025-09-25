/**
 * Perplexity Secure Service Core Tests
 * Tests for core functionality and error handling
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

describe('PerplexitySecure Service - Core', () => {
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
      const result = await perplexityService.generateChatResponse(messages);

      expect(result).toContain('Rate limit exceeded');
      expect(result).toContain('try again');
    });

    it('should handle API errors gracefully', async () => {
      request.mockResolvedValueOnce(mockErrorResponse({ error: 'API Error' }, 500));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages);

      expect(result).toContain('temporarily unavailable');
    });

    it('should handle network errors', async () => {
      request.mockRejectedValueOnce(new Error('Network error'));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages);

      expect(result).toContain('Network connection');
      expect(result).toContain('connection');
    });

    it('should handle invalid response format', async () => {
      request.mockResolvedValueOnce(mockSuccessResponse({ invalid: 'format' }));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages);

      expect(result).toContain('error occurred');
      expect(result).toContain('unexpected error occurred');
    });

    it('should handle empty response', async () => {
      request.mockResolvedValueOnce(mockSuccessResponse({ choices: [] }));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages);

      expect(result).toContain('error occurred');
      expect(result).toContain('unexpected error occurred');
    });

    it('should handle successful response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello! How can I help you today?'
            }
          }
        ]
      };
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages);

      expect(result).toBe('Hello! How can I help you today?');
    });

    it('should handle backward compatibility with boolean caching parameter', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response'
            }
          }
        ]
      };
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages, false); // boolean caching

      expect(result).toBe('Test response');
    });

    it('should handle object options parameter', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response'
            }
          }
        ]
      };
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateChatResponse(messages, { caching: false });

      expect(result).toBe('Test response');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for conversation history', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This conversation covered topics about programming and development.'
            }
          }
        ]
      };
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

      const messages = [
        { role: 'user', content: 'What is JavaScript?' },
        { role: 'assistant', content: 'JavaScript is a programming language.' }
      ];
      const result = await perplexityService.generateSummary(messages);

      expect(result).toBe('This conversation covered topics about programming and development.');
    });

    it('should handle empty conversation history', async () => {
      const result = await perplexityService.generateSummary([]);
      expect(result).toContain('No conversation');
    });

    it('should handle summary generation errors', async () => {
      request.mockRejectedValueOnce(new Error('Summary generation failed'));

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await perplexityService.generateSummary(messages);

      expect(result).toContain('Unable to generate summary');
    });
  });
});
