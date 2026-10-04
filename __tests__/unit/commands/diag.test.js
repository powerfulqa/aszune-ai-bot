/**
 * /diag owner-only diagnostics command
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  diagCommand,
  buildDiagEmbed,
  configSourceSection,
  lastCallSection,
  aiSettingsSection,
  readGitCommit,
  formatDuration,
} = require('../../../src/commands/diag');

const OWNER = '111111111111111111';
const tempRoots = [];

afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

function makeRoot({ env, head, refs = {}, packed } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'));
  tempRoots.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  if (env !== undefined) fs.writeFileSync(path.join(root, '.env'), env);
  if (head !== undefined) {
    fs.mkdirSync(path.join(root, '.git', 'refs', 'heads'), { recursive: true });
    fs.writeFileSync(path.join(root, '.git', 'HEAD'), head);
    for (const [ref, hash] of Object.entries(refs)) {
      fs.writeFileSync(path.join(root, '.git', ref), hash);
    }
    if (packed) fs.writeFileSync(path.join(root, '.git', 'packed-refs'), packed);
  }
  return root;
}

function makeConfig(overrides = {}) {
  return {
    BOT_OWNER_IDS: [OWNER],
    MAX_HISTORY: 30,
    SESSION_TIMEOUT_MS: 2 * 60 * 60 * 1000,
    RATE_LIMITS: { API_TIMEOUT_MS: 120000 },
    COLORS: { PRIMARY: 0x0099ff },
    API: {
      PERPLEXITY: {
        ENDPOINTS: { AGENT: '/v1/agent' },
        AGENT_PRESET: 'medium',
        AGENT_MODEL: '',
        AGENT_REASONING_EFFORT: '',
        FETCH_URL: true,
        MAX_TOKENS: { CHAT: 4096 },
        SEARCH_DOMAIN_FILTER: [],
        ...overrides,
      },
    },
  };
}

const OK_CALL = {
  at: '2026-10-04T14:00:00.000Z',
  durationMs: 6700,
  ok: true,
  preset: 'medium',
  model: 'openai/gpt-6-luna',
  turns: 3,
  usage: { prompt_tokens: 3681, completion_tokens: 780, total_tokens: 4461 },
  details: { cachedTokens: 1200, costUsd: 0.03282, toolCalls: { search_web: 1, fetch_url: 0 } },
  citations: 4,
  error: null,
};

describe('formatDuration', () => {
  it('formats seconds, hours and days', () => {
    expect(formatDuration(75)).toBe('1m 15s');
    expect(formatDuration(3 * 3600 + 120)).toBe('3h 2m');
    expect(formatDuration(2 * 86400 + 5 * 3600)).toBe('2d 5h');
    expect(formatDuration(-5)).toBe('0m 0s');
  });
});

describe('readGitCommit', () => {
  it('reads the branch ref file', () => {
    const root = makeRoot({
      head: 'ref: refs/heads/main\n',
      refs: { 'refs/heads/main': '3d7da34abcdef0123456789\n' },
    });
    expect(readGitCommit(root)).toBe('3d7da34');
  });

  it('falls back to packed-refs', () => {
    const root = makeRoot({
      head: 'ref: refs/heads/main\n',
      packed: '# pack-refs\nabc1234ffff refs/heads/main\n',
    });
    expect(readGitCommit(root)).toBe('abc1234');
  });

  it('handles a detached HEAD and a missing repo', () => {
    expect(readGitCommit(makeRoot({ head: 'deadbeefcafe\n' }))).toBe('deadbee');
    expect(readGitCommit(makeRoot())).toBe('unknown');
  });
});

describe('aiSettingsSection', () => {
  it('shows the running settings with the reported model', () => {
    expect(aiSettingsSection(makeConfig(), { lastModel: 'openai/gpt-6-luna' })).toBe(
      [
        'Endpoint `/v1/agent` · preset `medium`',
        'Model: `openai/gpt-6-luna` (reported by Perplexity)',
        'Reasoning: preset default · tools: web_search, fetch_url',
        'Max output 4096 tok · timeout 120s',
        'History 30 msgs · session 120 min · domain filter: none',
      ].join('\n')
    );
  });

  it('prefers a pinned model and lists overrides', () => {
    const config = makeConfig({
      AGENT_MODEL: 'anthropic/claude-sonnet-5-5',
      AGENT_REASONING_EFFORT: 'low',
      FETCH_URL: false,
      SEARCH_DOMAIN_FILTER: ['wowhead.com'],
    });
    const lines = aiSettingsSection(config, { lastModel: 'openai/gpt-6-luna' }).split('\n');
    expect(lines[1]).toBe('Model: `anthropic/claude-sonnet-5-5` (pinned)');
    expect(lines[2]).toBe('Reasoning: low · tools: web_search');
    expect(lines[4]).toBe('History 30 msgs · session 120 min · domain filter: wowhead.com');
  });

  it('says when the model is not known yet', () => {
    const lines = aiSettingsSection(makeConfig(), { lastModel: '' }).split('\n');
    expect(lines[1]).toBe(
      'Model: picked by preset, not reported yet (ask the bot something first)'
    );
  });
});

describe('configSourceSection', () => {
  it('confirms when running values match .env', () => {
    const root = makeRoot({ env: 'AGENT_PRESET=medium\n' });
    expect(configSourceSection(root, { AGENT_PRESET: 'medium' })).toBe(
      '✅ Running values match .env'
    );
  });

  it('flags a PM2 environment shadowing .env', () => {
    const root = makeRoot({ env: 'AGENT_PRESET=medium\nAGENT_MODEL=x/y\n' });
    expect(configSourceSection(root, { AGENT_PRESET: 'low' })).toBe(
      [
        '⚠️ `AGENT_PRESET`: running `low`, .env says `medium`',
        '⚠️ `AGENT_MODEL`: running `(unset)`, .env says `x/y`',
        'PM2 holds an older copy of the environment. Fix: `VAR=value pm2 restart aszune-ai --update-env` then `pm2 save`',
      ].join('\n')
    );
  });

  it('reports a missing .env', () => {
    expect(configSourceSection(makeRoot(), {})).toBe(
      'No readable .env file; running purely on process environment'
    );
  });
});

describe('lastCallSection', () => {
  const now = Date.parse('2026-10-04T14:03:00.000Z');

  it('summarises a successful call', () => {
    expect(lastCallSection(OK_CALL, now)).toBe(
      [
        '✅ 3m 0s ago · 6.7s · `openai/gpt-6-luna` · 3 turns',
        'in 3681 (cached 1200) / out 780 tok · $0.0328',
        'tools: search_web×1 · 4 sources',
      ].join('\n')
    );
  });

  it('shows the error for a failed call', () => {
    const failed = { ...OK_CALL, ok: false, model: '', error: 'Request timed out: aborted' };
    expect(lastCallSection(failed, now)).toBe(
      '❌ 3m 0s ago · 6.7s · model n/a · 3 turns\nError: Request timed out: aborted'
    );
  });

  it('handles missing usage details and no calls', () => {
    const bare = { ...OK_CALL, usage: undefined, details: undefined, citations: 0 };
    expect(lastCallSection(bare, now).split('\n').slice(1)).toEqual([
      'in ? (cached 0) / out ? tok · cost n/a',
      'tools: none · 0 sources',
    ]);
    expect(lastCallSection(null, now)).toBe('No API calls since start-up');
  });
});

describe('diag command', () => {
  function makeDeps(overrides = {}) {
    return {
      config: makeConfig(),
      perplexityService: {
        getRuntimeInfo: jest.fn(() => ({ lastModel: 'openai/gpt-6-luna', lastCall: null })),
        sendChatRequest: jest.fn().mockResolvedValue({}),
      },
      conversationManager: { getHistory: jest.fn(() => [{}, {}, {}]) },
      databaseService: { getConversationHistory: jest.fn(() => new Array(7).fill({})) },
      root: makeRoot({ env: 'AGENT_PRESET=medium\n', head: 'abcdef1234\n' }),
      env: { AGENT_PRESET: 'medium' },
      ...overrides,
    };
  }

  function makeInteraction(userId, live = null) {
    return {
      user: { id: userId },
      options: { getBoolean: jest.fn(() => live) },
      reply: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
    };
  }

  it('is registered as an optional live boolean option', () => {
    expect(diagCommand.data.name).toBe('diag');
    expect(diagCommand.data.options).toEqual([
      {
        name: 'live',
        description: 'Also send a tiny real request to Perplexity (costs a fraction of a cent)',
        type: 5,
        required: false,
      },
    ]);
  });

  it('refuses non-owners privately and tells them how to allow themselves', async () => {
    const interaction = makeInteraction('222222222222222222');
    await diagCommand.execute(interaction, makeDeps());
    expect(interaction.reply).toHaveBeenCalledWith({
      content:
        "/diag is owner-only. To allow yourself, add `BOT_OWNER_IDS=222222222222222222` to the bot's environment and restart it.",
      flags: 64,
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('replies ephemerally to the owner with all sections', async () => {
    const deps = makeDeps();
    const interaction = makeInteraction(OWNER);
    await diagCommand.execute(interaction, deps);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    const { embeds } = interaction.editReply.mock.calls[0][0];
    expect(embeds[0].title).toBe('Aszai diagnostics');
    expect(embeds[0].fields.map((f) => f.name)).toEqual([
      'Build',
      'AI settings (running)',
      'Config source',
      'Last API call',
      'Your conversation',
    ]);
    expect(embeds[0].fields[0].value.split('\n')[0]).toBe('v9.9.9 · commit `abcdef1`');
    expect(embeds[0].fields[4].value).toBe('In memory: 3 msgs · stored in DB: 7');
    expect(deps.perplexityService.sendChatRequest).not.toHaveBeenCalled();
  });

  it('runs a live request when asked', async () => {
    const deps = makeDeps();
    deps.perplexityService.getRuntimeInfo
      .mockReturnValueOnce({ lastModel: '', lastCall: null })
      .mockReturnValue({ lastModel: 'openai/gpt-6-luna', lastCall: OK_CALL });
    const embed = await buildDiagEmbed(deps, OWNER, true);

    expect(deps.perplexityService.sendChatRequest).toHaveBeenCalledTimes(1);
    expect(deps.perplexityService.sendChatRequest.mock.calls[0][1]).toEqual({
      maxTokens: 512,
      reasoningEffort: 'low',
    });
    const live = embed.fields[5];
    expect(live.name).toBe('Live check');
    expect(live.value.split('\n')[0]).toBe('✅ Live request OK');
  });

  it('reports a failed live request instead of throwing', async () => {
    const deps = makeDeps();
    deps.perplexityService.sendChatRequest.mockRejectedValue(new Error('Request timed out: x'));
    const embed = await buildDiagEmbed(deps, OWNER, true);
    expect(embed.fields[5].value).toMatch(
      /^❌ Live request failed after \d+\.\ds: Request timed out: x$/
    );
  });

  it('shows a database error without failing the report', async () => {
    const deps = makeDeps({
      databaseService: {
        getConversationHistory: jest.fn(() => {
          throw new Error('locked');
        }),
      },
    });
    const embed = await buildDiagEmbed(deps, OWNER, false);
    expect(embed.fields[4].value).toBe('In memory: 3 msgs · stored in DB: DB error: locked');
  });

  it('turns an unexpected failure into a private error message', async () => {
    const deps = makeDeps();
    deps.perplexityService.getRuntimeInfo.mockImplementation(() => {
      throw new Error('boom');
    });
    const interaction = makeInteraction(OWNER);
    await diagCommand.execute(interaction, deps);
    expect(interaction.editReply).toHaveBeenCalledWith({ content: 'Diagnostics failed: boom' });
  });
});
