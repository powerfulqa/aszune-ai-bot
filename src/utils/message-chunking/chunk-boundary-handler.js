/**
 * Chunk Boundary Handler
 * Handles intelligent chunking of messages to avoid breaking content at inappropriate boundaries
 */
const config = require('../../config/config');
const { ErrorHandler, ERROR_TYPES } = require('../error-handler');

/**
 * Process and fix message formatting issues before chunking
 * @param {string} message - The message to process
 * @returns {string} - Processed message with fixed formatting
 */
function preprocessMessage(message) {
  try {
    let processedMessage = message;
    
    // Fix numbered list formatting
    // Ensure no empty lines between numbered items (a common Discord formatting issue)
    processedMessage = processedMessage.replace(/(\d+\.\s+[^\n]+)\n\s*\n(\d+\.\s+)/g, '$1\n$2');
    
    // Ensure proper indentation for numbered lists (especially in summaries)
    processedMessage = processedMessage.replace(/^(\d+)\.\s*(\S)/gm, '$1. $2');
    
    // Fix missing spaces after numbered list periods
    processedMessage = processedMessage.replace(/(\d+\.)(\S)/g, '$1 $2');
    
    // Add newlines before numbered lists for better formatting
    processedMessage = processedMessage.replace(/([^\n])(\n\d+\.\s+)/g, '$1\n$2');
    
    // Fix standalone URLs and links that appear on their own lines
    processedMessage = processedMessage.replace(/\n(www\.|\[?https?:\/\/|\[?youtu\.?be|\[?fractalsoftworks)/g, ' $1');
    
    // Fix URLs at the end of paragraphs that might be split from their text
    processedMessage = processedMessage.replace(/\.\s*\n(www\.|\[?https?:\/\/|\[?youtu\.?be|\[?fractalsoftworks)/g, '. $1');
    
    return processedMessage;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'preprocessing message', { messageLength: message?.length || 0 });
    console.error(`Message preprocessing error: ${errorResponse.message}`);
    return message; // Return original message if preprocessing fails
  }
}

/**
 * Fix chunk boundaries to avoid breaking content inappropriately
 * @param {string[]} chunks - Array of message chunks
 * @param {number} safeMaxLength - Safe maximum length for chunks
 * @returns {string[]} - Array of chunks with improved boundaries
 */
function fixChunkBoundaries(chunks, safeMaxLength) {
  try {
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
      
      // Check for numbered list items being split between chunks
      // We don't want to split between a number and its content
      if (/\d+\.\s*$/.test(currentChunk)) {
        // Found a number at the end of the chunk, move it to next chunk
        const numberMatch = /^(.*?)(\d+\.\s*)$/.exec(currentChunk);
        if (numberMatch) {
          const textBeforeNumber = numberMatch[1];
          const numberPart = numberMatch[2];
          
          if (textBeforeNumber.length > 0 && (nextChunk.length + numberPart.length <= safeMaxLength)) {
            chunks[i] = textBeforeNumber.trim();
            chunks[i+1] = numberPart + nextChunk;
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
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'fixing chunk boundaries', { 
      chunkCount: chunks?.length || 0,
      safeMaxLength
    });
    console.error(`Chunk boundary fixing error: ${errorResponse.message}`);
    return chunks; // Return original chunks if fixing fails
  }
}

/**
 * Validate chunk boundaries and ensure they don't break important content
 * @param {string[]} chunks - Array of message chunks
 * @returns {boolean} - True if boundaries are valid, false otherwise
 */
function validateChunkBoundaries(chunks) {
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Check for incomplete markdown links
      if (/\[[^\]]*$/.test(chunk) || /\][^(]*$/.test(chunk) || /\([^)]*$/.test(chunk)) {
        console.warn(`Chunk ${i + 1} has incomplete markdown link`);
        return false;
      }
      
      // Check for incomplete URLs
      if (/https?:\/\/[^\s]*$/.test(chunk) && i < chunks.length - 1) {
        console.warn(`Chunk ${i + 1} has incomplete URL`);
        return false;
      }
      
      // Check for incomplete numbered lists
      if (/\d+\.\s*$/.test(chunk) && i < chunks.length - 1) {
        console.warn(`Chunk ${i + 1} has incomplete numbered list`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'validating chunk boundaries', { chunkCount: chunks?.length || 0 });
    console.error(`Chunk boundary validation error: ${errorResponse.message}`);
    return false;
  }
}

module.exports = {
  preprocessMessage,
  fixChunkBoundaries,
  validateChunkBoundaries
};
