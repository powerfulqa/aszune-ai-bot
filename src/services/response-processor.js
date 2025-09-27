/**
 * Response Processor for handling API responses
 * Extracts content, handles errors, and processes responses
 */
const config = require('../config/config');
const { ErrorHandler, ERROR_TYPES } = require('../utils/error-handler');

/**
 * Response Processor class for handling API responses
 */
class ResponseProcessor {
  constructor() {
    this.maxRetries = config.RATE_LIMITS?.MAX_RETRIES || 3;
    this.retryDelay = config.RATE_LIMITS?.RETRY_DELAY_MS || 1000;
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

      // Extract content based on structure
      if (firstChoice.message && typeof firstChoice.message.content === 'string') {
        return firstChoice.message.content;
      }

      if (typeof firstChoice.text === 'string') {
        return firstChoice.text;
      }

      if (typeof firstChoice.content === 'string') {
        return firstChoice.content;
      }

      // If no content found, return a default message
      return 'No content received from the service.';
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'extracting response content');
      throw ErrorHandler.createError(
        `Failed to extract content: ${errorResponse.message}`,
        ERROR_TYPES.API_ERROR
      );
    }
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - True if the error is retryable
   */
  isRetryableError(error) {
    if (!error || !error.message) return false;
    
    const message = error.message.toLowerCase();
    
    // Retry on temporary/network errors
    if (message.includes('temporary') || 
        message.includes('network') || 
        message.includes('timeout') ||
        message.includes('429')) {
      return true;
    }
    
    // Don't retry on permanent errors
    if (message.includes('permanent') || 
        message.includes('invalid') ||
        message.includes('unauthorized') ||
        message.includes('forbidden')) {
      return false;
    }
    
    // Default to not retryable for unknown errors
    return false;
  }

  /**
   * Generate response with retry logic
   * @param {Function} requestFn - Function to execute the request
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} API response
   */
  async generateResponseWithRetry(requestFn, options = {}) {
    let retries = options.retryOnRateLimit ? this.maxRetries : 0;
    let retryDelay = this.retryDelay;

    try {
      return await requestFn();
    } catch (apiError) {
      // Check if it's a retryable error and we should retry
      const isRetryableError = this.isRetryableError(apiError);
      
      if (isRetryableError && retries > 0) {
        const errorResponse = ErrorHandler.handleError(apiError, 'API retry', { retries });
        
        // Wait before retrying
        await this.delay(retryDelay);

        // Retry the request
        return await requestFn();
      } else {
        throw apiError; // Not a retryable error or out of retries
      }
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
      retryOnRateLimit: false,
      ...normalizedOptions
    };
  }
}

module.exports = { ResponseProcessor };
