/**
 * Enhanced Message Chunker - Main Module
 * Coordinates all chunking functionality with proper source reference handling
 */
const config = require('../../config/config');
const { ErrorHandler } = require('../error-handler');
const originalChunker = require('../message-chunker');
const { processSourceReferences } = require('./source-reference-processor');
const { formatAllUrls } = require('./url-formatter');
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
      console.warn('Chunk boundary validation failed, but continuing with fixed chunks');
    }

    return fixedChunks;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'enhanced message chunking', {
      messageLength: message?.length || 0,
      maxLength,
    });
    console.error(`Enhanced chunking error: ${errorResponse.message}`);

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
      console.error(`Fallback chunking error: ${fallbackErrorResponse.message}`);

      // Last resort: return the original message as a single chunk
      return [message];
    }
  }
}

// processSourceReferences is already imported from './source-reference-processor'

/**
 * Format URLs in text (standalone function for external use)
 * @param {string} text - The text to process
 * @returns {string} - Text with formatted URLs
 */
function formatUrls(text) {
  try {
    return formatAllUrls(text);
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'formatting URLs', {
      textLength: text?.length || 0,
    });
    console.error(`URL formatting error: ${errorResponse.message}`);
    return text;
  }
}

/**
 * Get chunking statistics for monitoring and debugging
 * @param {string[]} chunks - Array of message chunks
 * @returns {Object} - Statistics about the chunking process
 */
function getChunkingStats(chunks) {
  try {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const avgChunkLength = chunks.length > 0 ? totalLength / chunks.length : 0;
    const maxChunkLength = Math.max(...chunks.map((chunk) => chunk.length));
    const minChunkLength = Math.min(...chunks.map((chunk) => chunk.length));

    return {
      chunkCount: chunks.length,
      totalLength,
      avgChunkLength: Math.round(avgChunkLength),
      maxChunkLength,
      minChunkLength,
      isBalanced: maxChunkLength - minChunkLength < avgChunkLength * 0.5, // Rough balance check
    };
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'getting chunking stats', {
      chunkCount: chunks?.length || 0,
    });
    console.error(`Chunking stats error: ${errorResponse.message}`);
    return {
      chunkCount: 0,
      totalLength: 0,
      avgChunkLength: 0,
      maxChunkLength: 0,
      minChunkLength: 0,
      isBalanced: false,
    };
  }
}

// Export both the enhanced chunker and original functions for backward compatibility
module.exports = {
  chunkMessage: enhancedChunkMessage,
  processSourceReferences,
  formatUrls,
  getChunkingStats,
  // Re-export original chunker functions for backward compatibility
  _processParagraph: originalChunker._processParagraph,
  _processSentence: originalChunker._processSentence,
  _processLongSentence: originalChunker._processLongSentence,
};
