/**
 * Utility for handling emoji reactions
 */
const config = require('../config/config');

// Legacy emoji mappings - ensuring compatibility with older tests
const legacyEmojiMap = {
  happy: '😊',
  love: '❤️',
  sad: '😢',
  congratulations: '🎉',
  thanks: '🙏',
  awesome: '😎',
  help: '🆘',
  welcome: '👋',
};

class EmojiManager {
  constructor() {
    this.reactions = config.EMOJI_REACTIONS || config.REACTIONS || legacyEmojiMap;
  }
  
  /**
   * Process the message content and add emojis to the response based on keywords
   * @param {string} content - The message content to analyze
   * @returns {string} - The original message with emojis added
   */
  addEmojisToResponse(content) {
    let modifiedContent = content;
    
    for (const [keyword, emoji] of Object.entries(this.reactions)) {
      if (content.toLowerCase().includes(keyword)) {
        modifiedContent += ` ${emoji}`;
      }
    }
    
    return modifiedContent;
  }
  
  /**
   * Append emojis to text based on whole-word keyword matches (case-insensitive)
   * This maintains compatibility with the older utils/emoji.js implementation
   * @param {string} text - The text to analyze
   * @returns {string} - The text with emojis appended
   */
  appendEmoji(text) {
    if (!text) return text;
    
    let result = text;
    
    // Using the legacy emoji map for backwards compatibility with tests
    for (const [keyword, emoji] of Object.entries(legacyEmojiMap)) {
      // Only match whole words (case-insensitive)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        result += ` ${emoji}`;
      }
    }
    
    return result;
  }
  
  /**
   * Get emojis to react with based on message content
   * @param {string} content - The message content to analyze
   * @returns {Array<string>} - Array of emoji characters to react with
   */
  getReactionsForMessage(content) {
    const reactEmojis = [];
    
    for (const [keyword, emoji] of Object.entries(this.reactions)) {
      if (content.toLowerCase().includes(keyword)) {
        reactEmojis.push(emoji);
      }
    }
    
    return reactEmojis;
  }
  
  /**
   * Add reactions to a message
   * @param {Object} message - Discord.js message object
   * @returns {Promise<void>}
   */
  async addReactionsToMessage(message) {
    const emojis = this.getReactionsForMessage(message.content);
    
    for (const emoji of emojis) {
      try {
        await message.react(emoji);
      } catch (error) {
        console.error(`Error reacting with ${emoji}:`, error);
      }
    }
  }
}

// Create a singleton instance
const emojiManager = new EmojiManager();

// Create a backwards-compatible function that can be called directly
const appendEmojiFunction = emojiManager.appendEmoji.bind(emojiManager);

// Export the manager with the appendEmoji function as a property for backwards compatibility
module.exports = emojiManager;
module.exports.default = appendEmojiFunction;
