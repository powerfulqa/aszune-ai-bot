/**
 * /diag - owner-only diagnostics, replied ephemerally (only the caller sees it).
 *
 * One command that reports everything needed to confirm the bot is running the
 * expected build and configuration: version and commit, the Agent API settings
 * it is really using, whether PM2's stored environment is shadowing .env, the
 * last API call (latency, model, tokens, cost, tool use) and the caller's
 * conversation state. `live: true` also sends a tiny real request end to end.
 */
const fs = require('fs');
const path = require('path');
const { ApplicationCommandOptionType, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');

// Settings whose running value can silently differ from .env when PM2 holds an
// older copy of the environment (dotenv never overrides an existing variable).
const ENV_KEYS_TO_COMPARE = [
  'AGENT_PRESET',
  'AGENT_MODEL',
  'AGENT_REASONING_EFFORT',
  'AGENT_FETCH_URL',
  'SEARCH_DOMAIN_FILTER',
];

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

/**
 * Short commit hash of the checked-out code, read from .git without a shell.
 * @param {string} root - Repository root
 * @returns {string} 7-char hash or 'unknown'
 */
function readGitCommit(root) {
  try {
    const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head.slice(0, 7);
    const ref = head.slice(5);
    const refFile = path.join(root, '.git', ref);
    if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim().slice(0, 7);
    const packed = fs.readFileSync(path.join(root, '.git', 'packed-refs'), 'utf8');
    const line = packed.split('\n').find((l) => l.endsWith(` ${ref}`));
    return line ? line.slice(0, 7) : 'unknown';
  } catch {
    return 'unknown';
  }
}

function readPackageVersion(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function buildSection(root) {
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const host = process.env.PI_HARDWARE_MODEL || process.platform;
  return [
    `v${readPackageVersion(root)} · commit \`${readGitCommit(root)}\``,
    `Node ${process.version} · up ${formatDuration(process.uptime())} · ${host} · RSS ${rssMb} MB`,
  ].join('\n');
}

function describeModel(p, runtime) {
  if (p.AGENT_MODEL) return `\`${p.AGENT_MODEL}\` (pinned)`;
  if (runtime.lastModel) return `\`${runtime.lastModel}\` (reported by Perplexity)`;
  return 'picked by preset, not reported yet (ask the bot something first)';
}

function aiSettingsSection(config, runtime) {
  const p = config.API.PERPLEXITY;
  const tools = ['web_search', ...(p.FETCH_URL !== false ? ['fetch_url'] : [])];
  const filter = p.SEARCH_DOMAIN_FILTER?.length ? p.SEARCH_DOMAIN_FILTER.join(', ') : 'none';
  const sessionMin = Math.round((config.SESSION_TIMEOUT_MS || 0) / 60000);
  const timeoutS = Math.round((config.RATE_LIMITS?.API_TIMEOUT_MS || 0) / 1000);
  return [
    `Endpoint \`${p.ENDPOINTS.AGENT}\` · preset \`${p.AGENT_PRESET}\``,
    `Model: ${describeModel(p, runtime)}`,
    `Reasoning: ${p.AGENT_REASONING_EFFORT || 'preset default'} · tools: ${tools.join(', ')}`,
    `Max output ${p.MAX_TOKENS.CHAT} tok · timeout ${timeoutS}s`,
    `History ${config.MAX_HISTORY} msgs · session ${sessionMin} min · domain filter: ${filter}`,
  ].join('\n');
}

/**
 * Compare the running environment with the .env file on disk.
 * @param {string} root - Repository root
 * @param {Object} env - Running environment (process.env)
 * @returns {string}
 */
function configSourceSection(root, env) {
  let fileValues;
  try {
    const { parse } = require('dotenv');
    fileValues = parse(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  } catch {
    return 'No readable .env file; running purely on process environment';
  }
  const mismatches = ENV_KEYS_TO_COMPARE.filter(
    (key) => (env[key] ?? '') !== (fileValues[key] ?? '')
  ).map(
    (key) =>
      `⚠️ \`${key}\`: running \`${env[key] ?? '(unset)'}\`, .env says \`${fileValues[key] ?? '(unset)'}\``
  );
  if (mismatches.length === 0) return '✅ Running values match .env';
  return [
    ...mismatches,
    'PM2 holds an older copy of the environment. Fix: `VAR=value pm2 restart aszune-ai --update-env` then `pm2 save`',
  ].join('\n');
}

function formatToolCalls(toolCalls) {
  const entries = Object.entries(toolCalls || {}).filter(([, n]) => n > 0);
  return entries.length ? entries.map(([name, n]) => `${name}×${n}`).join(', ') : 'none';
}

function formatCallUsage(call) {
  const u = call.usage || {};
  const d = call.details || {};
  const cost = typeof d.costUsd === 'number' ? `$${d.costUsd.toFixed(4)}` : 'cost n/a';
  return [
    `in ${u.prompt_tokens ?? '?'} (cached ${d.cachedTokens ?? 0}) / out ${u.completion_tokens ?? '?'} tok · ${cost}`,
    `tools: ${formatToolCalls(d.toolCalls)} · ${call.citations} sources`,
  ].join('\n');
}

function lastCallSection(call, now = Date.now()) {
  if (!call) return 'No API calls since start-up';
  const ago = formatDuration((now - Date.parse(call.at)) / 1000);
  const model = call.model ? `\`${call.model}\`` : 'model n/a';
  const secs = (call.durationMs / 1000).toFixed(1);
  const head = `${call.ok ? '✅' : '❌'} ${ago} ago · ${secs}s · ${model} · ${call.turns} turns`;
  if (!call.ok) return `${head}\nError: ${String(call.error).slice(0, 300)}`;
  return `${head}\n${formatCallUsage(call)}`;
}

function conversationSection(userId, deps) {
  const inMemory = deps.conversationManager.getHistory(userId)?.length ?? 0;
  let stored;
  try {
    stored = deps.databaseService.getConversationHistory(userId, 1000).length;
  } catch (error) {
    stored = `DB error: ${error.message}`;
  }
  return `In memory: ${inMemory} msgs · stored in DB: ${stored}`;
}

async function liveCheckSection(perplexityService) {
  const started = Date.now();
  try {
    await perplexityService.sendChatRequest(
      [{ role: 'user', content: `Diagnostic ping ${started}. Reply with just: OK` }],
      { maxTokens: 512, reasoningEffort: 'low' }
    );
    const call = perplexityService.getRuntimeInfo().lastCall;
    return `✅ Live request OK\n${lastCallSection(call)}`;
  } catch (error) {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    return `❌ Live request failed after ${secs}s: ${error.message}`;
  }
}

/**
 * Assemble the diagnostics embed.
 * @param {Object} deps - { config, perplexityService, conversationManager, databaseService, root, env }
 * @param {string} userId - Caller's Discord user ID
 * @param {boolean} live - Also send a real request
 * @returns {Promise<Object>} Discord embed object
 */
async function buildDiagEmbed(deps, userId, live) {
  const runtime = deps.perplexityService.getRuntimeInfo();
  const fields = [
    { name: 'Build', value: buildSection(deps.root) },
    { name: 'AI settings (running)', value: aiSettingsSection(deps.config, runtime) },
    { name: 'Config source', value: configSourceSection(deps.root, deps.env) },
    { name: 'Last API call', value: lastCallSection(runtime.lastCall) },
    { name: 'Your conversation', value: conversationSection(userId, deps) },
  ];
  if (live) {
    fields.push({ name: 'Live check', value: await liveCheckSection(deps.perplexityService) });
  }
  return {
    title: 'Aszai diagnostics',
    color: deps.config.COLORS.PRIMARY,
    fields: fields.map((f) => ({ name: f.name, value: f.value.slice(0, 1024) })),
    timestamp: new Date().toISOString(),
  };
}

function defaultDeps() {
  return {
    config: require('../config/config'),
    perplexityService: require('../services/perplexity-secure'),
    conversationManager: require('../state/conversationManager'),
    databaseService: require('../services/database'),
    root: path.resolve(__dirname, '..', '..'),
    env: process.env,
  };
}

const diagCommand = {
  data: {
    name: 'diag',
    description: 'Owner only: show bot version, AI settings and last API call',
    options: [
      {
        name: 'live',
        description: 'Also send a tiny real request to Perplexity (costs a fraction of a cent)',
        type: ApplicationCommandOptionType.Boolean,
        required: false,
      },
    ],
  },
  async execute(interaction, deps = defaultDeps()) {
    const userId = interaction.user.id;
    if (!deps.config.BOT_OWNER_IDS.includes(userId)) {
      return interaction.reply({
        content: `/diag is owner-only. To allow yourself, add \`BOT_OWNER_IDS=${userId}\` to the bot's environment and restart it.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const live = interaction.options?.getBoolean?.('live') ?? false;
    try {
      const embed = await buildDiagEmbed(deps, userId, live);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`/diag failed: ${error.message}`);
      return interaction.editReply({ content: `Diagnostics failed: ${error.message}` });
    }
  },
};

module.exports = {
  diagCommand,
  buildDiagEmbed,
  configSourceSection,
  lastCallSection,
  aiSettingsSection,
  readGitCommit,
  formatDuration,
};
