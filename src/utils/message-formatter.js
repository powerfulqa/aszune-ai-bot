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
    
    // Break long paragraphs
    result = this._breakLongParagraphs(result);
    
    // Truncate if over limit
    const maxLength = options.maxLength || 1500;
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }
    
    return result;
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
    
    // Simplify description
    if (compactEmbed.description) {
      compactEmbed.description = this.formatResponse(compactEmbed.description, { maxLength: 500 });
    }
    
    // Remove footer on low resource mode
    if (config.PI_OPTIMIZATIONS.LOW_CPU_MODE && compactEmbed.footer) {
      delete compactEmbed.footer;
    }
    
    return compactEmbed;
  }
}

module.exports = new MessageFormatter();
