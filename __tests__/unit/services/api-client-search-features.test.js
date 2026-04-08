/**
 * API Client - Search Features Tests
 * Tests for model selection, search options, citation config, and token usage logging
 */

jest.mock('undici', () => ({ request: jest.fn() }));

const { ApiClient } = require('../../../src/services/api-client');

describe('ApiClient - Search Features', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ApiClient('test-key', 'https://api.perplexity.ai');
  });

  describe('_selectModel', () => {
    const baseConfig = {
      DEFAULT_MODEL: 'sonar',
      MULTI_TURN_MODEL: 'sonar-pro',
      MULTI_TURN_THRESHOLD: 2,
    };

    it('should return explicit model from options when provided', () => {
      const messages = [{ role: 'user', content: 'hi' }];
      expect(client._selectModel(messages, { model: 'custom-model' }, baseConfig)).toBe(
        'custom-model'
      );
    });

    it('should return sonar-pro when messages exceed threshold', () => {
      const messages = [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ];
      expect(client._selectModel(messages, {}, baseConfig)).toBe('sonar-pro');
    });

    it('should return default model when messages are at or below threshold', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ];
      expect(client._selectModel(messages, {}, baseConfig)).toBe('sonar');
    });

    it('should return default model when MULTI_TURN_MODEL is not configured', () => {
      const messages = [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
      ];
      const configNoMultiTurn = { ...baseConfig, MULTI_TURN_MODEL: null };
      expect(client._selectModel(messages, {}, configNoMultiTurn)).toBe('sonar');
    });

    it('should prefer explicit option over multi-turn upgrade', () => {
      const messages = Array(10).fill({ role: 'user', content: 'msg' });
      expect(client._selectModel(messages, { model: 'sonar' }, baseConfig)).toBe('sonar');
    });
  });

  describe('_buildSearchOptions', () => {
    it('should include return_citations when configured', () => {
      const config = { RETURN_CITATIONS: true, SEARCH_DOMAIN_FILTER: [] };
      const result = client._buildSearchOptions({}, config);
      expect(result.return_citations).toBe(true);
    });

    it('should omit return_citations when not configured', () => {
      const config = { RETURN_CITATIONS: false, SEARCH_DOMAIN_FILTER: [] };
      const result = client._buildSearchOptions({}, config);
      expect(result.return_citations).toBeUndefined();
    });

    it('should include search_domain_filter from config', () => {
      const config = {
        RETURN_CITATIONS: false,
        SEARCH_DOMAIN_FILTER: ['wowhead.com', 'wowpedia.fandom.com'],
      };
      const result = client._buildSearchOptions({}, config);
      expect(result.search_domain_filter).toEqual(['wowhead.com', 'wowpedia.fandom.com']);
    });

    it('should prefer options.searchDomainFilter over config', () => {
      const config = {
        RETURN_CITATIONS: false,
        SEARCH_DOMAIN_FILTER: ['config-domain.com'],
      };
      const result = client._buildSearchOptions(
        { searchDomainFilter: ['option-domain.com'] },
        config
      );
      expect(result.search_domain_filter).toEqual(['option-domain.com']);
    });

    it('should omit search_domain_filter when empty', () => {
      const config = { RETURN_CITATIONS: false, SEARCH_DOMAIN_FILTER: [] };
      const result = client._buildSearchOptions({}, config);
      expect(result.search_domain_filter).toBeUndefined();
    });

    it('should include search_recency_filter from options', () => {
      const config = { RETURN_CITATIONS: false, SEARCH_DOMAIN_FILTER: [] };
      const result = client._buildSearchOptions({ searchRecencyFilter: 'month' }, config);
      expect(result.search_recency_filter).toBe('month');
    });

    it('should omit search_recency_filter when not provided', () => {
      const config = { RETURN_CITATIONS: false, SEARCH_DOMAIN_FILTER: [] };
      const result = client._buildSearchOptions({}, config);
      expect(result.search_recency_filter).toBeUndefined();
    });

    it('should combine all options when all configured', () => {
      const config = {
        RETURN_CITATIONS: true,
        SEARCH_DOMAIN_FILTER: ['example.com'],
      };
      const result = client._buildSearchOptions({ searchRecencyFilter: 'week' }, config);
      expect(result).toEqual({
        return_citations: true,
        search_domain_filter: ['example.com'],
        search_recency_filter: 'week',
      });
    });
  });

  describe('buildRequestPayload - search features integration', () => {
    const validMessages = [{ role: 'user', content: 'What is the latest WoW patch?' }];

    it('should include search options in payload', () => {
      const payload = client.buildRequestPayload(validMessages, {});
      expect(payload.return_citations).toBe(true);
    });

    it('should upgrade model for long conversations', () => {
      const longConvo = [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'tell me more' },
      ];
      const payload = client.buildRequestPayload(longConvo, {});
      expect(payload.model).toBe('sonar-pro');
    });

    it('should use default model for short conversations', () => {
      const payload = client.buildRequestPayload(validMessages, {});
      expect(payload.model).toBe('sonar');
    });

    it('should pass search_recency_filter through options', () => {
      const payload = client.buildRequestPayload(validMessages, {
        searchRecencyFilter: 'month',
      });
      expect(payload.search_recency_filter).toBe('month');
    });

    it('should pass search_domain_filter through options', () => {
      const payload = client.buildRequestPayload(validMessages, {
        searchDomainFilter: ['wowhead.com'],
      });
      expect(payload.search_domain_filter).toEqual(['wowhead.com']);
    });
  });

  describe('handleResponse - token usage logging', () => {
    const logger = require('../../../src/utils/logger');

    it('should log token usage when usage field is present', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const mockResponse = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
        },
      };

      await client.handleResponse(mockResponse);

      expect(infoSpy).toHaveBeenCalledWith(
        'API Usage: prompt=10, completion=20, total=30'
      );
      infoSpy.mockRestore();
    });

    it('should not log usage when usage field is absent', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const mockResponse = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'response' } }],
          }),
        },
      };

      await client.handleResponse(mockResponse);

      const usageCalls = infoSpy.mock.calls.filter((call) => call[0].includes('API Usage'));
      expect(usageCalls).toHaveLength(0);
      infoSpy.mockRestore();
    });
  });
});
