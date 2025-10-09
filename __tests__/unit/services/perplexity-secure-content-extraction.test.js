/**
 * Perplexity Secure Service - Content Extraction Tests
 * Tests for _extractResponseContent method
 */

const PerplexityService = require('../../../src/services/perplexity-secure');

jest.mock('undici', () => ({
  request: jest.fn(),
}));

describe('PerplexitySecure Service - Content Extraction', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;
  });

  describe('_extractResponseContent method', () => {
    it('should extract content from message.content', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Test message content',
            },
          },
        ],
      };

      const result = perplexityService._extractResponseContent(response);
      expect(result).toBe('Test message content');
    });

    it('should extract content from choice.content', () => {
      const response = {
        choices: [
          {
            content: 'Direct choice content',
          },
        ],
      };

      const result = perplexityService._extractResponseContent(response);
      expect(result).toBe('Direct choice content');
    });

    it('should handle empty response', () => {
      expect(() => perplexityService._extractResponseContent(null)).toThrow();
    });

    it('should handle empty choices', () => {
      const response = { choices: [] };
      expect(() => perplexityService._extractResponseContent(response)).toThrow();
    });

    it('should return default message for invalid structure', () => {
      const response = {
        choices: [
          {
            // No message or content field
          },
        ],
      };

      const result = perplexityService._extractResponseContent(response);
      expect(result).toBe('Sorry, I could not extract content from the response.');
    });
  });
});
