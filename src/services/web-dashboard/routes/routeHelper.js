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

module.exports = {
  createApiResponse,
  createErrorResponse,
  wrapAsyncHandler,
};
