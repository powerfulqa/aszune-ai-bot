/**
 * Tests for the flag-gated Perplexity Agent API adapter.
 * The adapter is OFF by default; these tests exercise the transformation logic
 * in isolation. End-to-end behaviour against the live /v1/agent endpoint is NOT
 * covered here (see the adapter header) and must be validated before enabling.
 */

const {
  buildAgentRequest,
  normalizeAgentResponse,
  extractOutputText,
  extractCitations,
} = require('../../../src/services/perplexity-secure/helpers/agentApiAdapter');

const PERPLEXITY = {
  DEFAULT_TEMPERATURE: 0.2,
  MAX_TOKENS: { CHAT: 1024 },
  RETURN_CITATIONS: true,
  SEARCH_DOMAIN_FILTER: [],
};

describe('buildAgentRequest', () => {
  const messages = [
    { role: 'user', content: 'what is the drop rate' },
    { role: 'assistant', content: 'about 1%' },
    { role: 'user', content: 'and for the rare version?' },
  ];

  it('flattens messages into a single role-prefixed input', () => {
    const req = buildAgentRequest(messages, 'sonar-pro', {}, PERPLEXITY);
    expect(req.model).toBe('sonar-pro');
    expect(req.input).toBe(
      'user: what is the drop rate\nassistant: about 1%\nuser: and for the rare version?'
    );
    expect(req.messages).toBeUndefined(); // no legacy messages array
  });

  it('carries temperature and max_tokens from config/options', () => {
    const req = buildAgentRequest(messages, 'sonar', { temperature: 0.5 }, PERPLEXITY);
    expect(req.temperature).toBe(0.5);
    expect(req.max_tokens).toBe(1024);
  });

  it('includes a search preset with citations and domain filter', () => {
    const cfg = { ...PERPLEXITY, SEARCH_DOMAIN_FILTER: ['wowhead.com'] };
    const req = buildAgentRequest(messages, 'sonar', { searchRecencyFilter: 'month' }, cfg);
    expect(req.search).toEqual({
      return_citations: true,
      domain_filter: ['wowhead.com'],
      recency_filter: 'month',
    });
  });

  it('omits the search preset when nothing is configured', () => {
    const req = buildAgentRequest(messages, 'sonar', {}, { MAX_TOKENS: { CHAT: 100 } });
    expect(req.search).toBeUndefined();
  });

  it('handles a non-array messages input safely', () => {
    const req = buildAgentRequest(null, 'sonar', {}, PERPLEXITY);
    expect(req.input).toBe('');
  });
});

describe('extractOutputText', () => {
  it('reads output_text', () => {
    expect(extractOutputText({ output_text: 'hello' })).toBe('hello');
  });

  it('concatenates an output[] array of items', () => {
    expect(
      extractOutputText({ output: [{ content: 'foo ' }, { text: 'bar' }, 'baz'] })
    ).toBe('foo barbaz');
  });

  it('falls back to a legacy choices shape', () => {
    expect(
      extractOutputText({ choices: [{ message: { content: 'legacy' } }] })
    ).toBe('legacy');
  });

  it('returns empty string for unrecognised shapes', () => {
    expect(extractOutputText({})).toBe('');
    expect(extractOutputText(null)).toBe('');
  });
});

describe('extractCitations', () => {
  it('reads a citations array', () => {
    expect(extractCitations({ citations: ['https://a.com'] })).toEqual(['https://a.com']);
  });

  it('maps search_results to urls', () => {
    expect(
      extractCitations({ search_results: [{ url: 'https://b.com' }, { url: 'https://c.com' }] })
    ).toEqual(['https://b.com', 'https://c.com']);
  });

  it('returns [] when absent', () => {
    expect(extractCitations({})).toEqual([]);
  });
});

describe('normalizeAgentResponse', () => {
  it('produces a Chat Completions shape from an Agent response', () => {
    const normalized = normalizeAgentResponse({
      output_text: 'the answer',
      citations: ['https://src.com'],
      usage: { total_tokens: 42 },
    });
    expect(normalized.choices[0].message).toEqual({ role: 'assistant', content: 'the answer' });
    expect(normalized.citations).toEqual(['https://src.com']);
    expect(normalized.usage).toEqual({ total_tokens: 42 });
  });

  it('omits citations when there are none', () => {
    const normalized = normalizeAgentResponse({ output_text: 'x' });
    expect(normalized).not.toHaveProperty('citations');
    expect(normalized.choices[0].message.content).toBe('x');
  });
});
