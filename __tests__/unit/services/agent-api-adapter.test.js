/**
 * Tests for the Perplexity Agent API adapter.
 *
 * The request/response mapping follows the /v1/agent docs (preset-based
 * defaults, `input` message array, web_search + fetch_url tools,
 * `output[].content[].text`). These tests lock that mapping in.
 */

const {
  buildAgentRequest,
  buildInstructions,
  buildTools,
  describeRuntime,
  normalizeAgentResponse,
  extractOutputText,
  extractCitations,
  normalizeUsage,
  normalizeInlineCitations,
} = require('../../../src/services/perplexity-secure/helpers/agentApiAdapter');

const RUNTIME_UNKNOWN =
  'If someone asks what model, AI or API you use, tell them: you run on the Perplexity Agent API (/v1/agent) with the "medium" preset, and the preset picks the model (not reported yet).';

const PERPLEXITY = {
  AGENT_PRESET: 'medium',
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

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-04T23:59:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds the full preset request with dated instructions and both tools', () => {
    expect(buildAgentRequest(messages, {}, PERPLEXITY)).toEqual({
      preset: 'medium',
      input: [
        { type: 'message', role: 'user', content: 'what is the drop rate' },
        { type: 'message', role: 'assistant', content: 'about 1%' },
        { type: 'message', role: 'user', content: 'and for the rare version?' },
      ],
      instructions: `Today is 2026-10-04.\n\nbe concise\n\n${RUNTIME_UNKNOWN}`,
      tools: [{ type: 'web_search' }, { type: 'fetch_url' }],
      max_output_tokens: 1024,
    });
  });

  it('never sends temperature with a preset (the Agent API rejects the combination)', () => {
    const req = buildAgentRequest(messages, { temperature: 0.5 }, PERPLEXITY);
    expect(req).not.toHaveProperty('temperature');
  });

  it('applies AGENT_MODEL and reasoning effort overrides', () => {
    const cfg = {
      ...PERPLEXITY,
      AGENT_MODEL: 'anthropic/claude-sonnet-5-5',
      AGENT_REASONING_EFFORT: 'high',
    };
    const req = buildAgentRequest(messages, {}, cfg);
    expect(req.model).toBe('anthropic/claude-sonnet-5-5');
    expect(req.reasoning).toEqual({ effort: 'high' });
  });

  it('lets a per-request reasoning effort beat the configured one', () => {
    const cfg = { ...PERPLEXITY, AGENT_REASONING_EFFORT: 'high' };
    const req = buildAgentRequest(messages, { reasoningEffort: 'low' }, cfg);
    expect(req.reasoning).toEqual({ effort: 'low' });
  });

  it('defaults the preset to medium when unset', () => {
    const req = buildAgentRequest(messages, {}, { MAX_TOKENS: { CHAT: 100 } });
    expect(req.preset).toBe('medium');
    expect(req.max_output_tokens).toBe(100);
    expect(req.model).toBeUndefined();
    expect(req.reasoning).toBeUndefined();
  });

  it('handles a non-array messages input safely', () => {
    const req = buildAgentRequest(null, {}, PERPLEXITY);
    expect(req.input).toEqual([]);
    expect(req.instructions).toBe(`Today is 2026-10-04.\n\n${RUNTIME_UNKNOWN}`);
  });

  it('names the model Perplexity reported last time', () => {
    const req = buildAgentRequest(messages, { lastModel: 'openai/gpt-6-luna' }, PERPLEXITY);
    expect(
      req.instructions.endsWith('the "medium" preset, and the model is openai/gpt-6-luna.')
    ).toBe(true);
  });

  it('prefers a pinned AGENT_MODEL over the last reported model', () => {
    const req = buildAgentRequest(
      messages,
      { lastModel: 'openai/gpt-6-luna' },
      { ...PERPLEXITY, AGENT_MODEL: 'anthropic/claude-sonnet-5-5' }
    );
    expect(
      req.instructions.endsWith(
        'the "medium" preset, and the model is anthropic/claude-sonnet-5-5.'
      )
    ).toBe(true);
  });
});

describe('describeRuntime', () => {
  it('describes a known model', () => {
    expect(describeRuntime('high', 'openai/gpt-6-sol')).toBe(
      'If someone asks what model, AI or API you use, tell them: you run on the Perplexity ' +
        'Agent API (/v1/agent) with the "high" preset, and the model is openai/gpt-6-sol.'
    );
  });

  it('says the preset picks the model when none is known', () => {
    expect(describeRuntime('medium')).toBe(RUNTIME_UNKNOWN);
  });
});

describe('buildInstructions', () => {
  it('joins several system messages after the date line', () => {
    const list = [
      { role: 'system', content: 'one' },
      { role: 'user', content: 'hi' },
      { role: 'system', content: 'two' },
    ];
    expect(buildInstructions(list, new Date('2026-01-02T00:00:00Z'))).toBe(
      'Today is 2026-01-02.\n\none\ntwo'
    );
  });

  it('appends the runtime note last', () => {
    expect(buildInstructions([], new Date('2026-01-02T00:00:00Z'), 'runtime note')).toBe(
      'Today is 2026-01-02.\n\nruntime note'
    );
  });
});

describe('buildTools', () => {
  it('enables web_search and fetch_url by default', () => {
    expect(buildTools({}, { SEARCH_DOMAIN_FILTER: [] })).toEqual([
      { type: 'web_search' },
      { type: 'fetch_url' },
    ]);
  });

  it('drops fetch_url when FETCH_URL is false', () => {
    expect(buildTools({}, { FETCH_URL: false })).toEqual([{ type: 'web_search' }]);
  });

  it('puts domain and recency filters under the web_search tool', () => {
    expect(
      buildTools({ searchRecencyFilter: 'month' }, { SEARCH_DOMAIN_FILTER: ['wowhead.com'] })
    ).toEqual([
      {
        type: 'web_search',
        filters: { search_domain_filter: ['wowhead.com'], search_recency_filter: 'month' },
      },
      { type: 'fetch_url' },
    ]);
  });

  it('prefers a per-request domain filter over config', () => {
    expect(
      buildTools({ searchDomainFilter: ['a.com'] }, { SEARCH_DOMAIN_FILTER: ['b.com'] })[0]
    ).toEqual({ type: 'web_search', filters: { search_domain_filter: ['a.com'] } });
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

  it('no longer reads the retired Chat Completions choices shape', () => {
    expect(extractOutputText({ choices: [{ message: { content: 'legacy' } }] })).toBe('');
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
        output: [
          { type: 'search_results', results: [{ url: 'https://a.com' }, { url: 'https://b.com' }] },
        ],
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

describe('normalizeInlineCitations', () => {
  it('converts [web:N] markers to plain [N]', () => {
    expect(normalizeInlineCitations('Released in 2017 [web:2] by Team Cherry [web:10].')).toBe(
      'Released in 2017 [2] by Team Cherry [10].'
    );
  });

  it('leaves text without markers unchanged and passes through non-strings', () => {
    expect(normalizeInlineCitations('no markers here')).toBe('no markers here');
    expect(normalizeInlineCitations(undefined)).toBeUndefined();
  });
});

describe('normalizeAgentResponse', () => {
  it('carries the model Perplexity reported', () => {
    expect(normalizeAgentResponse({ output_text: 'hi', model: 'openai/gpt-6-luna' })).toEqual({
      choices: [{ message: { role: 'assistant', content: 'hi' } }],
      usage: undefined,
      model: 'openai/gpt-6-luna',
    });
  });

  it('omits model when the response has none', () => {
    expect(normalizeAgentResponse({ output_text: 'hi' })).toEqual({
      choices: [{ message: { role: 'assistant', content: 'hi' } }],
      usage: undefined,
    });
  });

  it('normalises [web:N] markers in the answer text', () => {
    const normalized = normalizeAgentResponse({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'See [web:1].' }] }],
    });
    expect(normalized.choices[0].message.content).toBe('See [1].');
  });

  it('produces a Chat Completions shape from an Agent response', () => {
    const normalized = normalizeAgentResponse({
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'the answer', annotations: [{ url: 'https://src.com' }] },
          ],
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
