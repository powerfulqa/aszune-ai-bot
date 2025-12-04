/**
 * Route Helper Utilities
 * Provides common patterns for route handlers to reduce code duplication
 */
const { ErrorHandler } = require('../../../utils/error-handler');

/**
 * Creates a standardized API response
 * @param {Object} data - Response data
 * @returns {Object} Formatted response with timestamp
 */
function createApiResponse(data) {
  return {
    ...data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a standardized error response
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @returns {Object} Error response object
 */
function createErrorResponse(message, statusCode = 500) {
  return {
    statusCode,
    body: {
      error: message,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Wraps an async route handler with standardized error handling
 * @param {Function} handler - Async function that returns data
 * @param {string} context - Error context description
 * @returns {Function} Express route handler
 */
function wrapAsyncHandler(handler, context) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      // If handler explicitly handled the response, don't send again
      if (res.headersSent) return;
      res.json(createApiResponse(result));
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, context);
      res.status(500).json(createErrorResponse(errorResponse.message).body);
    }
  };
}

/**
 * Creates a simple GET handler that fetches data from a service method
 * @param {Object} service - Service instance
 * @param {string} methodName - Service method to call
 * @param {string} resultKey - Key to use in the response object
 * @param {string} context - Error context for logging
 * @returns {Function} Express route handler
 */
function createSimpleGetHandler(service, methodName, resultKey, context) {
  return wrapAsyncHandler(async () => {
    const result = await service[methodName]();
    return { [resultKey]: result };
  }, context);
}

/**
 * Sends a validation error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function sendValidationError(res, message) {
  res.status(400).json(createErrorResponse(message, 400).body);
}

module.exports = {
  createApiResponse,
  createErrorResponse,
  wrapAsyncHandler,
  createSimpleGetHandler,
  sendValidationError,
};
