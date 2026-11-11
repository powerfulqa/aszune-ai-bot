/**
 * Response Processor for handling API responses
 * Extracts content, handles errors, and processes responses
 */
const config = require('../config/config');
const { ErrorHandler, ERROR_TYPES } = require('../utils/error-handler');

// Longest wait before the single 429 retry.
const MAX_RETRY_WAIT_MS = 10000;

/**
 * Response Processor class for handling API responses
 */
class ResponseProcessor {
  constructor() {
    this.retryDelay = config.RATE_LIMITS?.RETRY_DELAY_MS || 1000;
  }

  /**
   * Clean HTML tags from text content
   * @param {string} content - Text content that may contain HTML tags
   * @returns {string} - Cleaned text content
   */
  cleanHtmlTags(content) {
    if (typeof content !== 'string') {
      return content;
    }

    return (
      content
        // Replace <br> and <br/> with line breaks
        .replace(/<br\s*\/?>/gi, '\n')
        // Replace other common HTML tags with appropriate text
        .replace(/<p>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<div>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        // Remove any remaining HTML tags
        .replace(/<[^>]*>/g, '')
        // Clean up multiple consecutive line breaks
        .replace(/\n{3,}/g, '\n\n')
        // Trim whitespace
        .trim()
    );
  }

  /**
   * Extract content from API response
   * @param {Object} response - API response object
   * @returns {string} - Extracted content or default message
   */
  extractResponseContent(response) {
    try {
      // Check if response exists
      if (!response) {
        throw new Error('Empty response received from the service.');
      }

      // Check for choices array
      if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
        throw new Error('Empty response received from the service.');
      }

      // Get the first choice
      const firstChoice = response.choices[0];

      let content = '';

      // Extract content based on structure
      if (firstChoice.message && typeof firstChoice.message.content === 'string') {
        content = firstChoice.message.content;
      } else if (typeof firstChoice.text === 'string') {
        content = firstChoice.text;
      } else if (typeof firstChoice.content === 'string') {
        content = firstChoice.content;
      } else {
        // If no content found, return a default message
        return 'No content received from the service.';
      }

      // Clean HTML tags from the content
      return this.cleanHtmlTags(content);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'extracting response content');
      throw ErrorHandler.createError(
        `Failed to extract content: ${errorResponse.message}`,
        ERROR_TYPES.API_ERROR
      );
    }
  }

  /**
   * Determine if an error is retryable. Only an HTTP 429 qualifies: Perplexity
   * rejects it before the run starts and does not bill it. Timeouts and 5xx
   * are not retried because the run may already have been billed.
   * @param {Error} error - The error to check
   * @returns {boolean} - True if the error is retryable
   */
  isRetryableError(error) {
    return error?.statusCode === 429;
  }

  /**
   * Generate response, retrying once after a 429
   * @param {Function} requestFn - Function to execute the request
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} API response
   */
  async generateResponseWithRetry(requestFn, options = {}) {
    try {
      return await requestFn();
    } catch (apiError) {
      if (!options.retryOnRateLimit || !this.isRetryableError(apiError)) throw apiError;

      ErrorHandler.handleError(apiError, 'API retry');
      // Honour Retry-After, capped so a Discord user is not left waiting.
      await this.delay(Math.min(apiError.retryAfterMs || this.retryDelay, MAX_RETRY_WAIT_MS));
      return await requestFn();
    }
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize options object
   * @param {Object|boolean} options - Options to normalize
   * @returns {Object} Normalized options
   */
  normalizeOptions(options) {
    // Backward compatibility: if options is a boolean, treat as caching flag
    if (typeof options === 'boolean') {
      return { caching: options };
    }

    return options || {};
  }

  /**
   * Standardize options with defaults
   * @param {Object} options - Raw options
   * @returns {Object} Standardized options
   */
  standardizeOptions(options) {
    const normalizedOptions = this.normalizeOptions(options);

    return {
      caching: true,
      retryOnRateLimit: true,
      ...normalizedOptions,
    };
  }
}

module.exports = { ResponseProcessor };
