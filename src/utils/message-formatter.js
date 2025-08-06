/**
 * Message formatter utility for creating compact responses on Pi
 * Helps reduce the size and complexity of Discord messages to save resources
 */
const config = require('../config/config');

class MessageFormatter {
  constructor() {
    this.compact = config.PI_OPTIMIZATIONS && 
                  config.PI_OPTIMIZATIONS.ENABLED && 
                  config.PI_OPTIMIZATIONS.COMPACT_MODE;
  }

  /**
   * Format a bot response message optimized for Pi performance
   * @param {String} content - The original content
   * @param {Object} options - Formatting options
   * @returns {String} - The formatted content
   */
  formatResponse(content, options = {}) {
    if (!this.compact) return content;
    
    let result = content;
    
    // Remove excessive whitespace
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Process source links with proper markdown formatting
    result = this._formatSourceLinks(result);
    
    // Break long paragraphs
    result = this._breakLongParagraphs(result);
    
    // Only truncate for embeds or when explicitly requested, not for chunked messages
    const maxLength = options.maxLength;
    if (maxLength && result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }
    
    return result;
  }
  
  /**
   * Format source links in markdown format to make them clickable
   * @param {String} text - Text to process
   * @returns {String} - Text with formatted source links
   * @private
   */
  _formatSourceLinks(text) {
    // Find patterns like (1) that refer to a URL somewhere in the text
    const sourceRefRegex = /\((\d+)\)/g;
    const urlRegex = /\(?(https?:\/\/[^\s)]+)\)?/g;
    
    // Collect all URLs
    const urls = [];
    let urlMatch;
    while ((urlMatch = urlRegex.exec(text)) !== null) {
      urls.push(urlMatch[1]);
    }
    
    // If we have URLs, attempt to associate them with source numbers
    if (urls.length > 0) {
      // Replace source references with markdown links
      text = text.replace(sourceRefRegex, (match, sourceNum) => {
        const sourceIndex = parseInt(sourceNum) - 1;
        if (sourceIndex >= 0 && sourceIndex < urls.length) {
          return `[(${sourceNum})](${urls[sourceIndex]})`;
        }
        return match;
      });
      
      // Clean up any raw URLs left in the text
      text = text.replace(urlRegex, (match, url) => {
        // If the URL is part of a markdown link already, leave it
        const prevChar = text.charAt(text.indexOf(match) - 1);
        if (prevChar === '(') {
          return match;
        }
        // Otherwise, hide it with a markdown link using the domain name
        try {
          const domain = new URL(url).hostname;
          return `[${domain}](${url})`;
        } catch (e) {
          return match;
        }
      });
    }
    
    return text;
  }
  
  /**
   * Break long paragraphs into shorter ones to improve rendering performance
   * @param {String} text - Text to process
   * @returns {String} - Processed text
   * @private
   */
  _breakLongParagraphs(text) {
    const paragraphs = text.split('\n\n');
    const maxParaLength = 300;
    
    const processed = paragraphs.map(para => {
      if (para.length <= maxParaLength) return para;
      
      // Try to break at sentence boundaries
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      let result = '';
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxParaLength) {
          result += currentChunk + '\n\n';
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      
      return result + currentChunk;
    });
    
    return processed.join('\n\n');
  }
  
  /**
   * Create a compact embed for Discord messages
   * @param {Object} embedData - Original embed data
   * @returns {Object} - Optimized embed data
   */
  createCompactEmbed(embedData) {
    if (!this.compact) return embedData;
    
    const compactEmbed = { ...embedData };
    
    // Keep only essential fields
    if (compactEmbed.fields && compactEmbed.fields.length > 0) {
      compactEmbed.fields = compactEmbed.fields.slice(0, 2);
    }
    
    // Simplify description for embeds (embeds have a stricter limit)
    if (compactEmbed.description) {
      compactEmbed.description = this.formatResponse(compactEmbed.description, { maxLength: 1500 });
    }
    
    // Remove footer on low resource mode
    if (config.PI_OPTIMIZATIONS.LOW_CPU_MODE && compactEmbed.footer) {
      delete compactEmbed.footer;
    }
    
    return compactEmbed;
  }
}

module.exports = new MessageFormatter();
