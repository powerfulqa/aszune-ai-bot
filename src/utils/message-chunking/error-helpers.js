/**
 * Shared error handling helpers for message chunking operations
 * Eliminates code duplication across chunking modules
 */
const logger = require('../logger');
const { ErrorHandler } = require('../error-handler');

/**
 * Validate that input is a string and return early if not
 * @param {*} text - The input to validate
 * @returns {boolean} - True if text is a valid string, false otherwise
 */
function isValidString(text) {
  return typeof text === 'string';
}

/**
 * Handle text processing errors with consistent logging
 * @param {Error} error - The error that occurred
 * @param {string} context - Description of the operation that failed
 * @param {string|null} text - The original text (returned on error)
 * @param {Object} additionalContext - Additional context for error logging
 * @returns {string|null} - The original text value
 */
function handleTextProcessingError(error, context, text, additionalContext = {}) {
  const errorResponse = ErrorHandler.handleError(error, context, {
    textLength: text?.length || 0,
    ...additionalContext,
  });
  logger.error(`${context} error: ${errorResponse.message}`);
  return text;
}

/**
 * Handle chunk processing errors with consistent logging
 * @param {Error} error - The error that occurred
 * @param {string} context - Description of the operation that failed
 * @param {Array} chunks - The original chunks (returned on error)
 * @param {Object} additionalContext - Additional context for error logging
 * @returns {Array} - The original chunks value
 */
function handleChunkProcessingError(error, context, chunks, additionalContext = {}) {
  const errorResponse = ErrorHandler.handleError(error, context, {
    chunkCount: chunks?.length || 0,
    ...additionalContext,
  });
  ErrorHandler.logError(errorResponse, {
    operation: context.replace(/\s+/g, ''),
    chunkCount: chunks?.length || 0,
    ...additionalContext,
  });
  return chunks;
}

module.exports = {
  handleTextProcessingError,
  handleChunkProcessingError,
  isValidString,
};
