/**
 * Perplexity Agent API (`/v1/agent`) adapter.
 *
 * Enabled when `config.API.PERPLEXITY.USE_AGENT_API` is true (env
 * `USE_AGENT_API=true`). Sonar Chat Completions is being sunset (2026-09-27),
 * so this path migrates the bot onto the Agent API.
 *
 * Schema validated against the live endpoint (see the migration guide,
 * https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to):
 *   request:
 *     - `messages` → `input` (array of `{type:'message', role, content}` items;
 *       a system message is lifted out into the top-level `instructions`)
 *     - `model: 'sonar'/'sonar-pro'` → `preset` ('fast'/'low'; this bot uses
 *       `config.API.PERPLEXITY.AGENT_PRESET`, default 'low' = sonar-pro tier)
 *     - `max_tokens` → `max_output_tokens`
 *     - web search is opt-in: `tools: [{type:'web_search', filters:{…}}]`
 *       (legacy `search_domain_filter`/`search_recency_filter` live under
 *       `filters`)
 *   response:
 *     - assistant text lives in `output[]` message items at
 *       `content[].text` (type `output_text`); `output_text` is not returned
 *       for the sonar tiers, so we read the `output[]` tree
 *     - citations are inconsistent: gathered from any `output[]` item's
 *       `results[].url` and from `content[].annotations[]` url fields
 *
 * The adapter normalises the response back into the Chat Completions shape
 * (`{ choices: [{ message: { content } }], citations, usage }`) so the rest of
 * the pipeline (response processing, citation footer) is unchanged.
 *
 * @module perplexity-secure/helpers/agentApiAdapter
 */

/**
 * Build an Agent API request payload from a Chat-Completions-style messages
 * array and the model the caller resolved.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} model - Legacy model id ('sonar'/'sonar-pro') the caller chose
 * @param {Object} options - Request options (maxTokens, temperature, search…)
 * @param {Object} perplexityConfig - config.API.PERPLEXITY
 * @returns {Object} Agent request payload
 */
function buildAgentRequest(messages, model, options = {}, perplexityConfig = {}) {
  const list = Array.isArray(messages) ? messages : [];

  // A system message becomes top-level `instructions`; the rest become the
  // `input` conversation (multi-turn is replayed as message items).
  const instructions = list
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const input = list
    .filter((m) => m.role !== 'system')
    .map((m) => ({ type: 'message', role: m.role, content: m.content }));

  // Web search is opt-in on the Agent API; legacy search filters move under it.
  const webSearch = { type: 'web_search' };
  const filters = {};
  const domainFilter = options.searchDomainFilter || perplexityConfig.SEARCH_DOMAIN_FILTER;
  if (domainFilter && domainFilter.length > 0) filters.search_domain_filter = domainFilter;
  if (options.searchRecencyFilter) filters.search_recency_filter = options.searchRecencyFilter;
  if (Object.keys(filters).length > 0) webSearch.filters = filters;

  const request = {
    preset: perplexityConfig.AGENT_PRESET || 'low',
    input,
    tools: [webSearch],
    max_output_tokens: options.maxTokens || perplexityConfig.MAX_TOKENS?.CHAT,
  };
  const temperature = options.temperature ?? perplexityConfig.DEFAULT_TEMPERATURE;
  if (temperature !== undefined) request.temperature = temperature;
  if (instructions) request.instructions = instructions;

  return request;
}

/**
 * Extract the assistant text from an Agent response body.
 * Reads the `output[]` tree (message items → `content[].text`) with fallbacks
 * to a top-level `output_text` and to a legacy `choices` shape.
 * @param {Object} body
 * @returns {string}
 */
function extractOutputText(body) {
  if (!body || typeof body !== 'object') return '';
  if (typeof body.output_text === 'string' && body.output_text) return body.output_text;

  if (Array.isArray(body.output)) {
    const texts = [];
    for (const item of body.output) {
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (typeof c?.text === 'string') texts.push(c.text);
        }
      } else if (typeof item?.text === 'string') {
        texts.push(item.text);
      } else if (typeof item?.content === 'string') {
        texts.push(item.content);
      }
    }
    if (texts.length > 0) return texts.join('');
  }

  if (typeof body.choices?.[0]?.message?.content === 'string') {
    return body.choices[0].message.content;
  }
  return '';
}

/**
 * Extract citation URLs from an Agent response body (best-effort — the Agent API
 * surfaces citations inconsistently across tiers).
 * @param {Object} body
 * @returns {Array<string>}
 */
function extractCitations(body) {
  const urls = new Set();
  const add = (u) => {
    if (typeof u === 'string' && u) urls.add(u);
  };

  if (Array.isArray(body?.citations)) body.citations.forEach(add);
  if (Array.isArray(body?.search_results)) body.search_results.forEach((r) => add(r?.url));

  if (Array.isArray(body?.output)) {
    for (const item of body.output) {
      if (Array.isArray(item?.results)) item.results.forEach((r) => add(r?.url));
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (Array.isArray(c?.annotations)) {
            c.annotations.forEach((a) => add(a?.url || a?.uri || a?.source?.url));
          }
        }
      }
    }
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
 * Normalise an Agent response into the Chat Completions shape the rest of the
 * codebase expects.
 * @param {Object} body - Raw Agent response body
 * @returns {Object} `{ choices: [{ message: { role, content } }], citations, usage }`
 */
function normalizeAgentResponse(body) {
  const content = extractOutputText(body);
  const normalized = {
    choices: [{ message: { role: 'assistant', content } }],
    usage: normalizeUsage(body?.usage),
  };
  const citations = extractCitations(body);
  if (citations.length > 0) normalized.citations = citations;
  return normalized;
}

module.exports = {
  buildAgentRequest,
  normalizeAgentResponse,
  extractOutputText,
  extractCitations,
  normalizeUsage,
};
