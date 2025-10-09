/**
 * API Client for making HTTP requests to Perplexity API
 * Handles request building, headers, and basic HTTP operations
 */
const { request } = require('undici');
const config = require('../config/config');
const logger = require('../utils/logger');
const { ErrorHandler, ERROR_TYPES } = require('../utils/error-handler');

/**
 * API Client class for handling HTTP requests
 */
class ApiClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
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
   * Build request payload for chat completions
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
      throw ErrorHandler.createError('Messages array cannot be empty', ERROR_TYPES.VALIDATION_ERROR);
    }

    // Validate message format
    const invalidMessages = messages.filter(msg => !msg.role || !msg.content);
    if (invalidMessages.length > 0) {
      logger.error('Invalid message format detected:', JSON.stringify(invalidMessages));
      throw ErrorHandler.createError('All messages must have role and content fields', ERROR_TYPES.VALIDATION_ERROR);
    }

    const payload = {
      model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
      messages: messages,
      max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
      temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE,
    };

    // Log full payload for debugging production issues
    logger.info(`API Request: model="${payload.model}", messages=${messages.length}, first_message_role="${messages[0]?.role}"`);
    if (process.env.DEBUG === 'true') {
      logger.debug('Full payload:', JSON.stringify(payload, null, 2));
    }

    // Enable streaming if requested and not in low CPU mode
    if (options.stream && !this.isLowCpuMode()) {
      payload.stream = true;
    }

    return payload;
  }

  /**
   * Check if running in low CPU mode
   * @returns {boolean} True if in low CPU mode
   */
  isLowCpuMode() {
    try {
      return Boolean(config.PI_OPTIMIZATIONS?.ENABLED && config.PI_OPTIMIZATIONS?.LOW_CPU_MODE);
    } catch {
      return false;
    }
  }

  /**
   * Make API request
   * @param {string} endpoint - API endpoint
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, payload) {
    const fullUrl = this.baseUrl + endpoint;

    // Log request details for debugging
    logger.info(`Making API request to: ${endpoint}`);
    logger.info(`Request payload summary: model=${payload.model}, messages=${payload.messages?.length || 0}, temperature=${payload.temperature}`);

    try {
      const response = await request(fullUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      return await this.handleResponse(response);
    } catch (error) {
      // Log the error with request context
      logger.error(`API request failed for endpoint ${endpoint}:`, error.message);
      throw this.handleRequestError(error);
    }
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
      const body = await response.body.json();

      // Validate response structure
      if (!body || !body.choices || !Array.isArray(body.choices) || body.choices.length === 0) {
        throw ErrorHandler.createError(
          'Invalid response: missing or empty choices array',
          ERROR_TYPES.API_ERROR
        );
      }

      const firstChoice = body.choices[0];
      if (!firstChoice || (!firstChoice.message && !firstChoice.text && !firstChoice.content)) {
        throw ErrorHandler.createError(
          'Invalid response: missing content in choices',
          ERROR_TYPES.API_ERROR
        );
      }

      return body;
    } catch (parseError) {
      throw ErrorHandler.createError(
        `Failed to parse API response: ${parseError.message}`,
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
    if (error.statusCode) {
      return error; // Already handled by handleErrorResponse
    }

    return ErrorHandler.createError(`Request failed: ${error.message}`, ERROR_TYPES.NETWORK_ERROR);
  }
}

module.exports = { ApiClient };
