/**
 * @module url-formatter
 * @fileoverview Provides comprehensive URL formatting capabilities for message content.
 * 
 * This module includes functions to detect, format, and fix various types of URLs 
 * (including Reddit, Imgur, GitHub, Twitter/X, YouTube, and Starsector forum links) 
 * within text, ensuring consistent and user-friendly presentation.
 * 
 * ## Exports
 * {@link formatSocialMediaLinks}: Formats Reddit, Imgur, GitHub, and Twitter/X links.
 * {@link formatYouTubeLinks}: Formats YouTube links with descriptive text.
 * {@link formatStarsectorLinks}: Formats Starsector forum links.
 * 
 * ## Error Handling
 * All formatting functions use a centralized {@link ErrorHandler} to catch and log errors, 
 * returning the original text in case of failure.
 * 
 * ## Usage Example
 * ```javascript
 * const { formatSocialMediaLinks, formatYouTubeLinks, formatStarsectorLinks } = require('./url-formatter');
 * const input = "Check this out: reddit.com/r/example and https://youtu.be/abc123";
 * const formatted = formatSocialMediaLinks(formatYouTubeLinks(input));
 * ```
 * 
 * @author
 * @version 1.0.0
 */
const { ErrorHandler } = require('../error-handler');

/**
 * Format social media links (Reddit, Imgur, GitHub, Twitter/X)
 * @param {string} text - Text to process
 * @returns {string} - Text with formatted social media links
 */
function formatSocialMediaLinks(text) {
  try {
    // Input validation
    if (typeof text !== 'string') {
      return text;
    }
    
    let formattedText = text;

    // Handle basic Reddit URLs - convert to proper links (case insensitive, handle www, https/http prefixes)
    formattedText = formattedText.replace(
      /(?<!\(|\[|:\/\/)(?:https?:\/\/)?(www\.)?(reddit\.com\/r\/[^\s.,;!?]+(?:\?[^\s.,;!?]*)?(?:#[^\s.,;!?]*)?)/gi,
      (match, www, domain) => {
        const cleanDomain = domain.toLowerCase();
        return `(https://${www || ''}${cleanDomain})`;
      }
    );

    // Handle Reddit URLs that are in incomplete Markdown format
    formattedText = formattedText.replace(
      /\[(?:https?:\/\/)?(reddit\.com\/r\/[^\]]+)\]\s*(?!\()/g,
      '[$1](https://$1)'
    );

    // Handle plain text r/subreddit references (but not when part of another domain)
    formattedText = formattedText.replace(
      /(?<!\(|\[|:\/\/|\/|\.com\/[^\/]*)(r\/[\w\d_]+)(?=[\s.,;!?]|$)/g,
      '[Reddit: $1](https://reddit.com/$1)'
    );

    // Handle Imgur URLs - convert to proper links
    formattedText = formattedText.replace(
      /(?<!\(|\[|:\/\/)((?:www\.)?imgur\.com\/[^\s]+)/g,
      '(https://$1)'
    );

    // Handle GitHub URLs
    formattedText = formattedText.replace(
      /(?<!\(|\[|:\/\/)(?:https?:\/\/)?(www\.)?(github\.com\/[^\s.,;!?]+(?:\?[^\s.,;!?]*)?(?:#[^\s.,;!?]*)?)/gi,
      (match, www, domain) => {
        return `(https://${www || ''}${domain.toLowerCase()})`;
      }
    );

    // Handle Twitter/X URLs - convert to proper links
    formattedText = formattedText.replace(
      /(?<!\(|\[|:\/\/)(?:https?:\/\/)?(?:www\.)?((?:twitter\.com|x\.com)\/[^\s.,;!?]+)/gi,
      '(https://$1)'
    );

    return formattedText;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'formatting social media links', {
      textLength: text?.length || 0,
    });
    console.error(`Social media formatting error: ${errorResponse.message}`);
    return text;
  }
}

/**
 * Format YouTube links with proper handling and descriptive text
 * @param {string} text - Text to process
 * @returns {string} - Text with formatted YouTube links
 */
function formatYouTubeLinks(text) {
  try {
    // Input validation
    if (typeof text !== 'string') {
      return text;
    }
    
    let formattedText = text;

    // Fix YouTube links appearing on separate lines by removing the preceding newline
    formattedText = formattedText.replace(
      /\n(www\.youtube|youtube\.com|https:\/\/(?:www\.)?youtube\.com)/g,
      ' $1'
    );
    formattedText = formattedText.replace(
      /\.\n(www\.youtube|youtube\.com|https:\/\/(?:www\.)?youtube\.com)/g,
      '. $1'
    );

    // Extract video titles or use generic YouTube Link text - ensure correct URL
    formattedText = formattedText.replace(
      /(^|\s)((?:www\.)?youtube\.com\/watch\?v=([^\s&.,;!?]+)|youtu\.be\/([^\s.,;!?]+))(?=[\s.,;!?]|$)/g,
      (match, prefix, url) => {
        // Get the actual video ID, whether it came from the first or second pattern
        // const videoId = videoId1 || videoId2; // Currently unused
        // Make sure we have the proper full URL with protocol
        let fullUrl = url;
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        return `${prefix}[YouTube Video](${fullUrl})`;
      }
    );

    // Fix YouTube links that are already in brackets but not properly formatted as markdown links
    formattedText = formattedText.replace(
      /\[((?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^\s&]+)[^\s\]]*|youtu\.be\/([^\s\]]+))\](?!\()/g,
      (match, url) => {
        // Make sure we have the proper full URL with protocol
        let fullUrl = url;
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        return `[YouTube Video](${fullUrl})`;
      }
    );

    // Fix YouTube URLs that are missing protocol
    formattedText = formattedText.replace(
      /\((?!https?:\/\/)(www\.youtube|youtube\.com)/g,
      '(https://$1'
    );

    return formattedText;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'formatting YouTube links', {
      textLength: text?.length || 0,
    });
    console.error(`YouTube formatting error: ${errorResponse.message}`);
    return text;
  }
}

/**
 * Format Starsector forum links with specific handling for fractalsoftworks.com
 * @param {string} text - Text to process
 * @returns {string} - Text with formatted Starsector links
 */
function formatStarsectorLinks(text) {
  try {
    // Input validation
    if (typeof text !== 'string') {
      return text;
    }
    
    let formattedText = text;

    // Fix any fractalsoftworks URLs specifically (common issue)
    formattedText = formattedText.replace(
      /https:\/\/fractalsoftworks\/\.com/g,
      'https://fractalsoftworks.com'
    );
    formattedText = formattedText.replace(
      /https:\/\/fractalsoftworks\./g,
      'https://fractalsoftworks.com'
    );
    formattedText = formattedText.replace(
      /(https?:\/\/)?fractalsoftworks\/\./g,
      'https://fractalsoftworks.'
    );
    formattedText = formattedText.replace(
      /\(https:\/\/fractalsoftworks\//g,
      '(https://fractalsoftworks.'
    );

    // Fix forum URLs with specific patterns (seen in screenshot)
    formattedText = formattedText.replace(
      /\(https:\/\/\[fractalsoftworks\.com\]/g,
      '(https://fractalsoftworks.com'
    );
    formattedText = formattedText.replace(
      /\(https:\/\/fractalsoftworks\.comcom/g,
      '(https://fractalsoftworks.com'
    );

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
    formattedText = formattedText.replace(
      /\[\[fractalsoftworks\.com\]\(https:\/\/fractalsoftworks(?:\.com)?\//g,
      '[fractalsoftworks.com](https://fractalsoftworks.com/'
    );

    // Fix specific forum link format issues seen in Discord messages
    formattedText = formattedText.replace(
      /\(https:\/\/fractalsoftworks\.com\)\(\/forum\/index\.php\?topic=(\d+)\.(\d+)\)/g,
      '(https://fractalsoftworks.com/forum/index.php?topic=$1.$2)'
    );

    // Convert plain text URLs to proper links with descriptive text
    formattedText = formattedText.replace(
      /(?<!\(|\[|:\/\/)((?:www\.)?fractalsoftworks\.com\/forum\/index\.php\?topic=(\d+)\.(\d+))/g,
      (match, url) => {
        let fullUrl = url;
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        return `[Starsector Forum](${fullUrl})`;
      }
    );

    // Fix specific source references with forum URLs
    formattedText = formattedText.replace(
      /\(\[([\d]+)\]\[(?:https:\/\/)?fractalsoftworks\.com([^\]]+)\]/g,
      (match, sourceNum, path) => {
        const fullUrl = 'https://fractalsoftworks.com' + path;
        return `[(Source ${sourceNum})](${fullUrl})`;
      }
    );

    // Fix forum URLs with missing http prefix and add descriptive text
    formattedText = formattedText.replace(
      /\(fractalsoftworks\.com(\/forum\/index\.php\?topic=\d+\.\d+)\)/g,
      (match, path) => {
        const fullUrl = 'https://fractalsoftworks.com' + path;
        return `([Starsector Forum](${fullUrl}))`;
      }
    );
    formattedText = formattedText.replace(
      /\(fractalsoftworks\.com/g,
      '(https://fractalsoftworks.com'
    );
    formattedText = formattedText.replace(
      /\[fractalsoftworks\.com\](?!\()/g,
      '[Starsector Website](https://fractalsoftworks.com)'
    );

    // Fix direct URLs that are inside markdown brackets but not properly formatted
    formattedText = formattedText.replace(
      /\[(?:https?:\/\/)?(?:www\.)?fractalsoftworks\.com\/forum\/index\.php\?topic=(\d+)\.(\d+)\](?!\()/g,
      (match, topicId1, topicId2) => {
        const fullUrl = `https://fractalsoftworks.com/forum/index.php?topic=${topicId1}.${topicId2}`;
        return `[Starsector Forum](${fullUrl})`;
      }
    );

    // Fix specific forum link pattern seen in the screenshot
    formattedText = formattedText.replace(
      /\(https:\/\/fractalsoftworks(?:\.com)?com\/forum\/index\.php\?topic=(\d+)\.(\d+)\)/g,
      '(https://fractalsoftworks.com/forum/index.php?topic=$1.$2)'
    );

    return formattedText;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'formatting Starsector links', {
      textLength: text?.length || 0,
    });
    console.error(`Starsector formatting error: ${errorResponse.message}`);
    return text;
  }
}

/**
 * Fix general link formatting issues
 * @param {string} text - Text to process
 * @returns {string} - Text with fixed link formatting
 */
function fixLinkFormatting(text) {
  try {
    // Input validation
    if (typeof text !== 'string') {
      return text;
    }
    
    let formattedText = text;

    // Fix malformed markdown links missing closing parentheses
    // Handle links at end of string
    formattedText = formattedText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)$/g, '[$1]($2)');
    // Handle links followed by space and more text
    formattedText = formattedText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\s/g, '[$1]($2) ');
    // Handle links followed by other text (like "and")
    formattedText = formattedText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\s+(\w)/g, '[$1]($2) $3');

    // Fix links with improper spacing in Markdown syntax - excluding source references
    // Only add a space after a closing bracket if it's not part of a source reference pattern
    formattedText = formattedText.replace(/\]([^\s()])(?!\()/g, '] $1');
    formattedText = formattedText.replace(/\)([^\s.,;:!?)])/g, ') $1');

    // Fix any source reference links with extra spaces
    formattedText = formattedText.replace(
      /\[\((\d+)\) \]\((https?:\/\/[^)]+)\)/g,
      (match, num, url) => `[(${num})](${url})`
    );

    // Remove any extra closing parentheses at the end of URLs
    formattedText = formattedText.replace(/(\(https?:\/\/[^)]+)\)\)/g, '$1)');

    // Fix common Markdown link format issues (missing spaces, extra brackets)
    formattedText = formattedText.replace(/\]\(([^)]+)\)\(([^)]+)\)/g, ']($1)');

    // Fix nested parentheses in URLs for source references
    formattedText = formattedText.replace(/\(\[(\d+)\]\)\(([^)]+)\)/g, '[(Source $1)]($2)');

    // Handle the specific pattern in the screenshot - convert from
    // ([5][https://[[fractalsoftworks.com](https://fractalsoftworks/.com/forum/index.php?topic=13667.705)).
    formattedText = formattedText.replace(
      /\(\[([\d]+)\](?:\[[^\]]*\])?\[([^\]]+)\]\((https?:\/\/[^)]+)\)\)/g,
      '[(Source $1)]($3)'
    );

    return formattedText;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'fixing link formatting', {
      textLength: text?.length || 0,
    });
    console.error(`Link formatting error: ${errorResponse.message}`);
    return text;
  }
}

/**
 * Apply all URL formatting functions to text
 * @param {string} text - Text to process
 * @returns {string} - Text with all URL formatting applied
 */
function formatAllUrls(text) {
  try {
    let formattedText = text;

    // Apply platform-specific formatting
    formattedText = formatSocialMediaLinks(formattedText);
    formattedText = formatYouTubeLinks(formattedText);
    formattedText = formatStarsectorLinks(formattedText);

    // Final cleanup pass
    formattedText = fixLinkFormatting(formattedText);

    return formattedText;
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'formatting all URLs', {
      textLength: text?.length || 0,
    });
    console.error(`URL formatting error: ${errorResponse.message}`);
    return text;
  }
}

module.exports = {
  formatSocialMediaLinks,
  formatYouTubeLinks,
  formatStarsectorLinks,
  fixLinkFormatting,
  formatAllUrls,
};
