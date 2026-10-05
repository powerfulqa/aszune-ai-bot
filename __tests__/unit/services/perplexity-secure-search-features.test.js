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

    it('should append a numbered source footer', async () => {
      mockApiWithCitations('Arthas was the Lich King.', [
        'https://wowpedia.fandom.com/wiki/Arthas',
        'https://www.wowhead.com/npc/arthas',
      ]);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toBe(
        'Arthas was the Lich King.\n\n*Sources: ' +
          '[1] [wowpedia.fandom.com](https://wowpedia.fandom.com/wiki/Arthas) · ' +
          '[2] [wowhead.com](https://www.wowhead.com/npc/arthas)*'
      );
    });

    it('should list only the sources the answer cites', async () => {
      mockApiWithCitations('Arthas fell at Icecrown [2].', [
        'https://a.com/1',
        'https://b.com/2',
        'https://c.com/3',
      ]);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toBe(
        'Arthas fell at Icecrown [2].\n\n*Sources: [2] [b.com](https://b.com/2)*'
      );
    });

    it('should not append footer when no citations returned', async () => {
      mockApiWithCitations('Response without sources', undefined);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toBe('Response without sources');
    });

    it('should not append footer when citations array is empty', async () => {
      mockApiWithCitations('Response text', []);

      const result = await service._processChatResponse(history, opts, cacheConfig, false);

      expect(result).toBe('Response text');
    });
  });

  describe('formatCitationFooter', () => {
    const { formatCitationFooter } = require('../../../src/services/perplexity-secure');

    it('falls back to the first five sources when nothing is cited inline', () => {
      const citations = Array.from({ length: 8 }, (_, i) => `https://site${i + 1}.com/p`);
      expect(formatCitationFooter('No markers here', citations)).toBe(
        '\n\n*Sources: ' +
          [1, 2, 3, 4, 5].map((n) => `[${n}] [site${n}.com](https://site${n}.com/p)`).join(' · ') +
          '*'
      );
    });

    it('strips only a leading www. from hostnames', () => {
      expect(formatCitationFooter('See [1]', ['https://www.awww.example.com/x'])).toBe(
        '\n\n*Sources: [1] [awww.example.com](https://www.awww.example.com/x)*'
      );
    });

    it('ignores cited numbers with no matching source', () => {
      expect(formatCitationFooter('Claims [1][9]', ['https://one.com/'])).toBe(
        '\n\n*Sources: [1] [one.com](https://one.com/)*'
      );
    });

    it('skips unparseable URLs but keeps the other numbers', () => {
      expect(
        formatCitationFooter('Text', [
          'https://valid.com/page',
          'not-a-url',
          'https://another.com/page',
        ])
      ).toBe(
        '\n\n*Sources: [1] [valid.com](https://valid.com/page) · ' +
          '[3] [another.com](https://another.com/page)*'
      );
    });

    it('returns an empty string when there are no usable sources', () => {
      expect(formatCitationFooter('Text', ['not-a-url'])).toBe('');
      expect(formatCitationFooter('Text', [])).toBe('');
      expect(formatCitationFooter('Text', undefined)).toBe('');
    });

    it('leaves out sources the answer already links itself', () => {
      const content =
        'Plays very differently [1][2].\n\n' +
        '[1] [Changeling guide](https://a.com/guide) · [2] [Faction guide](https://b.com/faction)';
      expect(formatCitationFooter(content, ['https://a.com/guide', 'https://b.com/faction'])).toBe(
        ''
      );
      expect(
        formatCitationFooter('See [1][2] and [Faction guide](https://b.com/faction)', [
          'https://a.com/guide',
          'https://b.com/faction',
        ])
      ).toBe('\n\n*Sources: [1] [a.com](https://a.com/guide)*');
    });

    it('strips a source list the model wrote itself but keeps inline markers', () => {
      const { stripModelSourceList } = require('../../../src/services/perplexity-secure');
      expect(
        stripModelSourceList(
          'Hotfix 9.0.2 is current [1].\n\n[1] [1]\n\n' +
            '- [2] [Faction guide](https://b.com/f)\n**Sources:** a.com, b.com\n'
        )
      ).toBe('Hotfix 9.0.2 is current [1].');
      expect(stripModelSourceList('Pick Cathay [1].\nIt is forgiving [2].')).toBe(
        'Pick Cathay [1].\nIt is forgiving [2].'
      );
    });

    it('lists a URL once when the same source appears under two numbers', () => {
      expect(
        formatCitationFooter('Cult mechanics [1][2][3].', [
          'https://a.com/x',
          'https://b.com/y',
          'https://a.com/x',
        ])
      ).toBe('\n\n*Sources: [1] [a.com](https://a.com/x) · [2] [b.com](https://b.com/y)*');
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

      const body = JSON.parse(request.mock.calls[0][1].body);
      expect(body.tools[0]).toEqual({
        type: 'web_search',
        filters: { search_recency_filter: 'month' },
      });
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

      await expect(service._processChatResponse([], opts, cacheConfig, false)).rejects.toThrow(
        'Messages array cannot be empty'
      );
    });
  });
});
