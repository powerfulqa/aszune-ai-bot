/**
 * Enhanced Message Chunker - Legacy Compatibility Layer
 * This file now serves as a compatibility layer for the new modular chunking system
 * @deprecated Use the modular chunking system in ./message-chunking/ instead
 */

// Import the new modular chunking system
const enhancedChunker = require('./message-chunking');

/**
 * Enhanced chunk message function that handles source references properly
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function enhancedChunkMessage(message, maxLength = 2000) {
  return enhancedChunker.chunkMessage(message, maxLength);
}

/**
 * Process source references in text to ensure they're properly maintained across chunk boundaries
 * @param {string} text - The text to process
 * @returns {string} - Text with properly formatted source references
 */
function processSourceReferences(text) {
  return enhancedChunker.processSourceReferences(text);
}

// Export both the enhanced chunker and original functions for backward compatibility
module.exports = {
  chunkMessage: enhancedChunkMessage,
  processSourceReferences,
  // Re-export functions from the new modular system
  _processParagraph: enhancedChunker._processParagraph,
  _processSentence: enhancedChunker._processSentence,
  _processLongSentence: enhancedChunker._processLongSentence
};