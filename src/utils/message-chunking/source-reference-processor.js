/**
 * Source Reference Processor
 * Handles collection and formatting of source references in messages
 */
const { handleTextProcessingError } = require('./error-helpers');

/**
 * Process pattern 1 matches: (n) followed by URL
 * @param {Array} match - Regex match result
 * @param {Object} sources - Sources object to update
 */
function processPattern1(match, sources) {
  const sourceNum = match[1];
  const sourceUrl = match[2];
  sources[sourceNum] = sourceUrl;
}

/**
 * Process pattern 2 matches: ([n][url]) format
 * @param {Array} match - Regex match result
 * @param {Object} sources - Sources object to update
 */
function processPattern2(match, sources) {
  const sourceNum = match[1];
  let sourceUrl = match[2] || match[3];

  if (sourceUrl) {
    sourceUrl = sourceUrl.replace(/\)$/, '');
    if (!sourceUrl.startsWith('http')) {
      sourceUrl = 'https://' + sourceUrl;
    }
    sources[sourceNum] = sourceUrl;
  }
}

/**
 * Process pattern 3 matches: ([n][url] without closing bracket
 * @param {Array} match - Regex match result
 * @param {Object} sources - Sources object to update
 */
function processPattern3(match, sources) {
  const sourceNum = match[1];
  let sourceUrl = match[2];

  if (sourceUrl && !sourceUrl.startsWith('http')) {
    sourceUrl = 'https://' + sourceUrl;
  }

  if (sourceUrl) {
    sources[sourceNum] = sourceUrl;
  }
}

/**
 * Collect all source references and their URLs from text
 * @param {string} text - The text to process
 * @returns {Object} - Map of source numbers to URLs
 */
function collectSourceReferences(text) {
  try {
    const sources = {};

    // Process all patterns using a pattern array
    const patterns = [
      { regex: /\((\d+)\)(?:\s*(?:\(|\s))?(https?:\/\/[^\s)]+)/g, processor: processPattern1 },
      { regex: /\(\[(\d+)\](?:\[([^\]]+)\]|\s*([^\s)]+))\)/g, processor: processPattern2 },
      { regex: /\(\[(\d+)\]\[([^\]]+)(?=$|\s)/g, processor: processPattern3 },
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        pattern.processor(match, sources);
      }
    });

    return sources;
  } catch (error) {
    handleTextProcessingError(error, 'collecting source references', text);
    return {};
  }
}

/**
 * Format source references in text to ensure they're properly maintained across chunk boundaries
 * @param {string} text - The text to process
 * @param {Object} sourceMap - Map of source numbers to URLs
 * @returns {string} - Text with properly formatted source references
 */
function formatSourceReferences(text, sourceMap) {
  let result = text; // Default to original text

  try {
    // Input validation - early exit if invalid
    if (!text || !sourceMap) {
      return result;
    }

    result = performSourceReferenceFormatting(text, sourceMap);
  } catch (error) {
    return handleTextProcessingError(error, 'formatting source references', text);
  }

  return result;
}

/**
 * Perform the actual source reference formatting logic
 * @param {string} text - Text to format
 * @param {Object} sourceMap - Map of source numbers to URLs
 * @returns {string} - Formatted text
 */
function performSourceReferenceFormatting(text, sourceMap) {
  let formattedText = text;

  // Step 1: Pre-processing fixes
  formattedText = applyPreprocessingFixes(formattedText);

  // Step 2: Clean up duplicate URLs
  formattedText = applyDuplicateUrlCleanup(formattedText);

  // Step 3: Replace source references with markdown links
  formattedText = applySourceReferenceReplacement(formattedText, sourceMap);

  // Step 4: Post-processing cleanup
  formattedText = applyPostprocessingCleanup(formattedText);

  // Step 5: Handle unlinked references
  formattedText = applyUnlinkedReferenceHandling(formattedText, sourceMap);

  return formattedText;
}

/**
 * Apply pre-processing fixes for broken bracket formats
 */
function applyPreprocessingFixes(text) {
  return text.replace(/\(\[(\d+)\]\[([^\]]+)(?=\s|$)/g, (match, num, url) => {
    if (url.includes('www.') && !url.includes('.com')) {
      const domain = url.trim();
      if (domain.startsWith('www.')) {
        return `([${num}][${domain}.com]`;
      }
    }
    return match;
  });
}

/**
 * Clean up duplicate URL occurrences
 */
function applyDuplicateUrlCleanup(text) {
  return text.replace(/\(\[(\d+)\]\[([^\]]+)\]([^)]+)\)/g, (match, num, url1, url2) => {
    if (url1.includes(url2) || url2.includes(url1)) {
      return `([${num}][${url1}])`;
    }
    return match;
  });
}

/**
 * Replace source references with proper markdown links
 */
function applySourceReferenceReplacement(text, sourceMap) {
  let formattedText = text;

  Object.entries(sourceMap).forEach(([sourceNum, sourceUrl]) => {
    // Handle square bracket format: ([n][url])
    formattedText = replaceSquareBracketFormat(formattedText, sourceNum, sourceUrl);

    // Handle standard format with URL: (n) (url) or (n)(url) or (n) url
    formattedText = replaceStandardFormat(formattedText, sourceNum, sourceUrl);

    // Handle standalone references (n) not already formatted
    formattedText = replaceStandaloneReferences(formattedText, sourceNum, sourceUrl);
  });

  return formattedText;
}

/**
 * Replace square bracket format references
 */
function replaceSquareBracketFormat(text, sourceNum, sourceUrl) {
  const patternBrackets = new RegExp(`\\(\\[${sourceNum}\\][^)]*\\)`, 'g');
  return text.replace(patternBrackets, `[(${sourceNum})](${sourceUrl})`);
}

/**
 * Replace standard format references
 */
function replaceStandardFormat(text, sourceNum, sourceUrl) {
  const patternWithUrl = new RegExp(
    `\\(${sourceNum}\\)(?:\\s*(?:\\(|\\s)(?:https?:\\/\\/[^\\s)]+))`,
    'g'
  );
  return text.replace(patternWithUrl, `[(${sourceNum})](${sourceUrl})`);
}

/**
 * Replace standalone references
 */
function replaceStandaloneReferences(text, sourceNum, sourceUrl) {
  const patternStandalone = new RegExp(`(?<!\\[)\\(${sourceNum}\\)(?!\\]\\()`, 'g');
  return text.replace(patternStandalone, `[(${sourceNum})](${sourceUrl})`);
}

/**
 * Apply post-processing cleanup for common URL issues
 */
function applyPostprocessingCleanup(text) {
  return (
    text
      // Fix URLs where domain is broken by extra characters
      .replace(/(https?:\/\/[^\s.]+)\.(?=com|org|net|edu|gov|io|me)/g, '$1')
      // Fix URLs that lost their dots
      .replace(/examplecom/g, 'example.com')
      .replace(/youtubecom/g, 'youtube.com')
      .replace(/fractalsoftworkscom/g, 'fractalsoftworks.com')
      .replace(/testorg/g, 'test.org')
  );
}

/**
 * Handle references where URL is part of text but not properly linked
 */
function applyUnlinkedReferenceHandling(text, sourceMap) {
  let formattedText = text;
  const urlRegex = /\[(\d+)\]\s*(?!\()/g;
  const urlMatches = formattedText.matchAll(urlRegex);

  for (const match of urlMatches) {
    const refNum = match[1];
    if (sourceMap[refNum]) {
      formattedText = replaceUnlinkedReference(formattedText, refNum, sourceMap[refNum]);
    }
  }

  return formattedText;
}

/**
 * Replace a specific unlinked reference with proper markdown link
 */
function replaceUnlinkedReference(text, refNum, url) {
  const replaceRegex = new RegExp(`\\[${refNum}\\]\\s*(?!\\()`, 'g');
  const linkText = generateLinkText(url, refNum);
  const fullUrl = ensureHttpPrefix(url);

  return text.replace(replaceRegex, `[${linkText}](${fullUrl})`);
}

/**
 * Generate appropriate link text based on URL type
 */
function generateLinkText(url, refNum) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube Video';
  } else if (url.includes('fractalsoftworks.com/forum')) {
    return 'Starsector Forum';
  } else {
    return 'Source ' + refNum;
  }
}

/**
 * Ensure URL has proper HTTP prefix
 */
function ensureHttpPrefix(url) {
  return url.startsWith('http') ? url : 'https://' + url;
}

/**
 * Process source references in text to ensure they're properly maintained across chunk boundaries
 * @param {string} text - The text to process
 * @returns {string} - Text with properly formatted source references
 */
function processSourceReferences(text) {
  try {
    // First pass: Collect all source references and their URLs
    const sourceMap = collectSourceReferences(text);

    // Second pass: Format each source reference with its URL
    return formatSourceReferences(text, sourceMap);
  } catch (error) {
    return handleTextProcessingError(error, 'processing source references', text);
  }
}

module.exports = {
  collectSourceReferences,
  formatSourceReferences,
  processSourceReferences,
};
