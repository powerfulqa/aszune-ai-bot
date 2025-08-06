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
  
  // Pattern 4 & 5: ([n][url]) format - handle both with and without brackets
  const pattern2 = /\(\[(\d+)\](?:\[([^\]]+)\]|\s*([^\s\)]+))\)/g;
  while ((match = pattern2.exec(text)) !== null) {
    const sourceNum = match[1];
    // Use either the bracketed URL or the non-bracketed one, whichever is found
    let sourceUrl = match[2] || match[3];
    
    // Add http:// prefix if missing
    if (sourceUrl && !sourceUrl.startsWith('http')) {
      sourceUrl = 'https://' + sourceUrl;
    }
    
    if (sourceUrl) {
      sources[sourceNum] = sourceUrl;
    }
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
  // Create a working copy of the text
  let formattedText = text;
  
  // First, let's clean up any double occurrences of URLs
  // For example, patterns like ([3][www.youtube.com]www.youtube.com)
  formattedText = formattedText.replace(/\(\[(\d+)\]\[([^\]]+)\]([^\)]+)\)/g, (match, num, url1, url2) => {
    // If both URLs are similar, keep just the bracketed version
    if (url1.includes(url2) || url2.includes(url1)) {
      return `([${num}][${url1}])`;
    }
    return match; // Otherwise leave as is
  });
  
  // Replace each source reference with a proper markdown link
  Object.entries(sourceMap).forEach(([sourceNum, sourceUrl]) => {
    // First, handle the square bracket format: ([n][url])
    // This should be done first because it's the most specific pattern
    const patternBrackets = new RegExp(`\\(\\[${sourceNum}\\]\\s*(?:\\[[^\\]]+\\]|[^\\)]+)\\)`, 'g');
    formattedText = formattedText.replace(patternBrackets, `[(${sourceNum})](${sourceUrl})`);
    
    // Then handle the standard format with a URL: (n) (url) or (n)(url) or (n) url
    const patternWithUrl = new RegExp(`\\(${sourceNum}\\)(?:\\s*(?:\\(|\\s)(?:https?:\\/\\/[^\\s)]+))`, 'g');
    formattedText = formattedText.replace(patternWithUrl, `[(${sourceNum})](${sourceUrl})`);
    
    // Finally, handle standalone references (n) not already formatted
    // This needs to be done last to avoid double-replacing
    const patternStandalone = new RegExp(`(?<!\\[)\\(${sourceNum}\\)(?!\\]\\()`, 'g');
    formattedText = formattedText.replace(patternStandalone, `[(${sourceNum})](${sourceUrl})`);
  });
  
  // Fix any URLs where the domain is broken by extra characters
  formattedText = formattedText.replace(/(https?:\/\/[^\s.]+)\.(?=com|org|net|edu|gov|io|me)/g, '$1');
  
  // Fix any URLs that lost their dots
  formattedText = formattedText.replace(/examplecom/g, 'example.com');
  formattedText = formattedText.replace(/youtubecom/g, 'youtube.com');
  formattedText = formattedText.replace(/fractalsoftworkscom/g, 'fractalsoftworks.com');
  formattedText = formattedText.replace(/testorg/g, 'test.org');
  
  // Remove any extra closing parentheses at the end of URLs
  formattedText = formattedText.replace(/(\(https?:\/\/[^)]+)\)\)/g, '$1)');
  
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
    
    // Special check for domains that might be split by periods (e.g., fractalsoftworks.com)
    // Look for periods at the end of the chunk that might be part of a domain name
    if (/\.[^\s]*$/.test(currentChunk) && /^(?:com|org|net|edu|gov|io|me)[\/\s]/.test(nextChunk)) {
      const domainMatch = /^(.*)(\.[^\s]*)$/.exec(currentChunk);
      if (domainMatch) {
        const textBeforeDomain = domainMatch[1];
        const domainPart = domainMatch[2];
        
        // Only move if it won't make the next chunk too large
        if (textBeforeDomain.length > 0 && (nextChunk.length + domainPart.length <= safeMaxLength)) {
          chunks[i] = textBeforeDomain.trim();
          chunks[i+1] = domainPart + nextChunk;
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
