/**
 * Perplexity Agent API (`/v1/agent`) adapter — FLAG-GATED FOUNDATION.
 *
 * ⚠️ NOT YET VALIDATED against the live endpoint. Enabled only when
 * `config.API.PERPLEXITY.USE_AGENT_API` is true (env `USE_AGENT_API=true`),
 * which defaults OFF. The request/response field mapping below is a best-effort
 * reading of the migration guide
 * (https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview):
 *   - request:  `messages` array  → single `input`
 *   - response: `choices[0].message.content` → `output_text` (or an `output[]` array)
 *   - the legacy search options become Agent "preset" configuration
 * Confirm the exact schema against a live call before turning the flag on.
 *
 * The adapter normalises the Agent response back into the Chat Completions
 * shape (`{ choices: [{ message: { content } }], citations, usage }`) so the
 * rest of the pipeline (response processing, citation footer) is unchanged.
 *
 * @module perplexity-secure/helpers/agentApiAdapter
 */

/**
 * Build an Agent API request payload from a Chat-Completions-style messages
 * array and a pre-selected model.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} model - Model already resolved by the caller
 * @param {Object} options - Request options (maxTokens, temperature, search…)
 * @param {Object} perplexityConfig - config.API.PERPLEXITY
 * @returns {Object} Agent request payload
 */
function buildAgentRequest(messages, model, options = {}, perplexityConfig = {}) {
  // Flatten the conversation into a single role-prefixed input string. The
  // trailing user turn is what the agent should act on; earlier turns give it
  // context.
  const input = (Array.isArray(messages) ? messages : [])
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const request = {
    model,
    input,
    max_tokens: options.maxTokens || perplexityConfig.MAX_TOKENS?.CHAT,
    temperature: options.temperature ?? perplexityConfig.DEFAULT_TEMPERATURE,
  };

  // Search preset (Agent API groups search controls under a preset rather than
  // per-request params). Domain filter carries over from the legacy config.
  const domainFilter = options.searchDomainFilter || perplexityConfig.SEARCH_DOMAIN_FILTER;
  const search = {};
  if (perplexityConfig.RETURN_CITATIONS) search.return_citations = true;
  if (domainFilter && domainFilter.length > 0) search.domain_filter = domainFilter;
  if (options.searchRecencyFilter) search.recency_filter = options.searchRecencyFilter;
  if (Object.keys(search).length > 0) request.search = search;

  return request;
}

/**
 * Extract the assistant text from an Agent response body.
 * Handles the documented `output_text`, an `output[]` array of items, and falls
 * back to a legacy `choices` shape if the endpoint returns one.
 * @param {Object} body
 * @returns {string}
 */
function extractOutputText(body) {
  if (!body || typeof body !== 'object') return '';
  if (typeof body.output_text === 'string') return body.output_text;
  if (Array.isArray(body.output)) {
    return body.output
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.content === 'string') return item.content;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('');
  }
  if (typeof body.choices?.[0]?.message?.content === 'string') {
    return body.choices[0].message.content;
  }
  return '';
}

/**
 * Extract citation URLs from an Agent response body (best-effort).
 * @param {Object} body
 * @returns {Array}
 */
function extractCitations(body) {
  if (Array.isArray(body?.citations)) return body.citations;
  if (Array.isArray(body?.search_results)) {
    return body.search_results.map((r) => r?.url).filter(Boolean);
  }
  return [];
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
    usage: body?.usage,
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
};
