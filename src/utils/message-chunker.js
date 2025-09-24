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
  // Check if sentence contains URLs - if so, handle them specially
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = sentence.match(urlRegex);
  
  if (urls && urls.length > 0) {
    return processSentenceWithUrls(sentence, effectiveMaxLength, currentChunk, chunks, urls);
  }
  
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

      // Split the word into multiple chunks
      let remainingWord = word;
      while (remainingWord.length > 0) {
        const chunkSize = Math.min(effectiveMaxLength, remainingWord.length);
        const wordChunk = remainingWord.substring(0, chunkSize);
        
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        chunks.push(wordChunk);
        remainingWord = remainingWord.substring(chunkSize);
      }
      
      sentencePart = '';
    } else {
      // Regular case - add word to current sentence part
      sentencePart += word + ' ';
    }
  }

  return currentChunk + sentencePart;
}

/**
 * Process a sentence that contains URLs, preserving URL integrity
 * @param {string} sentence - The sentence containing URLs
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @param {string[]} urls - Array of URLs found in the sentence
 * @returns {string} - Updated currentChunk value
 */
function processSentenceWithUrls(sentence, effectiveMaxLength, currentChunk, chunks, urls) {
  let remainingSentence = sentence;
  let sentencePart = '';
  
  // Process each URL
  for (const url of urls) {
    const urlIndex = remainingSentence.indexOf(url);
    const beforeUrl = remainingSentence.substring(0, urlIndex);
    const afterUrl = remainingSentence.substring(urlIndex + url.length);
    
    // Add text before URL
    if (beforeUrl.length > 0) {
      sentencePart += beforeUrl;
    }
    
    // Check if URL fits in current chunk
    if ((sentencePart + url).length <= effectiveMaxLength) {
      sentencePart += url;
    } else {
      // URL doesn't fit, flush current part and start new chunk
      if (sentencePart.length > 0) {
        currentChunk += sentencePart;
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If URL itself is too long, split it
      if (url.length > effectiveMaxLength) {
        let remainingUrl = url;
        while (remainingUrl.length > 0) {
          const chunkSize = Math.min(effectiveMaxLength, remainingUrl.length);
          const urlChunk = remainingUrl.substring(0, chunkSize);
          chunks.push(urlChunk);
          remainingUrl = remainingUrl.substring(chunkSize);
        }
        sentencePart = '';
      } else {
        sentencePart = url;
      }
    }
    
    remainingSentence = afterUrl;
  }
  
  // Add any remaining text after the last URL
  if (remainingSentence.length > 0) {
    sentencePart += remainingSentence;
  }
  
  // If we have remaining content, process it normally
  if (sentencePart.length > effectiveMaxLength) {
    // Flush current part if it exists
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    // Process remaining content as regular words
    return processLongSentence(sentencePart, effectiveMaxLength, currentChunk, chunks);
  }
  
  return sentencePart;
}

/**
 * Splits a long message into multiple chunks to avoid truncation
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function chunkMessage(message, maxLength = 2000) {
  // Handle null or undefined input
  if (!message) {
    return [''];
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
  const numberedChunks = chunks.map((chunk, index) => `[${index + 1}/${chunks.length}] ${chunk}`);

  return numberedChunks;
}

module.exports = {
  chunkMessage,
  // Export helper functions for testing purposes
  _processParagraph: processParagraph,
  _processSentence: processSentence,
  _processLongSentence: processLongSentence,
};
