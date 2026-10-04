/**
 * API Client - Agent API request and response tests
 * Payload building (preset, tools, overrides), endpoint, empty-answer and
 * timeout handling, and token usage logging.
 */

jest.mock('undici', () => ({ request: jest.fn() }));

const { ApiClient } = require('../../../src/services/api-client');
const config = require('../../../src/config/config');
const { ERROR_TYPES } = require('../../../src/utils/error-handler');

describe('ApiClient - Agent API', () => {
  let client;
  let savedPerplexity;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ApiClient('test-key', 'https://api.perplexity.ai');
    savedPerplexity = { ...config.API.PERPLEXITY };
    jest.useFakeTimers({ now: new Date('2026-10-04T08:30:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.assign(config.API.PERPLEXITY, savedPerplexity);
  });

  describe('getChatEndpoint', () => {
    it('always targets the Agent API', () => {
      expect(client.getChatEndpoint()).toBe('/v1/agent');
    });
  });

  describe('buildRequestPayload', () => {
    const messages = [
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: 'What is the latest WoW patch?' },
    ];

    it('builds the default medium-preset payload with web search and fetch_url', () => {
      expect(client.buildRequestPayload(messages, {})).toEqual({
        preset: 'medium',
        input: [{ type: 'message', role: 'user', content: 'What is the latest WoW patch?' }],
        instructions:
          'Today is 2026-10-04.\n\nBe helpful.\n\n' +
          'If someone asks what model, AI or API you use, tell them: you run on the Perplexity Agent API (/v1/agent) with the "medium" preset, and the preset picks the model (not reported yet).',
        tools: [{ type: 'web_search' }, { type: 'fetch_url' }],
        max_output_tokens: 4096,
      });
    });

    it('passes search filters through to the web_search tool', () => {
      const payload = client.buildRequestPayload(messages, {
        searchRecencyFilter: 'month',
        searchDomainFilter: ['wowhead.com'],
      });
      expect(payload.tools).toEqual([
        {
          type: 'web_search',
          filters: { search_domain_filter: ['wowhead.com'], search_recency_filter: 'month' },
        },
        { type: 'fetch_url' },
      ]);
    });

    it('applies configured model and reasoning effort overrides', () => {
      config.API.PERPLEXITY.AGENT_MODEL = 'anthropic/claude-sonnet-5-5';
      config.API.PERPLEXITY.AGENT_REASONING_EFFORT = 'low';
      const payload = client.buildRequestPayload(messages, { maxTokens: 500 });
      expect(payload.model).toBe('anthropic/claude-sonnet-5-5');
      expect(payload.reasoning).toEqual({ effort: 'low' });
      expect(payload.max_output_tokens).toBe(500);
    });

    it('omits model and reasoning when no overrides are configured', () => {
      config.API.PERPLEXITY.AGENT_MODEL = '';
      config.API.PERPLEXITY.AGENT_REASONING_EFFORT = '';
      const payload = client.buildRequestPayload(messages, {});
      expect(payload.model).toBeUndefined();
      expect(payload.reasoning).toBeUndefined();
    });

    it('rejects an empty messages array', () => {
      expect(() => client.buildRequestPayload([], {})).toThrow('Messages array cannot be empty');
    });
  });

  describe('_validateChoiceContent', () => {
    it('throws when the model returned an empty answer', () => {
      expect(() =>
        client._validateChoiceContent({ message: { role: 'assistant', content: '  ' } })
      ).toThrow('Invalid response: the model returned an empty answer');
    });

    it('accepts a non-empty answer', () => {
      expect(() =>
        client._validateChoiceContent({ message: { role: 'assistant', content: 'Hi' } })
      ).not.toThrow();
    });
  });

  describe('handleRequestError', () => {
    it('maps an AbortSignal timeout to a timed-out API error', () => {
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      const result = client.handleRequestError(timeout);
      expect(result.message).toBe('Request timed out: The operation was aborted due to timeout');
      expect(result.type).toBe(ERROR_TYPES.API_ERROR);
    });

    it('maps other failures to a network error', () => {
      const result = client.handleRequestError(new Error('ECONNRESET'));
      expect(result.message).toBe('Request failed: ECONNRESET');
      expect(result.type).toBe(ERROR_TYPES.NETWORK_ERROR);
    });

    it('passes through errors that already carry a status code', () => {
      const httpError = new Error('API request failed with status 500');
      httpError.statusCode = 500;
      expect(client.handleRequestError(httpError)).toBe(httpError);
    });

    it('keeps an empty-answer error typed as an API error end to end', async () => {
      const mockResponse = {
        statusCode: 200,
        body: { json: jest.fn().mockResolvedValue({ output_text: '', status: 'incomplete' }) },
      };
      const error = await client.handleResponse(mockResponse).catch((e) => e);
      const result = client.handleRequestError(error);
      expect(result.message).toBe('Invalid response: the model returned an empty answer');
      expect(result.type).toBe(ERROR_TYPES.API_ERROR);
    });

    it('still wraps malformed JSON as a parse failure', async () => {
      const mockResponse = {
        statusCode: 200,
        body: { json: jest.fn().mockRejectedValue(new Error('Unexpected token <')) },
      };
      await expect(client.handleResponse(mockResponse)).rejects.toThrow(
        'Failed to parse API response: Unexpected token <'
      );
    });
  });

  describe('reported model', () => {
    it('remembers the model from a reply and names it in the next request', async () => {
      await client.handleResponse({
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({ output_text: 'hi', model: 'openai/gpt-6-luna' }),
        },
      });
      expect(client.lastModel).toBe('openai/gpt-6-luna');

      const payload = client.buildRequestPayload([{ role: 'user', content: 'what model?' }], {});
      expect(
        payload.instructions.endsWith('the "medium" preset, and the model is openai/gpt-6-luna.')
      ).toBe(true);
      expect(payload.model).toBeUndefined();
    });
  });

  describe('handleResponse - token usage logging', () => {
    const logger = require('../../../src/utils/logger');

    it('logs Agent API token usage', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const mockResponse = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            output_text: 'response',
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
          }),
        },
      };

      await client.handleResponse(mockResponse);

      expect(infoSpy).toHaveBeenCalledWith('API Usage: prompt=10, completion=20, total=30');
      infoSpy.mockRestore();
    });

    it('does not log usage when usage field is absent', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const mockResponse = {
        statusCode: 200,
        body: { json: jest.fn().mockResolvedValue({ output_text: 'response' }) },
      };

      await client.handleResponse(mockResponse);

      const usageCalls = infoSpy.mock.calls.filter((call) => call[0].includes('API Usage'));
      expect(usageCalls).toHaveLength(0);
      infoSpy.mockRestore();
    });
  });
});
