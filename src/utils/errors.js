/**
 * Custom error classes for better error handling
 */

/**
 * Base error class for the application
 */
class AszuneBotError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Cache-related errors
 */
class CacheError extends AszuneBotError {
  constructor(message, details = {}) {
    super(message);
    this.details = details;
  }
}

/**
 * Specific cache errors
 */
class CacheInitializationError extends CacheError {}
class CacheSaveError extends CacheError {}
class CacheReadError extends CacheError {}
class CacheValueError extends CacheError {}

/**
 * API-related errors 
 */
class ApiError extends AszuneBotError {
  constructor(message, statusCode, response = null) {
    super(message);
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Rate limit errors
 */
class RateLimitError extends ApiError {
  constructor(message, retryAfter = null) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

module.exports = {
  AszuneBotError,
  CacheError,
  CacheInitializationError,
  CacheSaveError,
  CacheReadError,
  CacheValueError,
  ApiError,
  RateLimitError
};
