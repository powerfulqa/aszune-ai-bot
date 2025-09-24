/**
 * Centralized Error Handler
 * Provides consistent error handling patterns across the application
 */
const logger = require('./logger');
const config = require('../config/config');

/**
 * Error types for categorization
 */
const ERROR_TYPES = {
  API_ERROR: 'API_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * HTTP status code mappings
 */
const HTTP_STATUS_MESSAGES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

class ErrorHandler {
  /**
   * Categorize an error based on its properties
   * @param {Error} error - The error to categorize
   * @returns {string} - Error type category
   */
  static categorizeError(error) {
    if (!error) return ERROR_TYPES.UNKNOWN_ERROR;

    const message = error.message || '';
    const code = error.code || '';
    const statusCode = error.statusCode || error.status;

    // Check each error category in order of specificity
    const apiErrorType = this._categorizeApiError(statusCode, message);
    if (apiErrorType) return apiErrorType;

    const fileErrorType = this._categorizeFileError(code);
    if (fileErrorType) return fileErrorType;

    const memoryErrorType = this._categorizeMemoryError(message, code);
    if (memoryErrorType) return memoryErrorType;

    const configErrorType = this._categorizeConfigError(message);
    if (configErrorType) return configErrorType;

    const validationErrorType = this._categorizeValidationError(message);
    if (validationErrorType) return validationErrorType;

    return ERROR_TYPES.UNKNOWN_ERROR;
  }

  static _categorizeApiError(statusCode, message) {
    if (!statusCode && !message.includes('API') && !message.includes('HTTP')) {
      return null;
    }

    if (statusCode === 429 || message.includes('429') || message.includes('rate limit')) {
      return ERROR_TYPES.RATE_LIMIT_ERROR;
    }
    if (statusCode >= 400 && statusCode < 500) {
      return ERROR_TYPES.API_ERROR;
    }
    if (statusCode >= 500) {
      return ERROR_TYPES.NETWORK_ERROR;
    }
    return ERROR_TYPES.API_ERROR;
  }

  static _categorizeFileError(code) {
    if (!code || !['ENOENT', 'EACCES', 'EMFILE', 'ENFILE'].includes(code)) {
      return null;
    }

    if (code === 'EACCES') {
      return ERROR_TYPES.PERMISSION_ERROR;
    }
    return ERROR_TYPES.FILE_ERROR;
  }

  static _categorizeMemoryError(message, code) {
    if (message.includes('memory') || message.includes('heap') || code === 'ENOMEM') {
      return ERROR_TYPES.MEMORY_ERROR;
    }
    return null;
  }

  static _categorizeConfigError(message) {
    if (message.includes('config') || message.includes('environment')) {
      return ERROR_TYPES.CONFIG_ERROR;
    }
    return null;
  }

  static _categorizeValidationError(message) {
    if (message.includes('validation') || message.includes('invalid')) {
      return ERROR_TYPES.VALIDATION_ERROR;
    }
    return null;
  }

  /**
   * Get user-friendly error message based on error type
   * @param {string} errorType - The categorized error type
   * @param {Error} originalError - The original error object
   * @returns {string} - User-friendly error message
   */
  static getUserFriendlyMessage(errorType) {
    const messages = {
      [ERROR_TYPES.API_ERROR]: 'The service is temporarily unavailable. Please try again later.',
      [ERROR_TYPES.RATE_LIMIT_ERROR]:
        'The service is currently busy. Please wait a moment and try again.',
      [ERROR_TYPES.NETWORK_ERROR]:
        'Network connection issue. Please check your connection and try again.',
      [ERROR_TYPES.FILE_ERROR]: 'File operation failed. Please try again or contact support.',
      [ERROR_TYPES.PERMISSION_ERROR]: 'Permission denied. Please contact an administrator.',
      [ERROR_TYPES.MEMORY_ERROR]:
        'System is experiencing high memory usage. Please try again later.',
      [ERROR_TYPES.CONFIG_ERROR]: 'Configuration error. Please contact an administrator.',
      [ERROR_TYPES.VALIDATION_ERROR]:
        'Invalid input provided. Please check your request and try again.',
      [ERROR_TYPES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again later.',
    };

    return messages[errorType] || messages[ERROR_TYPES.UNKNOWN_ERROR];
  }

  /**
   * Handle and log an error with consistent formatting
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {Object} additionalData - Additional data to log
   * @returns {Object} - Standardized error response
   */
  static handleError(error, context = '', additionalData = {}) {
    const errorType = this.categorizeError(error);
    const userMessage = this.getUserFriendlyMessage(errorType, error);

    // Enhanced error logging with structured data
    const errorLog = {
      type: errorType,
      context: context,
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode || error.status,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    // Log based on error severity
    if (errorType === ERROR_TYPES.RATE_LIMIT_ERROR) {
      logger.warn(`Rate limit error in ${context}:`, errorLog);
    } else if (errorType === ERROR_TYPES.MEMORY_ERROR) {
      logger.error(`Memory error in ${context}:`, errorLog);
    } else {
      logger.error(`Error in ${context}:`, errorLog);
    }

    return {
      type: errorType,
      message: userMessage,
      context: context,
      timestamp: errorLog.timestamp,
      originalError: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }

  /**
   * Handle API-specific errors
   * @param {Error} error - The API error
   * @param {string} endpoint - The API endpoint that failed
   * @returns {Object} - Standardized error response
   */
  static handleApiError(error, endpoint = '') {
    const context = `API call to ${endpoint}`;
    this.categorizeError(error);

    // Extract HTTP status if available
    const statusCode = error.statusCode || error.status || error.response?.status;
    const statusMessage = statusCode ? HTTP_STATUS_MESSAGES[statusCode] : 'Unknown error';

    const additionalData = {
      endpoint: endpoint,
      statusCode: statusCode,
      statusMessage: statusMessage,
      responseData: error.response?.data,
    };

    return this.handleError(error, context, additionalData);
  }

  /**
   * Handle file operation errors
   * @param {Error} error - The file error
   * @param {string} operation - The file operation that failed
   * @param {string} filePath - The file path involved
   * @returns {Object} - Standardized error response
   */
  static handleFileError(error, operation = '', filePath = '') {
    const context = `File ${operation}`;
    const additionalData = {
      operation: operation,
      filePath: filePath,
      errorCode: error.code,
    };

    return this.handleError(error, context, additionalData);
  }

  /**
   * Handle validation errors
   * @param {Error} error - The validation error
   * @param {string} field - The field that failed validation
   * @param {*} value - The invalid value
   * @returns {Object} - Standardized error response
   */
  static handleValidationError(error, field = '', value = null) {
    const context = `Validation for ${field}`;
    const additionalData = {
      field: field,
      value: typeof value === 'string' ? value.substring(0, 100) : value,
      validationType: error.name || 'ValidationError',
    };

    return this.handleError(error, context, additionalData);
  }

  /**
   * Create a standardized error object
   * @param {string} message - Error message
   * @param {string} type - Error type
   * @param {string} code - Error code
   * @returns {Error} - Standardized error
   */
  static createError(message, type = ERROR_TYPES.UNKNOWN_ERROR, code = null) {
    const error = new Error(message);
    error.type = type;
    error.code = code;
    error.timestamp = new Date().toISOString();
    return error;
  }

  /**
   * Retry logic for transient errors
   * @param {Function} operation - The operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise} - Result of the operation
   */
  static async withRetry(operation, options = {}) {
    const {
      maxRetries = config.RATE_LIMITS.MAX_RETRIES,
      delay = config.RATE_LIMITS.RETRY_DELAY_MS,
      backoffMultiplier = 2,
      retryableErrors = [ERROR_TYPES.RATE_LIMIT_ERROR, ERROR_TYPES.NETWORK_ERROR],
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorType = this.categorizeError(error);

        // Don't retry if error is not retryable or we've exhausted retries
        if (!retryableErrors.includes(errorType) || attempt === maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const currentDelay = delay * Math.pow(backoffMultiplier, attempt);
        logger.warn(
          `Retry attempt ${attempt + 1}/${maxRetries + 1} after ${currentDelay}ms for ${errorType}`
        );

        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }
    }

    throw lastError;
  }
}

module.exports = {
  ErrorHandler,
  ERROR_TYPES,
  HTTP_STATUS_MESSAGES,
};
