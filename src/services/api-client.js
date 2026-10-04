/**
 * API Client for making HTTP requests to Perplexity API
 * Handles request building, headers, and basic HTTP operations
 */
const { request } = require('undici');
const config = require('../config/config');
const logger = require('../utils/logger');
const { ErrorHandler, ERROR_TYPES } = require('../utils/error-handler');
const {
  buildAgentRequest,
  normalizeAgentResponse,
} = require('./perplexity-secure/helpers/agentApiAdapter');

/**
 * API Client class for handling HTTP requests
 */
class ApiClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    // Model Perplexity reported on the last reply, so the bot can say what it
    // runs on when the preset (not us) picks the model.
    this.lastModel = '';
    // Summary of the most recent request, for the /diag command.
    this.lastCall = null;
  }

  /**
   * Build request headers
   * @returns {Object} Request headers
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build an Agent API request payload
   * @param {Array} messages - Conversation messages
   * @param {Object} options - Request options
   * @returns {Object} Request payload
   */
  buildRequestPayload(messages, options = {}) {
    // Validate messages array
    if (!Array.isArray(messages)) {
      logger.error('Invalid messages parameter - not an array:', typeof messages);
      throw ErrorHandler.createError('Messages must be an array', ERROR_TYPES.VALIDATION_ERROR);
    }

    if (messages.length === 0) {
      logger.error('Empty messages array provided to buildRequestPayload');
      throw ErrorHandler.createError(
        'Messages array cannot be empty',
        ERROR_TYPES.VALIDATION_ERROR
      );
    }

    // Validate message format
    const invalidMessages = messages.filter((msg) => !msg.role || !msg.content);
    if (invalidMessages.length > 0) {
      logger.error('Invalid message format detected:', JSON.stringify(invalidMessages));
      throw ErrorHandler.createError(
        'All messages must have role and content fields',
        ERROR_TYPES.VALIDATION_ERROR
      );
    }

    const payload = buildAgentRequest(
      messages,
      { lastModel: this.lastModel, ...options },
      config.API.PERPLEXITY
    );
    logger.info(
      `API Request: preset="${payload.preset}", model="${payload.model || 'preset default'}", turns=${payload.input.length}, max_output_tokens=${payload.max_output_tokens}`
    );
    if (process.env.DEBUG === 'true') {
      logger.debug('Full request payload:', JSON.stringify(payload, null, 2));
    }
    return payload;
  }

  /**
   * Make API request
   * @param {string} endpoint - API endpoint
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, payload) {
    const fullUrl = this.baseUrl + endpoint;
    const startedAt = Date.now();

    // Log request details for debugging
    logger.info(`Making API request to: ${endpoint}`);

    try {
      // Hard timeout so a stalled upstream can't hang the request forever.
      // Agent runs that search and fetch pages routinely take 10-60s.
      const timeoutMs = config.RATE_LIMITS?.API_TIMEOUT_MS || 120000;
      const response = await request(fullUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const body = await this.handleResponse(response);
      this._recordCall(startedAt, payload, body, null);
      return body;
    } catch (error) {
      // Log the error with request context
      logger.error(`API request failed for endpoint ${endpoint}:`, error.message);
      const handled = this.handleRequestError(error);
      this._recordCall(startedAt, payload, null, handled);
      throw handled;
    }
  }

  /**
   * Remember a summary of the last request for diagnostics.
   * @param {number} startedAt - Epoch ms the request started
   * @param {Object} payload - Request payload sent
   * @param {Object|null} body - Normalised response body on success
   * @param {Error|null} error - Classified error on failure
   * @private
   */
  _recordCall(startedAt, payload, body, error) {
    this.lastCall = {
      at: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      ok: !error,
      preset: payload?.preset,
      model: body?.model || payload?.model || '',
      turns: Array.isArray(payload?.input) ? payload.input.length : 0,
      usage: body?.usage,
      details: body?.usage_details,
      citations: Array.isArray(body?.citations) ? body.citations.length : 0,
      error: error ? error.message : null,
    };
  }

  /**
   * Resolve the chat endpoint (the Agent API is the only chat path).
   * @returns {string} Endpoint path
   */
  getChatEndpoint() {
    return config.API.PERPLEXITY.ENDPOINTS.AGENT;
  }

  /**
   * Handle API response
   * @param {Object} response - HTTP response
   * @returns {Promise<Object>} Parsed response
   */
  async handleResponse(response) {
    if (!response) {
      throw ErrorHandler.createError(
        'Empty response received from the service.',
        ERROR_TYPES.API_ERROR
      );
    }

    const statusCode = response.statusCode || response.status;

    if (statusCode >= 400) {
      await this.handleErrorResponse(statusCode, response.body);
    }

    try {
      const raw = await response.body.json();

      // Normalise the Agent API response into the Chat Completions shape so the
      // rest of the pipeline is unchanged.
      const body = normalizeAgentResponse(raw);
      if (body.model) this.lastModel = body.model;

      // Validate response structure
      this._validateResponseStructure(body);
      this._validateChoiceContent(body.choices[0]);

      // Log token usage if available
      if (body.usage) {
        logger.info(
          `API Usage: prompt=${body.usage.prompt_tokens}, completion=${body.usage.completion_tokens}, total=${body.usage.total_tokens}`
        );
      }

      return body;
    } catch (parseError) {
      // Validation errors raised above are already typed; only wrap JSON failures.
      if (parseError.type) throw parseError;
      throw ErrorHandler.createError(
        `Failed to parse API response: ${parseError.message}`,
        ERROR_TYPES.API_ERROR
      );
    }
  }

  /**
   * Validate response has required structure
   * @param {Object} body - Response body
   * @private
   */
  _validateResponseStructure(body) {
    if (!body || !body.choices || !Array.isArray(body.choices) || body.choices.length === 0) {
      throw ErrorHandler.createError(
        'Invalid response: missing or empty choices array',
        ERROR_TYPES.API_ERROR
      );
    }
  }

  /**
   * Validate choice object has required content
   * @param {Object} choice - Choice object from response
   * @private
   */
  _validateChoiceContent(choice) {
    if (!choice || (!choice.message && !choice.text && !choice.content)) {
      throw ErrorHandler.createError(
        'Invalid response: missing content in choices',
        ERROR_TYPES.API_ERROR
      );
    }
    // An agent run that ran out of steps or output tokens returns no text; an
    // empty reply would make Discord reject the embed, so fail loudly instead.
    const text = choice.message?.content ?? choice.text ?? choice.content;
    if (typeof text === 'string' && text.trim() === '') {
      throw ErrorHandler.createError(
        'Invalid response: the model returned an empty answer',
        ERROR_TYPES.API_ERROR
      );
    }
  }

  /**
   * Handle error responses
   * @param {number} statusCode - HTTP status code
   * @param {Object} body - Response body
   */
  async handleErrorResponse(statusCode, body) {
    let responseText = 'Could not read response body';

    if (body && typeof body.text === 'function') {
      try {
        responseText = await body.text();
      } catch (textError) {
        responseText = `Error reading response body: ${textError.message}`;
      }
    }

    // Log 400 errors with more detail for troubleshooting
    if (statusCode === 400) {
      logger.error(`API 400 Error - Bad Request. Response: ${responseText}`);
    }

    const errorMessage = `API request failed with status ${statusCode}: ${responseText.substring(
      0,
      config.MESSAGE_LIMITS.ERROR_MESSAGE_MAX_LENGTH
    )}${responseText.length > config.MESSAGE_LIMITS.ERROR_MESSAGE_MAX_LENGTH ? '...' : ''}`;

    const error = ErrorHandler.createError(errorMessage, ERROR_TYPES.API_ERROR);
    error.statusCode = statusCode;
    throw error;
  }

  /**
   * Handle request errors
   * @param {Error} error - Request error
   * @returns {Error} Enhanced error
   */
  handleRequestError(error) {
    if (error.statusCode || error.type) {
      return error; // Already classified (HTTP status or response validation)
    }

    if (error.name === 'TimeoutError') {
      return ErrorHandler.createError(`Request timed out: ${error.message}`, ERROR_TYPES.API_ERROR);
    }
    return ErrorHandler.createError(`Request failed: ${error.message}`, ERROR_TYPES.NETWORK_ERROR);
  }
}

module.exports = { ApiClient };
