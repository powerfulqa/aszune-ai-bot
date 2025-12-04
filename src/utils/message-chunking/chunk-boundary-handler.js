/**
 * Chunk Boundary Handler
 * Handles intelligent chunking of messages to avoid breaking content at inappropriate boundaries
 */
const logger = require('../logger');
const { handleTextProcessingError, handleChunkProcessingError } = require('./error-helpers');

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
 * @param {Object} options - Boundary fix options
 * @param {RegExp} options.endPattern - Pattern that matches the end of current chunk
 * @param {RegExp} [options.startPattern] - Pattern that matches the start of next chunk (optional)
 * @param {RegExp} options.splitPattern - Pattern to split the current chunk
 * @param {string} [options.separator=' '] - Separator to use when joining chunks
 * @returns {Object} - Result object with fixed flag and updated chunks
 */
function fixGenericBoundary(chunks, index, safeMaxLength, options) {
  const { endPattern, startPattern, splitPattern, separator = ' ' } = options;
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
  return fixGenericBoundary(chunks, index, safeMaxLength, {
    endPattern: /https?:\/\/[^\s]*$/,
    startPattern: /^[^\s]*/,
    splitPattern: /^(.*)(https?:\/\/[^\s]*)$/,
  });
}

function fixDomainBoundary(chunks, index, safeMaxLength) {
  return fixGenericBoundary(chunks, index, safeMaxLength, {
    endPattern: /\.[^\s]*$/,
    startPattern: /^(?:com|org|net|edu|gov|io|me)[/\s]/,
    splitPattern: /^(.*)(\.[^\s]*)$/,
    separator: '',
  });
}

function fixNumberedListBoundary(chunks, index, safeMaxLength) {
  return fixGenericBoundary(chunks, index, safeMaxLength, {
    endPattern: /\d+\.\s*$/,
    startPattern: null,
    splitPattern: /^(.*?)(\d+\.\s*)$/,
  });
}

/**
 * Check if chunk has incomplete markdown link (excluding citation references)
 * @param {string} chunk - The chunk to check
 * @returns {boolean} - True if has incomplete link
 */
function hasIncompleteMarkdownLink(chunk) {
  const incompletePatterns = [/\[[^\]]*$/, /\][^(]*$/, /\([^)]*$/];
  const hasIncomplete = incompletePatterns.some((pattern) => pattern.test(chunk));
  const isCitation = /\[\d+\]?$/.test(chunk);
  return hasIncomplete && !isCitation;
}

/**
 * Find the split point for a broken markdown link
 * @param {string} chunk - The chunk to analyze
 * @returns {RegExpExecArray|null} - Match result or null
 */
function findMarkdownSplitPoint(chunk) {
  const splitPatterns = [/^(.*)\[[^\]]*$/, /^(.*)\][^(]*$/, /^(.*)\([^)]*$/];
  for (const pattern of splitPatterns) {
    const match = pattern.exec(chunk);
    if (match) return match;
  }
  return null;
}

function fixMarkdownLinkBoundary(chunks, index, safeMaxLength) {
  const currentChunk = chunks[index];
  const nextChunk = chunks[index + 1];

  if (!hasIncompleteMarkdownLink(currentChunk)) {
    return { fixed: false, chunks };
  }

  const match = findMarkdownSplitPoint(currentChunk);
  if (!match) {
    return { fixed: false, chunks };
  }

  const textBeforeLink = match[1];
  const partialLink = currentChunk.substring(textBeforeLink.length);
  const canMerge = textBeforeLink.length > 0 && nextChunk.length + partialLink.length <= safeMaxLength;

  if (!canMerge) {
    return { fixed: false, chunks };
  }

  chunks[index] = textBeforeLink.trim();
  chunks[index + 1] = partialLink + ' ' + nextChunk;
  return { fixed: true, chunks };
}

/**
 * Boundary validation rules - data-driven approach
 * @private
 */
const BOUNDARY_VALIDATION_RULES = [
  {
    name: 'incomplete markdown link',
    // Check for incomplete markdown links but exclude citation-style references
    check: (chunk, _isLastChunk) => {
      const incompleteLink =
        /\[[^\]]*$/.test(chunk) || /\][^(]*$/.test(chunk) || /\([^)]*$/.test(chunk);
      const isCitationReference = /\[\d+\]$/.test(chunk);
      return incompleteLink && !isCitationReference;
    },
    level: 'debug',
  },
  {
    name: 'incomplete URL',
    check: (chunk, isLastChunk) => /https?:\/\/[^\s]*$/.test(chunk) && !isLastChunk,
    level: 'debug',
  },
  {
    name: 'incomplete numbered list',
    check: (chunk, isLastChunk) => /\d+\.\s*$/.test(chunk) && !isLastChunk,
    level: 'warn',
  },
];

/**
 * Validate chunk boundaries and ensure they don't break important content
 * @param {string[]} chunks - Array of message chunks
 * @returns {boolean} - True if boundaries are valid, false otherwise
 */
function validateChunkBoundaries(chunks) {
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;

      const failedRule = BOUNDARY_VALIDATION_RULES.find((rule) => rule.check(chunk, isLastChunk));

      if (failedRule) {
        logger[failedRule.level](`Chunk ${i + 1} has ${failedRule.name}`);
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
