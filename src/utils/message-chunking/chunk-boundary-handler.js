/**
 * Chunk Boundary Handler
 * Handles intelligent chunking of messages to avoid breaking content at inappropriate boundaries
 */
const logger = require('../logger');
const {
  handleTextProcessingError,
  handleChunkProcessingError,
} = require('./error-helpers');

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
    return handleTextProcessingError(error, 'preprocessing message', message);
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
    return handleChunkProcessingError(error, 'fixing chunk boundaries', chunks, { safeMaxLength });
  }
}

function fixChunkBoundaryAt(chunks, index, safeMaxLength) {
  // Apply sentence boundary fixes
  const sentenceFix = fixSentenceBoundary(chunks, index, safeMaxLength);
  if (sentenceFix.fixed) {
    chunks = sentenceFix.chunks;
  }

  // Apply URL boundary fixes
  const urlFix = fixUrlBoundary(chunks, index, safeMaxLength);
  if (urlFix.fixed) {
    chunks = urlFix.chunks;
  }

  // Apply domain boundary fixes
  const domainFix = fixDomainBoundary(chunks, index, safeMaxLength);
  if (domainFix.fixed) {
    chunks = domainFix.chunks;
  }

  // Apply numbered list fixes
  const numberFix = fixNumberedListBoundary(chunks, index, safeMaxLength);
  if (numberFix.fixed) {
    chunks = numberFix.chunks;
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

/**
 * Generic boundary fixer that handles common patterns
 * @param {string[]} chunks - Array of chunks
 * @param {number} index - Current chunk index
 * @param {number} safeMaxLength - Safe maximum length
 * @param {RegExp} endPattern - Pattern that matches the end of current chunk
 * @param {RegExp} startPattern - Pattern that matches the start of next chunk (optional)
 * @param {RegExp} splitPattern - Pattern to split the current chunk
 * @param {string} separator - Separator to use when joining chunks
 * @returns {Object} - Result object with fixed flag and updated chunks
 */
function fixGenericBoundary(
  chunks,
  index,
  safeMaxLength,
  endPattern,
  startPattern,
  splitPattern,
  separator = ' '
) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check if the boundary condition is met
  if (!endPattern.test(currentChunk) || (startPattern && !startPattern.test(nextChunk))) {
    return { fixed: false, chunks };
  }

  const match = splitPattern.exec(currentChunk);
  if (!match) {
    return { fixed: false, chunks };
  }

  const textBefore = match[1];
  const partialContent = match[2] || currentChunk.substring(textBefore.length);

  if (textBefore.length > 0 && nextChunk.length + partialContent.length <= safeMaxLength) {
    chunks[index] = textBefore.trim();
    chunks[index + 1] = partialContent + separator + nextChunk;
    return { fixed: true, chunks };
  }

  return { fixed: false, chunks };
}

function fixUrlBoundary(chunks, index, safeMaxLength) {
  return fixGenericBoundary(
    chunks,
    index,
    safeMaxLength,
    /https?:\/\/[^\s]*$/, // endPattern
    /^[^\s]*/, // startPattern
    /^(.*)(https?:\/\/[^\s]*)$/ // splitPattern
  );
}

function fixDomainBoundary(chunks, index, safeMaxLength) {
  return fixGenericBoundary(
    chunks,
    index,
    safeMaxLength,
    /\.[^\s]*$/, // endPattern
    /^(?:com|org|net|edu|gov|io|me)[/\s]/, // startPattern
    /^(.*)(\.[^\s]*)$/, // splitPattern
    '' // separator (no space for domains)
  );
}

function fixNumberedListBoundary(chunks, index, safeMaxLength) {
  return fixGenericBoundary(
    chunks,
    index,
    safeMaxLength,
    /\d+\.\s*$/, // endPattern
    null, // startPattern (not needed)
    /^(.*?)(\d+\.\s*)$/ // splitPattern
  );
}

function fixMarkdownLinkBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  // Check for Markdown link being split across chunks (but exclude citation-style references)
  const hasIncompleteLink =
    /\[[^\]]*$/.test(currentChunk) ||
    /\][^(]*$/.test(currentChunk) ||
    /\([^)]*$/.test(currentChunk);
  const isCitationReference = /\[\d+\]?$/.test(currentChunk); // Allow citation references like [1], [2], etc.

  if (hasIncompleteLink && !isCitationReference) {
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

      // Check for incomplete markdown links (but exclude citation-style references like [1], [2], etc.)
      const incompleteLink =
        /\[[^\]]*$/.test(chunk) || /\][^(]*$/.test(chunk) || /\([^)]*$/.test(chunk);
      const isCitationReference = /\[\d+\]$/.test(chunk); // Allow citation references like [1], [2], etc.

      if (incompleteLink && !isCitationReference) {
        logger.debug(`Chunk ${i + 1} has incomplete markdown link`);
        return false;
      }

      // Check for incomplete URLs
      if (/https?:\/\/[^\s]*$/.test(chunk) && i < chunks.length - 1) {
        logger.debug(`Chunk ${i + 1} has incomplete URL`);
        return false;
      }

      // Check for incomplete numbered lists
      if (/\d+\.\s*$/.test(chunk) && i < chunks.length - 1) {
        logger.warn(`Chunk ${i + 1} has incomplete numbered list`);
        return false;
      }
    }

    return true;
  } catch (error) {
    handleTextProcessingError(error, 'validating chunk boundaries', null);
    return false;
  }
}

module.exports = {
  preprocessMessage,
  fixChunkBoundaries,
  validateChunkBoundaries,
};
