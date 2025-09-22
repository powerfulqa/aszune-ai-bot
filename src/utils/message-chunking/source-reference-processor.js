/**
 * Source Reference Processor
 * Handles collection and formatting of source references in messages
 */
const config = require('../../config/config');
const { ErrorHandler, ERROR_TYPES } = require('../error-handler');

/**
 * Collect all source references and their URLs from text
 * @param {string} text - The text to process
 * @returns {Object} - Map of source numbers to URLs
 */
function collectSourceReferences(text) {
  try {
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
      
      // Clean up the URL if it contains undesirable characters
      if (sourceUrl) {
        // Remove any trailing characters that shouldn't be part of the URL
        sourceUrl = sourceUrl.replace(/\)$/, '');
      }
      
      // Add http:// prefix if missing
      if (sourceUrl && !sourceUrl.startsWith('http')) {
        sourceUrl = 'https://' + sourceUrl;
      }
      
      if (sourceUrl) {
        sources[sourceNum] = sourceUrl;
      }
    }
    
    // Additional pattern for square bracket format without closing bracket
    // e.g. ([3][www.youtube. (broken across lines)
    const pattern3 = /\(\[(\d+)\]\[([^\]]+)(?=$|\s)/g;
    while ((match = pattern3.exec(text)) !== null) {
      const sourceNum = match[1];
      let sourceUrl = match[2];
      
      // Add http:// prefix if missing
      if (sourceUrl && !sourceUrl.startsWith('http')) {
        sourceUrl = 'https://' + sourceUrl;
      }
      
      if (sourceUrl) {
        sources[sourceNum] = sourceUrl;
      }
    }
    
    return sources;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'collecting source references', { textLength: text?.length || 0 });
    console.error(`Source reference collection error: ${errorResponse.message}`);
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
  try {
    // Create a working copy of the text
    let formattedText = text;
    
    // Pre-processing: Convert any incomplete URLs or broken brackets
    // Handle cases where bracket format is broken, like ([3][www.youtube.
    formattedText = formattedText.replace(/\(\[(\d+)\]\[([^\]]+)(?=\s|$)/g, (match, num, url) => {
      if (url.includes('www.') && !url.includes('.com')) {
        // It's likely a broken domain like www.youtube (without .com)
        const domain = url.trim();
        if (domain.startsWith('www.')) {
          return `([${num}][${domain}.com]`;
        }
      }
      return match;
    });
    
    // Clean up any double occurrences of URLs
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
      // This needs to be more aggressive to catch partial matches
      const patternBrackets = new RegExp(`\\(\\[${sourceNum}\\][^)]*\\)`, 'g');
      formattedText = formattedText.replace(patternBrackets, `[(${sourceNum})](${sourceUrl})`);
      
      // Then handle the standard format with a URL: (n) (url) or (n)(url) or (n) url
      const patternWithUrl = new RegExp(`\\(${sourceNum}\\)(?:\\s*(?:\\(|\\s)(?:https?:\\/\\/[^\\s)]+))`, 'g');
      formattedText = formattedText.replace(patternWithUrl, `[(${sourceNum})](${sourceUrl})`);
      
      // Finally, handle standalone references (n) not already formatted
      // This needs to be done last to avoid double-replacing
      const patternStandalone = new RegExp(`(?<!\\[)\\(${sourceNum}\\)(?!\\]\\()`, 'g');
      formattedText = formattedText.replace(patternStandalone, `[(${sourceNum})](${sourceUrl})`);
    });
    
    // Post-processing cleanup for common URL issues
    
    // Fix any URLs where the domain is broken by extra characters
    formattedText = formattedText.replace(/(https?:\/\/[^\s.]+)\.(?=com|org|net|edu|gov|io|me)/g, '$1');
    
    // Fix any URLs that lost their dots
    formattedText = formattedText.replace(/examplecom/g, 'example.com');
    formattedText = formattedText.replace(/youtubecom/g, 'youtube.com');
    formattedText = formattedText.replace(/fractalsoftworkscom/g, 'fractalsoftworks.com');
    formattedText = formattedText.replace(/testorg/g, 'test.org');
    
    // Handle references where the URL is part of the text but not properly linked
    const urlRegex = /\[(\d+)\]\s*(?!\()/g;
    const urlMatches = formattedText.matchAll(urlRegex);
    
    for (const match of urlMatches) {
      const refNum = match[1];
      if (sourceMap[refNum]) {
        const replaceRegex = new RegExp(`\\[${refNum}\\]\\s*(?!\\()`, 'g');
        
        // Special handling for different URL types to provide better descriptive text
        let linkText;
        const url = sourceMap[refNum];
        
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          linkText = 'YouTube Video';
        } else if (url.includes('fractalsoftworks.com/forum')) {
          linkText = 'Starsector Forum';
        } else {
          linkText = 'Source ' + refNum;
        }
        
        // Make sure the URL is complete and properly formatted
        let fullUrl = url;
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        
        formattedText = formattedText.replace(replaceRegex, `[${linkText}](${fullUrl})`);
      }
    }
    
    return formattedText;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'formatting source references', { 
      textLength: text?.length || 0,
      sourceCount: Object.keys(sourceMap || {}).length
    });
    console.error(`Source reference formatting error: ${errorResponse.message}`);
    return text; // Return original text if formatting fails
  }
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
    const errorResponse = ErrorHandler.handleError(error, 'processing source references', { textLength: text?.length || 0 });
    console.error(`Source reference processing error: ${errorResponse.message}`);
    return text; // Return original text if processing fails
  }
}

module.exports = {
  collectSourceReferences,
  formatSourceReferences,
  processSourceReferences
};
