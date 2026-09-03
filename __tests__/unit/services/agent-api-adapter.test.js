/**
 * Tests for the Perplexity Agent API adapter.
 *
 * The request/response mapping was validated against the live /v1/agent
 * endpoint (preset-based models, `input` message array, web_search tool,
 * `output[].content[].text`). These tests lock that mapping in.
 */

const {
  buildAgentRequest,
  normalizeAgentResponse,
  extractOutputText,
  extractCitations,
  normalizeUsage,
} = require('../../../src/services/perplexity-secure/helpers/agentApiAdapter');

const PERPLEXITY = {
  AGENT_PRESET: 'low',
  DEFAULT_TEMPERATURE: 0.2,
  MAX_TOKENS: { CHAT: 1024 },
  SEARCH_DOMAIN_FILTER: [],
};

describe('buildAgentRequest', () => {
  const messages = [
    { role: 'system', content: 'be concise' },
    { role: 'user', content: 'what is the drop rate' },
    { role: 'assistant', content: 'about 1%' },
    { role: 'user', content: 'and for the rare version?' },
  ];

  it('uses a preset, builds an input message array, and lifts system to instructions', () => {
    const req = buildAgentRequest(messages, 'sonar-pro', {}, PERPLEXITY);
    expect(req.preset).toBe('low');
    expect(req.model).toBeUndefined();
    expect(req.messages).toBeUndefined();
    expect(req.instructions).toBe('be concise');
    expect(req.input).toEqual([
      { type: 'message', role: 'user', content: 'what is the drop rate' },
      { type: 'message', role: 'assistant', content: 'about 1%' },
      { type: 'message', role: 'user', content: 'and for the rare version?' },
    ]);
  });

  it('enables web search and carries temperature + max_output_tokens (not max_tokens)', () => {
    const req = buildAgentRequest(messages, 'sonar', { temperature: 0.5 }, PERPLEXITY);
    expect(req.tools).toEqual([{ type: 'web_search' }]);
    expect(req.temperature).toBe(0.5);
    expect(req.max_output_tokens).toBe(1024);
    expect(req.max_tokens).toBeUndefined();
  });

  it('puts domain and recency filters under the web_search tool', () => {
    const cfg = { ...PERPLEXITY, SEARCH_DOMAIN_FILTER: ['wowhead.com'] };
    const req = buildAgentRequest(messages, 'sonar', { searchRecencyFilter: 'month' }, cfg);
    expect(req.tools).toEqual([
      {
        type: 'web_search',
        filters: { search_domain_filter: ['wowhead.com'], search_recency_filter: 'month' },
      },
    ]);
  });

  it('defaults the preset to low when unset', () => {
    const req = buildAgentRequest(messages, 'sonar', {}, { MAX_TOKENS: { CHAT: 100 } });
    expect(req.preset).toBe('low');
    expect(req.max_output_tokens).toBe(100);
  });

  it('handles a non-array messages input safely', () => {
    const req = buildAgentRequest(null, 'sonar', {}, PERPLEXITY);
    expect(req.input).toEqual([]);
  });
});

describe('extractOutputText', () => {
  it('reads output[].content[].text (the Agent message shape)', () => {
    expect(
      extractOutputText({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'the answer' }] }],
      })
    ).toBe('the answer');
  });

  it('concatenates multiple text parts across items', () => {
    expect(
      extractOutputText({
        output: [
          { type: 'message', content: [{ text: 'foo ' }, { text: 'bar' }] },
          { type: 'message', content: [{ text: 'baz' }] },
        ],
      })
    ).toBe('foo barbaz');
  });

  it('prefers a top-level output_text when present', () => {
    expect(extractOutputText({ output_text: 'hello' })).toBe('hello');
  });

  it('falls back to a legacy choices shape', () => {
    expect(extractOutputText({ choices: [{ message: { content: 'legacy' } }] })).toBe('legacy');
  });

  it('returns empty string for unrecognised shapes', () => {
    expect(extractOutputText({})).toBe('');
    expect(extractOutputText(null)).toBe('');
  });
});

describe('extractCitations', () => {
  it('gathers urls from an output[] search-results item', () => {
    expect(
      extractCitations({
        output: [{ type: 'search_results', results: [{ url: 'https://a.com' }, { url: 'https://b.com' }] }],
      })
    ).toEqual(['https://a.com', 'https://b.com']);
  });

  it('gathers urls from message content annotations', () => {
    expect(
      extractCitations({
        output: [
          { type: 'message', content: [{ text: 'x', annotations: [{ url: 'https://c.com' }] }] },
        ],
      })
    ).toEqual(['https://c.com']);
  });

  it('reads a top-level citations array and dedupes across sources', () => {
    expect(
      extractCitations({
        citations: ['https://a.com'],
        output: [{ results: [{ url: 'https://a.com' }, { url: 'https://d.com' }] }],
      })
    ).toEqual(['https://a.com', 'https://d.com']);
  });

  it('returns [] when absent', () => {
    expect(extractCitations({})).toEqual([]);
  });
});

describe('normalizeUsage', () => {
  it('maps input/output tokens onto prompt/completion token names', () => {
    expect(normalizeUsage({ input_tokens: 10, output_tokens: 5, total_tokens: 15 })).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it('returns undefined when usage is missing', () => {
    expect(normalizeUsage(undefined)).toBeUndefined();
  });
});

describe('normalizeAgentResponse', () => {
  it('produces a Chat Completions shape from an Agent response', () => {
    const normalized = normalizeAgentResponse({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'the answer', annotations: [{ url: 'https://src.com' }] }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });
    expect(normalized.choices[0].message).toEqual({ role: 'assistant', content: 'the answer' });
    expect(normalized.citations).toEqual(['https://src.com']);
    expect(normalized.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
  });

  it('omits citations when there are none', () => {
    const normalized = normalizeAgentResponse({ output: [{ content: [{ text: 'x' }] }] });
    expect(normalized).not.toHaveProperty('citations');
    expect(normalized.choices[0].message.content).toBe('x');
  });
});
