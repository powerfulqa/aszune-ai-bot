/**
 * Message chunking utility for handling long messages
 * Splits messages into chunks to prevent Discord's character limit from cutting them off
 */

/**
 * Processes paragraphs by breaking them into sentences when necessary
 * @param {string} paragraph - The paragraph to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processParagraph(paragraph, effectiveMaxLength, currentChunk, chunks) {
  // If a single paragraph is too long, split it by sentences
  if (paragraph.length > effectiveMaxLength) {
    // Improved regex to properly capture sentences with punctuation
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      currentChunk = processSentence(sentence, effectiveMaxLength, currentChunk, chunks);
    }
    return currentChunk;
  } 
  
  // Paragraph fits, add it
  return currentChunk + paragraph + '\n\n';
}

/**
 * Processes a sentence by fitting it into chunks
 * @param {string} sentence - The sentence to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processSentence(sentence, effectiveMaxLength, currentChunk, chunks) {
  // If entire sentence fits in current chunk, add it
  if ((currentChunk + sentence).length + 1 <= effectiveMaxLength) {
    return currentChunk + sentence + ' ';
  }
  
  // If sentence doesn't fit but we already have content, start new chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
    return sentence + ' ';
  }
  
  // If sentence is too long for a single chunk, split by words
  if (sentence.length > effectiveMaxLength) {
    return processLongSentence(sentence, effectiveMaxLength, currentChunk, chunks);
  }
  
  // Otherwise, sentence becomes the start of a new chunk
  return sentence + ' ';
}

/**
 * Handles sentences that are too long for a single chunk
 * @param {string} sentence - The long sentence to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processLongSentence(sentence, effectiveMaxLength, currentChunk, chunks) {
  const words = sentence.split(/\s+/);
  let sentencePart = '';
  
  for (const word of words) {
    // If adding this word would exceed the limit, flush the current part
    if ((sentencePart + word).length + 1 > effectiveMaxLength && sentencePart.length > 0) {
      currentChunk += sentencePart;
      chunks.push(currentChunk.trim());
      currentChunk = '';
      sentencePart = '';
    }
    
    // Handle the word
    if (word.length > effectiveMaxLength) {
      // Very long word that exceeds chunk size - rare case
      // If we already have content in sentencePart, flush it first
      if (sentencePart.length > 0) {
        currentChunk += sentencePart;
        chunks.push(currentChunk.trim());
        currentChunk = '';
        sentencePart = '';
      }
      
      // Split the word with ellipsis
      const firstPart = word.substring(0, effectiveMaxLength - 3) + '...';
      chunks.push(firstPart);
      
      // Start next chunk with the rest of the word
      sentencePart = '...' + word.substring(effectiveMaxLength - 3) + ' ';
    } else {
      // Regular case - add word to current sentence part
      sentencePart += word + ' ';
    }
  }
  
  return currentChunk + sentencePart;
}

/**
 * Splits a long message into multiple chunks to avoid truncation
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function chunkMessage(message, maxLength = 2000) {
  // If message is already within limits, return as single chunk
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks = [];
  let currentChunk = '';
  
  // Account for chunk numbering prefix (e.g., "[1/2] ") in the max length calculation
  // Assuming a maximum of 99 chunks (adjust if needed)
  const prefixBuffer = 7; // "[xx/xx] "
  const effectiveMaxLength = maxLength - prefixBuffer;
  
  // Split by paragraphs to maintain context
  const paragraphs = message.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds max length, start a new chunk
    if ((currentChunk + paragraph).length + 2 > effectiveMaxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // Process this paragraph and update the currentChunk
    currentChunk = processParagraph(paragraph, effectiveMaxLength, currentChunk, chunks);
  }
  
  // Add the final chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // BUGFIX: Check for word breaks at chunk boundaries and ensure proper spacing
  // This prevents cases where words might be merged when chunks are joined (e.g., "an" + "officer" → "anofficer")
  // Without this fix, words split across chunk boundaries would lose spaces and become merged
  for (let i = 0; i < chunks.length - 1; i++) {
    const currentChunk = chunks[i];
    const nextChunk = chunks[i + 1];
    
    // If current chunk ends with a word and next chunk starts with a word (no space between)
    // Add a space to the end of the current chunk to prevent words merging
    if (/\w$/.test(currentChunk) && /^\w/.test(nextChunk)) {
      chunks[i] = currentChunk + ' ';
    }
  }
  
  // Add numbering to chunks for better user experience
  const numberedChunks = chunks.map((chunk, index) => 
    `[${index + 1}/${chunks.length}] ${chunk}`
  );
  
  return numberedChunks;
}

module.exports = { 
  chunkMessage,
  // Export helper functions for testing purposes
  _processParagraph: processParagraph,
  _processSentence: processSentence,
  _processLongSentence: processLongSentence
};
