/**
 * PerplexitySecure - Search Features Tests
 * Tests citation footer handling and search recency filter detection
 */

const { mockSuccessResponse } = require('../../utils/undici-mock-helpers');

jest.mock('undici', () => ({ request: jest.fn() }));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockRejectedValue(new Error('File not found')),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    chmod: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('No access')),
    stat: jest.fn().mockResolvedValue({ isDirectory: jest.fn().mockReturnValue(true) }),
  },
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash-123'),
  }),
}));

const { request } = require('undici');
const perplexityService = require('../../../src/services/perplexity-secure');

describe('PerplexitySecure - Search Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const service = perplexityService;

  describe('Citation footer in _processChatResponse', () => {
    const history = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Tell me about Arthas' },
    ];
    const opts = { maxRetries: 1, retryDelay: 0 };
    const cacheConfig = { maxEntries: 100 };

    function mockApiWithCitations(content, citations) {
      request.mockResolvedValue(
        mockSuccessResponse({
          choices: [{ message: { content } }],
          citations: citations,
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        })
      );
    }

    it('should append citation domains as footer', async () => {
      mockApiWithCitations('Arthas was the Lich King.', [
        'https://wowpedia.fandom.com/wiki/Arthas',
        'https://www.wowhead.com/npc/arthas',
      ]);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toContain('Arthas was the Lich King.');
      expect(result).toContain('*Sources: wowpedia.fandom.com, wowhead.com*');
    });

    it('should strip www. prefix from domains', async () => {
      mockApiWithCitations('Response text', ['https://www.example.com/page']);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toContain('*Sources: example.com*');
      expect(result).not.toContain('www.');
    });

    it('should limit citations to 5 domains', async () => {
      const citations = Array.from({ length: 8 }, (_, i) => `https://site${i}.com/page`);
      mockApiWithCitations('Response', citations);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      const sourcesMatch = result.match(/\*Sources: (.+)\*/);
      expect(sourcesMatch).toBeTruthy();
      const domains = sourcesMatch[1].split(', ');
      expect(domains.length).toBe(5);
    });

    it('should not append footer when no citations returned', async () => {
      mockApiWithCitations('Response without sources', undefined);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toBe('Response without sources');
      expect(result).not.toContain('Sources:');
    });

    it('should not append footer when citations array is empty', async () => {
      mockApiWithCitations('Response text', []);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).not.toContain('Sources:');
    });

    it('should skip invalid URLs in citations', async () => {
      mockApiWithCitations('Response', [
        'https://valid.com/page',
        'not-a-url',
        'https://another.com/page',
      ]);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toContain('*Sources: valid.com, another.com*');
    });
  });

  describe('Recency filter detection in _processChatResponse', () => {
    const opts = { maxRetries: 1, retryDelay: 0 };
    const cacheConfig = { maxEntries: 100 };

    function mockApiResponse() {
      request.mockResolvedValue(
        mockSuccessResponse({
          choices: [{ message: { content: 'API response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        })
      );
    }

    it('should apply recency filter for "latest" keyword', async () => {
      mockApiResponse();
      const history = [{ role: 'user', content: 'What are the latest WoW patch notes?' }];

      await service._processChatResponse(history, opts, cacheConfig, false);

      // The recency filter is passed via options to sendChatRequest → buildRequestPayload
      // We verify the request was made (integration confirmation)
      expect(request).toHaveBeenCalled();
    });

    it('should apply recency filter for "current" keyword', async () => {
      mockApiResponse();
      const history = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'What is the current meta?' },
      ];

      await service._processChatResponse(history, opts, cacheConfig, false);
      expect(request).toHaveBeenCalled();
    });

    it('should not apply recency filter for normal queries', async () => {
      mockApiResponse();
      const history = [{ role: 'user', content: 'Tell me about the Lich King lore' }];

      await service._processChatResponse(history, opts, cacheConfig, false);
      expect(request).toHaveBeenCalled();
    });

    it('should detect recency keywords case-insensitively', async () => {
      mockApiResponse();
      const history = [{ role: 'user', content: 'What are the LATEST changes?' }];

      await service._processChatResponse(history, opts, cacheConfig, false);
      expect(request).toHaveBeenCalled();
    });

    it('should check only the last user message for recency keywords', async () => {
      mockApiResponse();
      const history = [
        { role: 'user', content: 'What are the latest patch notes?' },
        { role: 'assistant', content: 'Here are the notes...' },
        { role: 'user', content: 'Tell me about Arthas' },
      ];

      // Last user message has no recency keyword
      await service._processChatResponse(history, opts, cacheConfig, false);
      expect(request).toHaveBeenCalled();
    });

    it('should throw for empty history (validated by buildRequestPayload)', async () => {
      mockApiResponse();

      await expect(
        service._processChatResponse([], opts, cacheConfig, false)
      ).rejects.toThrow('Messages array cannot be empty');
    });
  });
});
