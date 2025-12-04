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
  // If paragraph fits within limits, add it directly
  if (paragraph.length <= effectiveMaxLength) {
    return addParagraphToChunk(paragraph, currentChunk);
  }

  // Paragraph is too long, need to split it
  if (paragraph.includes('\n')) {
    return processParagraphWithLineBreaks(paragraph, effectiveMaxLength, currentChunk, chunks);
  }

  // Split by sentences
  return processParagraphBySentences(paragraph, effectiveMaxLength, currentChunk, chunks);
}

/**
 * Adds a paragraph to the current chunk with proper spacing
 * @param {string} paragraph - The paragraph to add
 * @param {string} currentChunk - Current accumulating chunk content
 * @returns {string} - Updated currentChunk value
 */
function addParagraphToChunk(paragraph, currentChunk) {
  if (currentChunk.length > 0) {
    return currentChunk + '\n\n' + paragraph;
  }
  return paragraph;
}

/**
 * Processes a paragraph that contains line breaks
 * @param {string} paragraph - The paragraph with line breaks
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processParagraphWithLineBreaks(paragraph, effectiveMaxLength, currentChunk, chunks) {
  const lines = paragraph.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.length > 0) {
      currentChunk = processLine(line, effectiveMaxLength, currentChunk, chunks);
    }

    // Add line break after each line except the last one
    if (i < lines.length - 1 && currentChunk.length > 0) {
      currentChunk += '\n';
    }
  }

  return currentChunk;
}

/**
 * Processes a single line within a paragraph
 * @param {string} line - The line to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processLine(line, effectiveMaxLength, currentChunk, chunks) {
  if ((currentChunk + line).length + 1 <= effectiveMaxLength) {
    return currentChunk + line;
  }

  // Start new chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  return line;
}

/**
 * Processes a paragraph by splitting it into sentences
 * @param {string} paragraph - The paragraph to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string} currentChunk - Current accumulating chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated currentChunk value
 */
function processParagraphBySentences(paragraph, effectiveMaxLength, currentChunk, chunks) {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    currentChunk = processSentence(sentence, effectiveMaxLength, currentChunk, chunks);
  }

  return currentChunk;
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
    const chunkSize = Math.max(1, Math.min(effectiveMaxLength, remainingWord.length));
    const wordChunk = remainingWord.substring(0, chunkSize);

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    // Prevent infinite loop by ensuring we always make progress
    if (chunkSize <= 0) {
      break;
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
  // If the entire sentence part fits, return it as is
  if (sentencePart.length <= effectiveMaxLength) {
    return sentencePart;
  }

  // Flush current chunk and start fresh
  flushCurrentChunk(currentChunk, chunks);

  const words = sentencePart.split(/\s+/);
  let wordPart = '';

  for (const word of words) {
    wordPart = processWord(word, wordPart, effectiveMaxLength, chunks);
  }

  return wordPart;
}

/**
 * Flushes the current chunk to the chunks array
 * @param {string} currentChunk - Current chunk to flush
 * @param {string[]} chunks - Array to add the chunk to
 */
function flushCurrentChunk(currentChunk, chunks) {
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
}

/**
 * Processes a single word and determines if it fits in the current word part
 * @param {string} word - The word to process
 * @param {string} wordPart - Current accumulating word part
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Updated word part
 */
function processWord(word, wordPart, effectiveMaxLength, chunks) {
  const newWordPart = wordPart + (wordPart ? ' ' : '') + word;

  if (newWordPart.length <= effectiveMaxLength) {
    return newWordPart;
  }

  // Current word part is full, flush it
  if (wordPart) {
    chunks.push(wordPart.trim());
  }

  // Handle very long single words
  if (word.length > effectiveMaxLength) {
    return processVeryLongWord(word, effectiveMaxLength, chunks);
  }

  return word;
}

/**
 * Processes a word that is longer than the maximum chunk length
 * @param {string} word - The very long word to process
 * @param {number} effectiveMaxLength - Maximum length for chunk content
 * @param {string[]} chunks - Array to collect completed chunks
 * @returns {string} - Empty string since word is split into chunks
 */
function processVeryLongWord(word, effectiveMaxLength, chunks) {
  let remainingWord = word;

  while (remainingWord.length > 0) {
    const chunkSize = Math.min(effectiveMaxLength, remainingWord.length);
    const wordChunk = remainingWord.substring(0, chunkSize);
    chunks.push(wordChunk);
    remainingWord = remainingWord.substring(chunkSize);
  }

  return '';
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
    const result = processUrlInSentence(
      url,
      sentencePart,
      effectiveMaxLength,
      currentChunk,
      chunks
    );
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
 * Checks if a line is a table separator (like |---|---|)
 * @param {string} line - Line to check
 * @returns {boolean} - True if it's a separator line
 */
function isTableSeparator(line) {
  // Match lines that contain only pipes, dashes, spaces, equals, and colons
  return line.match(/^[|\s\-=:]+$/);
}

/**
 * Parses a table row into cells
 * @param {string} line - Table row line
 * @returns {string[]|null} - Array of cells or null if not a valid table row
 */
function parseTableRow(line) {
  if (!line.includes('|')) {
    return null;
  }

  const cells = line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell !== ''); // Allow empty cells but filter out empty strings from split edges

  // Valid table row needs at least one cell between pipes
  return cells.length >= 1 ? cells : null;
}

/**
 * Formats a table data row as bullet points
 * @param {string[]} headers - Table headers
 * @param {string[]} cells - Row data
 * @returns {string} - Formatted row content
 */
function formatTableDataRow(headers, cells) {
  let content = `• **${headers[0]}**: ${cells[0]}\n`;
  for (let i = 1; i < cells.length; i++) {
    content += `  *${headers[i]}*: ${cells[i]}\n`;
  }
  return content + '\n';
}

/**
 * Processes a single line for table formatting
 * @param {string} line - Line to process
 * @param {Object} state - Current processing state
 * @returns {Object} - Updated state
 */
function processTableLine(line, state) {
  const { formattedContent, inTable, headers } = state;
  const trimmed = line.trim();

  // Skip separator lines
  if (isTableSeparator(trimmed)) {
    return state;
  }

  const cells = parseTableRow(trimmed);

  if (cells) {
    if (!inTable) {
      // First table row - headers
      return {
        formattedContent: formattedContent + `**${cells.join(' | ')}:**\n`,
        inTable: true,
        headers: cells,
      };
    } else if (cells.length === headers.length) {
      // Valid data row
      return {
        ...state,
        formattedContent: formattedContent + formatTableDataRow(headers, cells),
      };
    }
  }

  // Not a valid table row or mismatched columns
  const endTableMarker = inTable ? '\n' : '';
  return {
    formattedContent: formattedContent + endTableMarker + line + '\n',
    inTable: false,
    headers: [],
  };
}

/**
 * Converts table-like content to formatted lists for Discord embeds
 * @param {string} content - Raw response content
 * @returns {string} - Formatted content suitable for embeds
 */
function formatTablesForDiscord(content) {
  // Handle null/undefined input
  if (!content) return content;

  // Detect table patterns (basic detection for | separated content)
  const tableRegex = /^\s*\|.*\|\s*$/gm;
  const hasTables = tableRegex.test(content);

  if (!hasTables) return content;

  const lines = content.split('\n');
  let state = {
    formattedContent: '',
    inTable: false,
    headers: [],
  };

  for (const line of lines) {
    state = processTableLine(line, state);
  }

  return state.formattedContent.trim();
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

  // Fix word breaks at chunk boundaries
  fixChunkBoundarySpacing(chunks);

  // Add numbering to chunks for better user experience
  return chunks.map((chunk, index) => `[${index + 1}/${chunks.length}] ${chunk}`);
}

/**
 * Fix word breaks at chunk boundaries to prevent merged words
 * Modifies the chunks array in place
 * @param {string[]} chunks - Array of chunks to fix
 */
function fixChunkBoundarySpacing(chunks) {
  for (let i = 0; i < chunks.length - 1; i++) {
    const currentChunk = chunks[i];
    const nextChunk = chunks[i + 1];

    // If current chunk ends with a word char and next starts with one
    if (/\w$/.test(currentChunk) && /^\w/.test(nextChunk)) {
      // Don't add space if this looks like a split word/URL
      if (!looksLikeSplitContent(currentChunk, nextChunk)) {
        chunks[i] = currentChunk + ' ';
      }
    }
  }
}

/**
 * Check if two chunks look like they were split from the same word/URL
 * @param {string} currentChunk - Current chunk text
 * @param {string} nextChunk - Next chunk text
 * @returns {boolean} True if content looks like it was split
 */
function looksLikeSplitContent(currentChunk, nextChunk) {
  const combinedText = currentChunk + nextChunk;
  return (
    /^https?:\/\//.test(combinedText) || // URL
    /^\w+$/.test(combinedText.replace(/\s+/g, '')) || // Single word
    (currentChunk.length <= 3 && nextChunk.length <= 3) // Very short chunks
  );
}

module.exports = {
  chunkMessage,
  formatTablesForDiscord,
  // Export helper functions for testing purposes
  _processParagraph: processParagraph,
  _processSentence: processSentence,
  _processLongSentence: processLongSentence,
};
