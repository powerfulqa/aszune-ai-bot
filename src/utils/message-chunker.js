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
/**
 * Helper function to flush current sentence part to chunks
 * @param {string} sentencePart - Current sentence part
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Empty current chunk
 */
function flushSentencePart(sentencePart, currentChunk, chunks) {
  if (sentencePart.length > 0) {
    currentChunk += sentencePart;
    chunks.push(currentChunk.trim());
  }
  return '';
}

/**
 * Helper function to split a very long word into chunks
 * @param {string} word - The long word to split
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Empty current chunk
 */
function splitVeryLongWord(word, effectiveMaxLength, currentChunk, chunks) {
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
  return '';
}

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
      currentChunk = flushSentencePart(sentencePart, currentChunk, chunks);
      sentencePart = '';
    }

    // Handle the word
    if (word.length > effectiveMaxLength) {
      // Flush any existing sentence part first
      currentChunk = flushSentencePart(sentencePart, currentChunk, chunks);
      // Split the very long word
      currentChunk = splitVeryLongWord(word, effectiveMaxLength, currentChunk, chunks);
      sentencePart = '';
    } else {
      // Regular case - add word to current sentence part
      sentencePart += word + ' ';
    }
  }

  return currentChunk + sentencePart;
}

/**
 * Helper function to handle a single URL in the sentence
 * @param {string} url - The URL to process
 * @param {string} sentencePart - Current sentence part being built
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {Object} - Object with updated sentencePart and currentChunk
 */
function processUrlInSentence(url, sentencePart, effectiveMaxLength, currentChunk, chunks) {
  // Check if URL fits in current chunk
  if ((sentencePart + url).length <= effectiveMaxLength) {
    return { sentencePart: sentencePart + url, currentChunk };
  }
  
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
    return { sentencePart: '', currentChunk };
  }
  
  return { sentencePart: url, currentChunk };
}

/**
 * Helper function to process remaining words after URLs
 * @param {string} sentencePart - The remaining text to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processRemainingWords(sentencePart, effectiveMaxLength, currentChunk, chunks) {
  if (sentencePart.length <= effectiveMaxLength) {
    return sentencePart;
  }
  
  // Flush current part if it exists
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
    currentChunk = '';
  }
  
  const words = sentencePart.split(/\s+/);
  let wordPart = '';
  
  for (const word of words) {
    if ((wordPart + ' ' + word).trim().length <= effectiveMaxLength) {
      wordPart += (wordPart ? ' ' : '') + word;
    } else {
      if (wordPart) {
        currentChunk += wordPart;
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Handle very long single words
      if (word.length > effectiveMaxLength) {
        let remainingWord = word;
        while (remainingWord.length > 0) {
          const chunkSize = Math.min(effectiveMaxLength, remainingWord.length);
          const wordChunk = remainingWord.substring(0, chunkSize);
          chunks.push(wordChunk);
          remainingWord = remainingWord.substring(chunkSize);
        }
        wordPart = '';
      } else {
        wordPart = word;
      }
    }
  }
  
  return wordPart;
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
    
    // Process the URL
    const result = processUrlInSentence(url, sentencePart, effectiveMaxLength, currentChunk, chunks);
    sentencePart = result.sentencePart;
    currentChunk = result.currentChunk;
    
    remainingSentence = afterUrl;
  }
  
  // Add any remaining text after the last URL
  if (remainingSentence.length > 0) {
    sentencePart += remainingSentence;
  }
  
  // Process remaining content
  return processRemainingWords(sentencePart, effectiveMaxLength, currentChunk, chunks);
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
      // Check if this looks like a word that was split across chunks
      // by looking for patterns that suggest the chunks are parts of the same word/URL
      
      // Check if this looks like a split word/URL by examining the content
      const combinedText = currentChunk + nextChunk;
      const looksLikeSplitWord = /^https?:\/\//.test(combinedText) || // URL
                                /^\w+$/.test(combinedText.replace(/\s+/g, '')) || // Single word
                                (currentChunk.length <= 3 && nextChunk.length <= 3); // Very short chunks (likely split word)
      
      // Don't add space if this looks like a split word/URL
      if (!looksLikeSplitWord) {
        chunks[i] = currentChunk + ' ';
      }
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
