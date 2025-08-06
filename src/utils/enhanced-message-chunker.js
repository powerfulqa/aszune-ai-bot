/**
 * Message chunker enhancement for fixing source links and truncation issues
 * This version properly handles URLs, particularly YouTube links, and ensures proper boundary handling
 */

// Import the original message chunker
const originalChunker = require('./message-chunker');

/**
 * Process source references in text to ensure they're properly maintained across chunk boundaries
 * @param {string} text - The text to process
 * @returns {string} - Text with properly formatted source references
 */
function processSourceReferences(text) {
  // First pass: Collect all source references and their URLs
  const sourceMap = collectSourceReferences(text);
  
  // Second pass: Format each source reference with its URL
  return formatSourceReferences(text, sourceMap);
}

/**
 * Collect all source references and their URLs from text
 * @param {string} text - The text to process
 * @returns {Object} - Map of source numbers to URLs
 */
function collectSourceReferences(text) {
  // Look for patterns like (1) (http://...) with optional space between
  const sourceURLPattern = /\((\d+)\)(?:\s*(?:\(|\s))(https?:\/\/[^\s)]+)/g;
  const sources = {};
  let match;
  
  while ((match = sourceURLPattern.exec(text)) !== null) {
    const sourceNum = match[1];
    const sourceUrl = match[2];
    sources[sourceNum] = sourceUrl;
  }
  
  return sources;
}

/**
 * Format source references in text using the collected URL map
 * @param {string} text - The text to process
 * @param {Object} sourceMap - Map of source numbers to URLs
 * @returns {string} - Formatted text with markdown links
 */
function formatSourceReferences(text, sourceMap) {
  // Replace each source reference with a markdown link
  Object.entries(sourceMap).forEach(([sourceNum, sourceUrl]) => {
    // Replace all occurrences of (n) with [(n)](url)
    const pattern = new RegExp(`\\(${sourceNum}\\)(?:\\s*(?:\\(|\\s)(?:https?:\\/\\/[^\\s)]+))?`, 'g');
    text = text.replace(pattern, `[(${sourceNum})](${sourceUrl})`);
  });
  
  return text;
}

/**
 * Enhanced chunk message function that handles source references properly
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function enhancedChunkMessage(message, maxLength = 2000) {
  // First, process any source references in the message
  const processedMessage = processSourceReferences(message);
  
  // Now use the original chunker on the processed message
  const chunks = originalChunker.chunkMessage(processedMessage, maxLength);
  
  // Perform an additional check to ensure no chunk ends with a partial URL
  for (let i = 0; i < chunks.length - 1; i++) {
    const currentChunk = chunks[i];
    const nextChunk = chunks[i + 1];
    
    // Check for a URL that might be split between chunks
    if (/https?:\/\/[^\s]*$/.test(currentChunk) && /^[^\s]*/.test(nextChunk)) {
      // Move the URL entirely to the next chunk if possible
      const urlStartMatch = /^(.*)(https?:\/\/[^\s]*)$/.exec(currentChunk);
      if (urlStartMatch) {
        const textBeforeUrl = urlStartMatch[1];
        const partialUrl = urlStartMatch[2];
        
        // Only perform this operation if moving the URL won't make the next chunk too large
        if (textBeforeUrl.length > 0 && (nextChunk.length + partialUrl.length <= maxLength)) {
          chunks[i] = textBeforeUrl.trim();
          chunks[i+1] = partialUrl + ' ' + nextChunk;
        }
      }
    }
  }
  
  return chunks;
}

// Export both the enhanced chunker and original functions
module.exports = {
  chunkMessage: enhancedChunkMessage,
  processSourceReferences,
  _processParagraph: originalChunker._processParagraph,
  _processSentence: originalChunker._processSentence,
  _processLongSentence: originalChunker._processLongSentence
};
