/**
 * Enhanced Message Chunker - Main Module
 * Coordinates all chunking functionality with proper source reference handling
 */
const config = require('../../config/config');
const logger = require('../logger');
const { ErrorHandler } = require('../error-handler');
const originalChunker = require('../message-chunker');
const { processSourceReferences } = require('./source-reference-processor');
const {
  preprocessMessage,
  fixChunkBoundaries,
  validateChunkBoundaries,
} = require('./chunk-boundary-handler');

/**
 * Enhanced chunk message function that handles source references properly
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function enhancedChunkMessage(message, maxLength = config.MESSAGE_LIMITS.DISCORD_MAX_LENGTH) {
  try {
    // Reduce max length slightly to ensure we have room for formatting
    // This helps prevent truncation issues
    const safeMaxLength = maxLength - config.MESSAGE_LIMITS.SAFE_CHUNK_OVERHEAD;

    // Pre-process message to fix common formatting issues
    let processedMessage = preprocessMessage(message);

    // Process any source references in the message
    processedMessage = processSourceReferences(processedMessage);

    // Now use the original chunker on the processed message with reduced length
    const chunks = originalChunker.chunkMessage(processedMessage, safeMaxLength);

    // Fix chunk boundaries to avoid breaking content inappropriately
    const fixedChunks = fixChunkBoundaries(chunks, safeMaxLength);

    // Validate the final chunks
    if (!validateChunkBoundaries(fixedChunks)) {
      logger.debug(
        'Chunk boundary validation detected potential issues, but continuing with fixed chunks'
      );
    }

    return fixedChunks;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'enhanced message chunking', {
      messageLength: message?.length || 0,
      maxLength,
    });
    logger.error(`Enhanced chunking error: ${errorResponse.message}`);

    // Fallback to original chunker if enhanced chunking fails
    try {
      return originalChunker.chunkMessage(message, maxLength);
    } catch (fallbackError) {
      const fallbackErrorResponse = ErrorHandler.handleError(
        fallbackError,
        'fallback message chunking',
        {
          messageLength: message?.length || 0,
          maxLength,
        }
      );
      logger.error(`Fallback chunking error: ${fallbackErrorResponse.message}`);

      // Last resort: return the original message as a single chunk
      return [message];
    }
  }
}

// processSourceReferences is already imported from './source-reference-processor'

module.exports = {
  chunkMessage: enhancedChunkMessage,
  processSourceReferences,
};
