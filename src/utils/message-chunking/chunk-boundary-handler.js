/**
 * Chunk Boundary Handler
 * Handles intelligent chunking of messages to avoid breaking content at inappropriate boundaries
 */
const { ErrorHandler } = require('../error-handler');

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
    processedMessage = processedMessage.replace(
      /\n(www\.|\[?https?:\/\/|\[?youtu\.?be|\[?fractalsoftworks)/g,
      ' $1'
    );

    // Fix URLs at the end of paragraphs that might be split from their text
    processedMessage = processedMessage.replace(
      /\.\s*\n(www\.|\[?https?:\/\/|\[?youtu\.?be|\[?fractalsoftworks)/g,
      '. $1'
    );

    return processedMessage;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'preprocessing message', {
      messageLength: message?.length || 0,
    });
    ErrorHandler.logError(errorResponse, {
      operation: 'preprocessMessage',
      messageLength: message?.length || 0,
    });
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
    // Apply all boundary fixing rules
    for (let i = 0; i < chunks.length - 1; i++) {
      const boundaryFixResult = fixChunkBoundaryAt(chunks, i, safeMaxLength);
      chunks = boundaryFixResult.chunks;
    }

    return chunks;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'fixing chunk boundaries', {
      chunkCount: chunks?.length || 0,
      safeMaxLength,
    });
    ErrorHandler.logError(errorResponse, {
      operation: 'fixChunkBoundaries',
      chunkCount: chunks?.length || 0,
      safeMaxLength,
    });
    return chunks; // Return original chunks if fixing fails
  }
}

function fixChunkBoundaryAt(chunks, index, safeMaxLength) {
  let currentChunk = chunks[index];
  let nextChunk = chunks[index + 1];

  // Apply sentence boundary fixes
  const sentenceFix = fixSentenceBoundary(chunks, index, safeMaxLength);
  if (sentenceFix.fixed) {
    chunks = sentenceFix.chunks;
    currentChunk = chunks[index];
    nextChunk = chunks[index + 1];
  }

  // Apply URL boundary fixes
  const urlFix = fixUrlBoundary(chunks, index, safeMaxLength);
  if (urlFix.fixed) {
    chunks = urlFix.chunks;
    currentChunk = chunks[index];
    nextChunk = chunks[index + 1];
  }

  // Apply domain boundary fixes
  const domainFix = fixDomainBoundary(chunks, index, safeMaxLength);
  if (domainFix.fixed) {
    chunks = domainFix.chunks;
    currentChunk = chunks[index];
    nextChunk = chunks[index + 1];
  }

  // Apply numbered list fixes
  const numberFix = fixNumberedListBoundary(chunks, index, safeMaxLength);
  if (numberFix.fixed) {
    chunks = numberFix.chunks;
    currentChunk = chunks[index];
    nextChunk = chunks[index + 1];
  }

  // Apply markdown link fixes
  const markdownFix = fixMarkdownLinkBoundary(chunks, index, safeMaxLength);
  if (markdownFix.fixed) {
    chunks = markdownFix.chunks;
  }

  return { chunks };
}

function fixSentenceBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check for truncated sentences (ends without punctuation)
  if (!/[.!?…][\s"'\])]?$/.test(currentChunk.trim())) {
    const lastSentenceMatch = /^(.*[.!?…][\s"'\])])/s.exec(currentChunk);
    if (lastSentenceMatch) {
      const completeSentencePart = lastSentenceMatch[1];
      const remainingText = currentChunk.substring(completeSentencePart.length);

      if (nextChunk.length + remainingText.length <= safeMaxLength) {
        chunks[index] = completeSentencePart.trim();
        chunks[index + 1] = remainingText + ' ' + nextChunk;
        return { fixed: true, chunks };
      }
    }
  }

  return { fixed: false, chunks };
}

function fixUrlBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check for a URL that might be split between chunks
  if (/https?:\/\/[^\s]*$/.test(currentChunk) && /^[^\s]*/.test(nextChunk)) {
    const urlStartMatch = /^(.*)(https?:\/\/[^\s]*)$/.exec(currentChunk);
    if (urlStartMatch) {
      const textBeforeUrl = urlStartMatch[1];
      const partialUrl = urlStartMatch[2];

      if (textBeforeUrl.length > 0 && nextChunk.length + partialUrl.length <= safeMaxLength) {
        chunks[index] = textBeforeUrl.trim();
        chunks[index + 1] = partialUrl + ' ' + nextChunk;
        return { fixed: true, chunks };
      }
    }
  }

  return { fixed: false, chunks };
}

function fixDomainBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check for domains that might be split by periods
  if (
    /\.[^\s]*$/.test(currentChunk) &&
    /^(?:com|org|net|edu|gov|io|me)[\/\s]/.test(nextChunk)
  ) {
    const domainMatch = /^(.*)(\.[^\s]*)$/.exec(currentChunk);
    if (domainMatch) {
      const textBeforeDomain = domainMatch[1];
      const domainPart = domainMatch[2];

      if (
        textBeforeDomain.length > 0 &&
        nextChunk.length + domainPart.length <= safeMaxLength
      ) {
        chunks[index] = textBeforeDomain.trim();
        chunks[index + 1] = domainPart + nextChunk;
        return { fixed: true, chunks };
      }
    }
  }

  return { fixed: false, chunks };
}

function fixNumberedListBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check for numbered list items being split
  if (/\d+\.\s*$/.test(currentChunk)) {
    const numberMatch = /^(.*?)(\d+\.\s*)$/.exec(currentChunk);
    if (numberMatch) {
      const textBeforeNumber = numberMatch[1];
      const numberPart = numberMatch[2];

      if (
        textBeforeNumber.length > 0 &&
        nextChunk.length + numberPart.length <= safeMaxLength
      ) {
        chunks[index] = textBeforeNumber.trim();
        chunks[index + 1] = numberPart + nextChunk;
        return { fixed: true, chunks };
      }
    }
  }

  return { fixed: false, chunks };
}

function fixMarkdownLinkBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check for Markdown link being split across chunks
  if (
    /\[[^\]]*$/.test(currentChunk) ||
    /\][^(]*$/.test(currentChunk) ||
    /\([^)]*$/.test(currentChunk)
  ) {
    const brokenMarkdownMatch =
      /^(.*)\[[^\]]*$/.exec(currentChunk) ||
      /^(.*)\][^(]*$/.exec(currentChunk) ||
      /^(.*)\([^)]*$/.exec(currentChunk);

    if (brokenMarkdownMatch) {
      const textBeforeLink = brokenMarkdownMatch[1];
      const partialLink = currentChunk.substring(textBeforeLink.length);

      if (textBeforeLink.length > 0 && nextChunk.length + partialLink.length <= safeMaxLength) {
        chunks[index] = textBeforeLink.trim();
        chunks[index + 1] = partialLink + ' ' + nextChunk;
        return { fixed: true, chunks };
      }
    }
  }

  return { fixed: false, chunks };
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
    const errorResponse = ErrorHandler.handleError(error, 'validating chunk boundaries', {
      chunkCount: chunks?.length || 0,
    });
    console.error(`Chunk boundary validation error: ${errorResponse.message}`);
    return false;
  }
}

module.exports = {
  preprocessMessage,
  fixChunkBoundaries,
  validateChunkBoundaries,
};
