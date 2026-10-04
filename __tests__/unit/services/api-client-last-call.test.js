/**
 * API Client - last call recording for the /diag command
 */

jest.mock('undici', () => ({ request: jest.fn() }));

const { ApiClient } = require('../../../src/services/api-client');

describe('ApiClient - last call recording', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ApiClient('test-key', 'https://api.perplexity.ai');
    jest.useFakeTimers({ now: new Date('2026-10-04T08:30:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const { request } = require('undici');

  it('records a successful call with model, usage and sources', async () => {
    jest.setSystemTime(new Date('2026-10-04T14:00:00.000Z'));
    request.mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          output_text: 'OK',
          model: 'openai/gpt-6-luna',
          usage: {
            input_tokens: 10,
            output_tokens: 2,
            total_tokens: 12,
            cost: { total_cost: 0.001 },
            tool_calls_details: { search_web: { invocation: 1 } },
          },
          output: [{ type: 'search_results', results: [{ url: 'https://a.com' }] }],
        }),
      },
    });
    const payload = client.buildRequestPayload([{ role: 'user', content: 'ping' }], {});
    await client.makeRequest('/v1/agent', payload);

    expect(client.lastCall).toEqual({
      at: '2026-10-04T14:00:00.000Z',
      durationMs: 0,
      ok: true,
      preset: 'medium',
      model: 'openai/gpt-6-luna',
      turns: 1,
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      details: { cachedTokens: 0, costUsd: 0.001, toolCalls: { search_web: 1 } },
      citations: 1,
      error: null,
    });
  });

  it('records a failed call with the classified error', async () => {
    jest.setSystemTime(new Date('2026-10-04T15:00:00.000Z'));
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    request.mockRejectedValue(timeout);
    const payload = client.buildRequestPayload([{ role: 'user', content: 'ping' }], {});

    await expect(client.makeRequest('/v1/agent', payload)).rejects.toThrow(
      'Request timed out: aborted'
    );
    expect(client.lastCall).toEqual({
      at: '2026-10-04T15:00:00.000Z',
      durationMs: 0,
      ok: false,
      preset: 'medium',
      model: '',
      turns: 1,
      usage: undefined,
      details: undefined,
      citations: 0,
      error: 'Request timed out: aborted',
    });
  });
});
