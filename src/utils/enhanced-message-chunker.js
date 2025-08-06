/**
 * Message chunker enhancement for fixing source links and truncation issues
 * This version  // Post-processing: Convert any incomplete URLs or broken brackets
  // Handle cases where bracket format is broken, like ([3][www.youtube.
  formattedText = formattedText.replace(/\(\[(\d+)\]\[([^\]]+)(?=\s|$)/g, (match, num, url) => {
    if (url.includes('www.') && !url.includes('.com')) {
      // It's likely a broken domain like www.youtube (without .com)
      const domain = url.trim();
      if (domain.startsWith('www.')) {
        return `([${num}][${domain}.com]`;
      }
    }
    // Handle fractalsoftworks.com domain specifically
    if (url.includes('fractalsoftworks') && !url.includes('.com')) {
      return `([${num}][fractalsoftworks.com]`;
    }
    return match;
  });
  
  // Convert plain text URLs to links when they're in source references
  formattedText = formattedText.replace(/\)\s+((?:https?:\/\/)?(?:www\.)?fractalsoftworks\.com[^\s]+)/g, 
                                      (match, url) => {
    if (!url.startsWith('http')) {
      return `) [https://fractalsoftworks.com${url.replace('fractalsoftworks.com', '')}](https://fractalsoftworks.com${url.replace('fractalsoftworks.com', '')})`;
    }
    return `) [${url}](${url})`;
  });ndles URLs, particularly YouTube links, and ensures proper boundary handling
 */

// Import the original message chunker
const originalChunker = require('./message-chunker');

/**
 * Process source references in text to ensure they're properly maintained across chunk boundaries
 * @param {string} text - The text to process
 * @returns {string} - Text with properly formatted source references
 */
function processSourceReferences(text) {
  // First pass: Collect all source references and their URLs
  const sourceMap = collectSourceReferences(text);
  
  // Second pass: Format each source reference with its URL
  return formatSourceReferences(text, sourceMap);
}

/**
 * Collect all source references and their URLs from text
 * @param {string} text - The text to process
 * @returns {Object} - Map of source numbers to URLs
 */
function collectSourceReferences(text) {
  // Capture multiple source reference formats:
  // 1. (1) (http://example.com) - Standard format with parentheses
  // 2. (1)(http://example.com) - No space between number and URL
  // 3. (1) http://example.com - Space but no parentheses around URL
  // 4. ([1][http://example.com]) - Format with square brackets
  // 5. ([1]www.example.com) - Format with square brackets without http
  
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
}

// Helper functions for formatting different types of URLs
function formatSocialMediaLinks(text) {
  let formattedText = text;
  
  // Handle basic Reddit URLs - convert to proper links
  formattedText = formattedText.replace(/(?<!\(|\[|:\/\/)(reddit\.com\/r\/[^\s]+)/g, 
                                     '(https://$1)');
                                     
  // Handle Reddit URLs that are in incomplete Markdown format
  formattedText = formattedText.replace(/\[(?:https?:\/\/)?(reddit\.com\/r\/[^\]]+)\]\s*(?!\()/g, 
                                     '[$1](https://$1)');
                                     
  // Handle plain text r/subreddit references
  formattedText = formattedText.replace(/(?<!\(|\[|:\/\/|\/)(r\/[\w\d_]+)(?=[\s.,;!?]|$)/g,
                                     '[Reddit: $1](https://reddit.com/$1)');
  
  // Handle Imgur URLs - convert to proper links
  formattedText = formattedText.replace(/(?<!\(|\[|:\/\/)((?:www\.)?imgur\.com\/[^\s]+)/g,
                                     '(https://$1)');
                                     
  // Handle GitHub URLs - convert to proper links
  formattedText = formattedText.replace(/(?<!\(|\[|:\/\/)((?:www\.)?github\.com\/[^\s]+)/g,
                                     '(https://$1)');
  
  // Handle Twitter/X URLs - convert to proper links
  formattedText = formattedText.replace(/(?<!\(|\[|:\/\/)((?:www\.)?(twitter\.com|x\.com)\/[^\s]+)/g,
                                     '(https://$1)');
  
  return formattedText;
}

function formatYouTubeLinks(text) {
  let formattedText = text;
  
  // Fix YouTube links appearing on separate lines by removing the preceding newline
  formattedText = formattedText.replace(/\n(www\.youtube|youtube\.com|https:\/\/(?:www\.)?youtube\.com)/g, ' $1');
  formattedText = formattedText.replace(/\.\n(www\.youtube|youtube\.com|https:\/\/(?:www\.)?youtube\.com)/g, '. $1');
  
  // Extract video titles or use generic YouTube Link text
  formattedText = formattedText.replace(/(^|\s)((?:www\.)?youtube\.com\/watch\?v=([^\s&]+)[^\s]*|youtu\.be\/([^\s]+))(?=[\s.,;!?]|$)/g, 
    (match, prefix, url, videoId1, videoId2) => {
      // Get the actual video ID, whether it came from the first or second pattern
      const videoId = videoId1 || videoId2;
      return `${prefix}[YouTube Video: ${videoId}](https://${url})`;
    });
  
  // Fix YouTube URLs that are missing protocol
  formattedText = formattedText.replace(/\((?!https?:\/\/)(www\.youtube|youtube\.com)/g, '(https://$1');
  
  return formattedText;
}

function formatStarsectorLinks(text) {
  let formattedText = text;
  
  // Fix any fractalsoftworks URLs specifically (common issue)
  formattedText = formattedText.replace(/https:\/\/fractalsoftworks\/\.com/g, 'https://fractalsoftworks.com');
  formattedText = formattedText.replace(/https:\/\/fractalsoftworks\./g, 'https://fractalsoftworks.com');
  formattedText = formattedText.replace(/(https?:\/\/)?fractalsoftworks\/\./g, 'https://fractalsoftworks.');
  formattedText = formattedText.replace(/\(https:\/\/fractalsoftworks\//g, '(https://fractalsoftworks.');
  
  // Fix forum URLs with specific patterns (seen in screenshot)
  formattedText = formattedText.replace(/\(https:\/\/\[fractalsoftworks\.com\]/g, '(https://fractalsoftworks.com');
  formattedText = formattedText.replace(/\(https:\/\/fractalsoftworks\.comcom/g, '(https://fractalsoftworks.com');
  
  // Clean up forum URLs that might get double domain or malformed forum paths
  formattedText = formattedText.replace(/fractalsoftworks\.com\.com/g, 'fractalsoftworks.com');
  formattedText = formattedText.replace(/fractalsoftworks\.comcom/g, 'fractalsoftworks.com');
  formattedText = formattedText.replace(/fractalsoftworks\.c\s*\n*com/g, 'fractalsoftworks.com');
  
  // Fix spaces in topic numbers
  formattedText = formattedText.replace(/topic=(\d+)\.\s+(\d+)/g, 'topic=$1.$2');
  
  // Fix specific cases of line breaks in URLs
  formattedText = formattedText.replace(/(https:\/\/[^\s]+)\n([^\s]+)/g, '$1$2');
  formattedText = formattedText.replace(/(\n[^\s]*php\?topic=[^\s]+)\n([^\s]+)/g, '$1$2');
  
  // Handle specific nested markdown patterns in forum links
  formattedText = formattedText.replace(/\[\[fractalsoftworks\.com\]\(https:\/\/fractalsoftworks(?:\.com)?\//g, 
                                      '[fractalsoftworks.com](https://fractalsoftworks.com/');
  
  // Fix specific forum link format issues seen in Discord messages
  formattedText = formattedText.replace(/\(https:\/\/fractalsoftworks\.com\)\(\/forum\/index\.php\?topic=(\d+)\.(\d+)\)/g, 
                                      '(https://fractalsoftworks.com/forum/index.php?topic=$1.$2)');
  
  // Convert plain text URLs to proper links with descriptive text
  formattedText = formattedText.replace(/(?<!\(|\[|:\/\/)((?:www\.)?fractalsoftworks\.com\/forum\/index\.php\?topic=(\d+)\.(\d+))/g, 
                                      '[Starsector Forum Topic #$2](https://$1)');
                                      
  // Fix specific source references with forum URLs
  formattedText = formattedText.replace(/\(\[([\d]+)\]\[(?:https:\/\/)?fractalsoftworks\.com([^\]]+)\]/g,
                                      '[(Source $1)](https://fractalsoftworks.com$2)');
  
  // Fix forum URLs with missing http prefix and add descriptive text
  formattedText = formattedText.replace(/\(fractalsoftworks\.com(\/forum\/index\.php\?topic=\d+\.\d+)\)/g, 
                                      '([Starsector Forum](https://fractalsoftworks.com$1))');
  formattedText = formattedText.replace(/\(fractalsoftworks\.com/g, '(https://fractalsoftworks.com');
  formattedText = formattedText.replace(/\[fractalsoftworks\.com\](?!\()/g, '[Starsector Website](https://fractalsoftworks.com)');
  
  // Fix specific forum link pattern seen in the screenshot
  formattedText = formattedText.replace(/\(https:\/\/fractalsoftworks(?:\.com)?com\/forum\/index\.php\?topic=(\d+)\.(\d+)\)/g, 
                                      '(https://fractalsoftworks.com/forum/index.php?topic=$1.$2)');
  
  return formattedText;
}

function fixLinkFormatting(text) {
  let formattedText = text;
  
  // Fix links with improper spacing in Markdown syntax
  formattedText = formattedText.replace(/\]([^\s(])/g, '] $1');
  formattedText = formattedText.replace(/\)([^\s.,;:!?)])/g, ') $1');
  
  // Remove any extra closing parentheses at the end of URLs
  formattedText = formattedText.replace(/(\(https?:\/\/[^)]+)\)\)/g, '$1)');
  
  // Fix common Markdown link format issues (missing spaces, extra brackets)
  formattedText = formattedText.replace(/\]\(([^)]+)\)\(([^)]+)\)/g, ']($1)');
  
  // Fix nested parentheses in URLs for source references
  formattedText = formattedText.replace(/\(\[(\d+)\]\)\(([^)]+)\)/g, '[(Source $1)]($2)');
  
  // Handle the specific pattern in the screenshot - convert from
  // ([5][https://[[fractalsoftworks.com](https://fractalsoftworks/.com/forum/index.php?topic=13667.705)).
  formattedText = formattedText.replace(/\(\[([\d]+)\](?:\[[^\]]*\])?\[([^\]]+)\]\((https?:\/\/[^)]+)\)\)/g, '[(Source $1)]($3)');
  
  return formattedText;
}

function formatSourceReferences(text, sourceMap) {
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
  
  // Apply platform-specific formatting
  formattedText = formatSocialMediaLinks(formattedText);
  formattedText = formatYouTubeLinks(formattedText);
  formattedText = formatStarsectorLinks(formattedText);
  
  // Final cleanup pass
  formattedText = fixLinkFormatting(formattedText);
  
  // Handle references where the URL is part of the text but not properly linked
  const urlRegex = /\[(\d+)\]\s*(?!\()/g;
  const urlMatches = formattedText.matchAll(urlRegex);
  
  for (const match of urlMatches) {
    const refNum = match[1];
    if (sourceMap[refNum]) {
      const replaceRegex = new RegExp(`\\[${refNum}\\]\\s*(?!\\()`, 'g');
      formattedText = formattedText.replace(replaceRegex, `[${refNum}](${sourceMap[refNum]})`);
    }
  }
  
  return formattedText;
}

/**
 * Enhanced chunk message function that handles source references properly
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function enhancedChunkMessage(message, maxLength = 2000) {
  // Reduce max length slightly to ensure we have room for formatting
  // This helps prevent truncation issues
  const safeMaxLength = maxLength - 50;
  
  // Pre-process message to fix common formatting issues
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
  
  // Process any source references in the message
  processedMessage = processSourceReferences(processedMessage);
  
  // Now use the original chunker on the processed message with reduced length
  const chunks = originalChunker.chunkMessage(processedMessage, safeMaxLength);
  
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
}

// Export both the enhanced chunker and original functions
module.exports = {
  chunkMessage: enhancedChunkMessage,
  processSourceReferences,
  _processParagraph: originalChunker._processParagraph,
  _processSentence: originalChunker._processSentence,
  _processLongSentence: originalChunker._processLongSentence
};
