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
  // Capture multiple source reference formats:
  // 1. (1) (http://example.com) - Standard format with parentheses
  // 2. (1)(http://example.com) - No space between number and URL
  // 3. (1) http://example.com - Space but no parentheses around URL
  // 4. ([1][http://example.com]) - Format with square brackets
  // 5. ([1]www.example.com) - Format with square brackets without http
  
  const sources = {};
  
  // Pattern 1 & 2 & 3: (n) followed by URL in various formats
  const pattern1 = /\((\d+)\)(?:\s*(?:\(|\s))?(https?:\/\/[^\s)]+)/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const sourceNum = match[1];
    const sourceUrl = match[2];
    sources[sourceNum] = sourceUrl;
  }
  
  // Pattern 4 & 5: ([n][url]) format
  const pattern2 = /\(\[(\d+)\]\[([^\]]+)\]\)/g;
  while ((match = pattern2.exec(text)) !== null) {
    const sourceNum = match[1];
    let sourceUrl = match[2];
    
    // Add http:// prefix if missing
    if (!sourceUrl.startsWith('http')) {
      sourceUrl = 'https://' + sourceUrl;
    }
    
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
  // Create a copy of the text to work with
  let formattedText = text;
  
  // Replace each source reference with a markdown link
  Object.entries(sourceMap).forEach(([sourceNum, sourceUrl]) => {
    // Handle various source reference formats
    
    // Pattern 1: Replace (n) with URL with [(n)](url) - only if followed by a URL
    const pattern1 = new RegExp(`\\(${sourceNum}\\)(?:\\s*(?:\\(|\\s)(?:https?:\\/\\/[^\\s)]+))`, 'g');
    formattedText = formattedText.replace(pattern1, `[(${sourceNum})](${sourceUrl})`);
    
    // Pattern 2: Replace ([n][url]) format with [(n)](url)
    const pattern2 = new RegExp(`\\(\\[${sourceNum}\\]\\[[^\\]]+\\]\\)`, 'g');
    formattedText = formattedText.replace(pattern2, `[(${sourceNum})](${sourceUrl})`);
    
    // Pattern 3: Replace standalone (n) references (not followed by a URL) with [(n)](url)
    // This needs to be done last to avoid replacing already formatted links
    // We need to check that the (n) is not already part of a markdown link
    const pattern3 = new RegExp(`(?<!\\[)\\(${sourceNum}\\)(?!\\]\\()`, 'g');
    formattedText = formattedText.replace(pattern3, `[(${sourceNum})](${sourceUrl})`);
  });
  
  return formattedText;
}

/**
 * Enhanced chunk message function that handles source references properly
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function enhancedChunkMessage(message, maxLength = 2000) {
  // Reduce max length slightly to ensure we have room for formatting
  // This helps prevent truncation issues
  const safeMaxLength = maxLength - 50;
  
  // First, process any source references in the message
  const processedMessage = processSourceReferences(message);
  
  // Now use the original chunker on the processed message with reduced length
  const chunks = originalChunker.chunkMessage(processedMessage, safeMaxLength);
  
  // Make an additional pass to ensure no chunk ends mid-sentence or with a partial URL
  for (let i = 0; i < chunks.length - 1; i++) {
    let currentChunk = chunks[i];
    let nextChunk = chunks[i + 1];
    
    // Check for truncated sentences (ends without punctuation)
    if (!/[.!?…][\s"'\])]?$/.test(currentChunk.trim())) {
      // Look for the last sentence boundary
      const lastSentenceMatch = /^(.*[.!?…][\s"'\])])/s.exec(currentChunk);
      if (lastSentenceMatch) {
        const completeSentencePart = lastSentenceMatch[1];
        const remainingText = currentChunk.substring(completeSentencePart.length);
        
        // Only move text if it doesn't make the next chunk too large
        if (nextChunk.length + remainingText.length <= safeMaxLength) {
          chunks[i] = completeSentencePart.trim();
          chunks[i+1] = remainingText + ' ' + nextChunk;
          
          // Update for URL check below
          currentChunk = chunks[i];
          nextChunk = chunks[i+1];
        }
      }
    }
    
    // Check for a URL that might be split between chunks
    if (/https?:\/\/[^\s]*$/.test(currentChunk) && /^[^\s]*/.test(nextChunk)) {
      // Move the URL entirely to the next chunk if possible
      const urlStartMatch = /^(.*)(https?:\/\/[^\s]*)$/.exec(currentChunk);
      if (urlStartMatch) {
        const textBeforeUrl = urlStartMatch[1];
        const partialUrl = urlStartMatch[2];
        
        // Only perform this operation if moving the URL won't make the next chunk too large
        if (textBeforeUrl.length > 0 && (nextChunk.length + partialUrl.length <= safeMaxLength)) {
          chunks[i] = textBeforeUrl.trim();
          chunks[i+1] = partialUrl + ' ' + nextChunk;
        }
      }
    }
    
    // Check for Markdown link being split across chunks ([text](url))
    if (/\[[^\]]*$/.test(currentChunk) || /\][^(]*$/.test(currentChunk) || /\([^)]*$/.test(currentChunk)) {
      // Find the start of the potential broken markdown link
      const brokenMarkdownMatch = /^(.*)\[[^\]]*$/.exec(currentChunk) || 
                                  /^(.*)\][^(]*$/.exec(currentChunk) || 
                                  /^(.*)\([^)]*$/.exec(currentChunk);
      
      if (brokenMarkdownMatch) {
        const textBeforeLink = brokenMarkdownMatch[1];
        const partialLink = currentChunk.substring(textBeforeLink.length);
        
        if (textBeforeLink.length > 0 && (nextChunk.length + partialLink.length <= safeMaxLength)) {
          chunks[i] = textBeforeLink.trim();
          chunks[i+1] = partialLink + ' ' + nextChunk;
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
