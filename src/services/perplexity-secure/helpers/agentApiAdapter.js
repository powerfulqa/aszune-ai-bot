/**
 * Perplexity Agent API (`/v1/agent`) adapter.
 *
 * The Agent API is the bot's only chat path: Perplexity retired Sonar Chat
 * Completions on 2026-09-27. Request shape per
 * https://docs.perplexity.ai/docs/agent-api/presets and /conversation-state:
 *   request:
 *     - `input` is the replayed conversation (`{type:'message', role, content}`
 *       items); the system message is lifted into top-level `instructions`,
 *       prefixed with today's date so web-search answers are anchored in time
 *     - `preset` supplies defaults (model, reasoning, steps, tools); `model`
 *       and `reasoning.effort` override it when configured
 *     - `tools` merge per tool with the preset's own set: we list `web_search`
 *       (with any domain/recency filters) and `fetch_url` so pasted links can
 *       be read mid-conversation
 *     - no `temperature`: the API rejects it alongside a preset
 *   response:
 *     - assistant text lives in `output[]` message items at `content[].text`,
 *       with `output_text` as a shortcut when present
 *     - citations come from `output[]` items' `results[].url` and from
 *       `content[].annotations[]` url fields
 *
 * The adapter normalises the response back into the Chat Completions shape
 * (`{ choices: [{ message: { content } }], citations, usage }`) so the rest of
 * the pipeline (response processing, citation footer) is unchanged.
 *
 * @module perplexity-secure/helpers/agentApiAdapter
 */

/**
 * Describe the bot's own runtime so it can answer "what model are you?".
 * The model is the pinned AGENT_MODEL, else the one Perplexity reported on the
 * last response, else unknown until the first reply comes back.
 * @param {string} preset
 * @param {string} [model]
 * @returns {string}
 */
function describeRuntime(preset, model) {
  const modelText = model
    ? `the model is ${model}`
    : 'the preset picks the model (not reported yet)';
  return (
    `If someone asks what model, AI or API you use, tell them: you run on the Perplexity ` +
    `Agent API (/v1/agent) with the "${preset}" preset, and ${modelText}.`
  );
}

/**
 * Build the `instructions` string: today's date, the system messages, then a
 * note on the runtime (API, preset, model).
 * @param {Array<{role: string, content: string}>} list
 * @param {Date} now
 * @param {string} [runtime] - Output of describeRuntime
 * @returns {string}
 */
function buildInstructions(list, now = new Date(), runtime = '') {
  const system = list
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  return [`Today is ${now.toISOString().slice(0, 10)}.`, system, runtime]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build the tools list: web search (with filters) plus URL fetching.
 * @param {Object} options - Request options (searchDomainFilter, searchRecencyFilter)
 * @param {Object} perplexityConfig - config.API.PERPLEXITY
 * @returns {Array<Object>}
 */
function buildTools(options, perplexityConfig) {
  const webSearch = { type: 'web_search' };
  const filters = {};
  const domainFilter = options.searchDomainFilter || perplexityConfig.SEARCH_DOMAIN_FILTER;
  if (domainFilter && domainFilter.length > 0) filters.search_domain_filter = domainFilter;
  if (options.searchRecencyFilter) filters.search_recency_filter = options.searchRecencyFilter;
  if (Object.keys(filters).length > 0) webSearch.filters = filters;

  const tools = [webSearch];
  if (perplexityConfig.FETCH_URL !== false) tools.push({ type: 'fetch_url' });
  return tools;
}

/**
 * Build an Agent API request payload from a Chat-Completions-style messages
 * array.
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} options - Request options (maxTokens, reasoningEffort,
 *   lastModel — the model Perplexity reported last time, search…)
 * @param {Object} perplexityConfig - config.API.PERPLEXITY
 * @returns {Object} Agent request payload
 */
function buildAgentRequest(messages, options = {}, perplexityConfig = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const input = list
    .filter((m) => m.role !== 'system')
    .map((m) => ({ type: 'message', role: m.role, content: m.content }));

  const preset = perplexityConfig.AGENT_PRESET || 'medium';
  const runtime = describeRuntime(preset, perplexityConfig.AGENT_MODEL || options.lastModel);
  const request = {
    preset,
    input,
    instructions: buildInstructions(list, new Date(), runtime),
    tools: buildTools(options, perplexityConfig),
    max_output_tokens: options.maxTokens || perplexityConfig.MAX_TOKENS?.CHAT,
  };
  if (perplexityConfig.AGENT_MODEL) request.model = perplexityConfig.AGENT_MODEL;
  const effort = options.reasoningEffort || perplexityConfig.AGENT_REASONING_EFFORT;
  if (effort) request.reasoning = { effort };

  return request;
}

/**
 * Extract the assistant text from an Agent response body.
 * Reads a top-level `output_text`, falling back to the `output[]` tree
 * (message items → `content[].text`).
 * @param {Object} body
 * @returns {string}
 */
function textFromOutputItem(item) {
  if (Array.isArray(item?.content)) {
    return item.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('');
  }
  if (typeof item?.text === 'string') return item.text;
  if (typeof item?.content === 'string') return item.content;
  return '';
}

function extractOutputText(body) {
  if (!body || typeof body !== 'object') return '';
  if (typeof body.output_text === 'string' && body.output_text) return body.output_text;
  if (Array.isArray(body.output)) {
    const text = body.output.map(textFromOutputItem).join('');
    if (text) return text;
  }
  return '';
}

/**
 * Extract citation URLs from an Agent response body (best-effort — the Agent API
 * surfaces citations inconsistently across tiers).
 * @param {Object} body
 * @returns {Array<string>}
 */
function annotationUrls(content) {
  const out = [];
  for (const c of content || []) {
    for (const a of c?.annotations || []) {
      out.push(a?.url || a?.uri || a?.source?.url);
    }
  }
  return out;
}

function urlsFromOutputItem(item) {
  const out = [];
  if (Array.isArray(item?.results)) out.push(...item.results.map((r) => r?.url));
  if (Array.isArray(item?.content)) out.push(...annotationUrls(item.content));
  return out;
}

/**
 * Place search results by their own 1-based `id`, which is what the model's
 * `[web:N]` markers point at. Ids are global across every search in the turn,
 * so list order is NOT the same thing once the agent searches twice.
 * @param {Object} body
 * @returns {Array<string>} Sparse array (index id-1 = url); [] when no ids
 */
function citationsById(body) {
  const byId = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    for (const r of Array.isArray(item?.results) ? item.results : []) {
      if (Number.isInteger(r?.id) && r.id >= 1 && typeof r.url === 'string' && r.url) {
        byId[r.id - 1] = r.url;
      }
    }
  }
  return byId;
}

function extractCitations(body) {
  const byId = citationsById(body);
  if (byId.length > 0) return Array.from(byId, (u) => u || null);

  const urls = new Set();
  const add = (u) => {
    if (typeof u === 'string' && u) urls.add(u);
  };

  if (Array.isArray(body?.citations)) body.citations.forEach(add);
  if (Array.isArray(body?.search_results)) body.search_results.forEach((r) => add(r?.url));
  if (Array.isArray(body?.output)) {
    for (const item of body.output) urlsFromOutputItem(item).forEach(add);
  }

  return Array.from(urls);
}

/**
 * Map Agent API usage (input_tokens/output_tokens) onto the Chat Completions
 * field names the rest of the pipeline logs.
 * @param {Object} usage
 * @returns {Object|undefined}
 */
function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return undefined;
  return {
    prompt_tokens: usage.prompt_tokens ?? usage.input_tokens,
    completion_tokens: usage.completion_tokens ?? usage.output_tokens,
    total_tokens: usage.total_tokens,
  };
}

/**
 * Pull the diagnostic extras out of Agent API usage: cached input tokens, the
 * billed cost and how many times each tool ran.
 * @param {Object} usage - Raw Agent API usage object
 * @returns {Object|undefined} `{ cachedTokens, costUsd, toolCalls }`
 */
function summarizeUsageDetails(usage) {
  if (!usage || typeof usage !== 'object') return undefined;
  const toolCalls = {};
  for (const [name, detail] of Object.entries(usage.tool_calls_details || {})) {
    toolCalls[name] = detail?.invocation ?? 0;
  }
  return {
    cachedTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    costUsd: usage.cost?.total_cost,
    toolCalls,
  };
}

/**
 * Convert the Agent API's `[web:N]` inline citation markers to plain `[N]` so
 * they match the numbered citation footer the rest of the pipeline renders.
 * @param {string} text
 * @returns {string}
 */
function normalizeInlineCitations(text) {
  return typeof text === 'string' ? text.replace(/\[web:(\d+)\]/g, '[$1]') : text;
}

/**
 * Normalise an Agent response into the Chat Completions shape the rest of the
 * codebase expects.
 * @param {Object} body - Raw Agent response body
 * @returns {Object} `{ choices: [{ message: { role, content } }], citations, usage }`
 */
function normalizeAgentResponse(body) {
  const content = normalizeInlineCitations(extractOutputText(body));
  const normalized = {
    choices: [{ message: { role: 'assistant', content } }],
    usage: normalizeUsage(body?.usage),
  };
  if (typeof body?.model === 'string' && body.model) normalized.model = body.model;
  const details = summarizeUsageDetails(body?.usage);
  if (details) normalized.usage_details = details;
  const citations = extractCitations(body);
  if (citations.length > 0) normalized.citations = citations;
  return normalized;
}

module.exports = {
  buildAgentRequest,
  buildInstructions,
  buildTools,
  describeRuntime,
  normalizeAgentResponse,
  extractOutputText,
  extractCitations,
  normalizeUsage,
  summarizeUsageDetails,
  normalizeInlineCitations,
};
