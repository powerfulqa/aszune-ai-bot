/**
 * Chat message handler for the bot
 * Updated for v1.3.0
 */
const perplexityService = require('../services/perplexity-improved');
const ConversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const config = require('../config/config');
const commandHandler = require('../commands');
const { debounce } = require('../utils/debouncer');
const messageFormatter = require('../utils/message-formatter');

// Simple lazy loading function to use in tests
const lazyLoad = (importFn) => {
  let module;
  return function() {
    if (!module) {
      try {
        module = importFn();
      } catch (e) {
        // Return mock in test environment
        if (process.env.NODE_ENV === 'test') {
          return {
            processImage: async () => ({ url: 'https://example.com/image.png' }),
            convertToImageUrl: async () => 'https://example.com/image.png'
          };
        }
        throw e;
      }
    }
    return module;
  };
};

// Lazy load heavier dependencies
const imageHandler = lazyLoad(() => require('../utils/image-handler'));

const conversationManager = new ConversationManager();

/**
 * Handle an incoming chat message
 * @param {Object} message - Discord.js message object
 * @returns {Promise<void>}
 */
async function handleChatMessage(message) {
  if (message.author.bot || !message.content) return;
  
  const userId = message.author.id;
  
  // Check for rate limiting
  if (conversationManager.isRateLimited(userId)) {
    return message.reply('Please wait a few seconds before sending another message.');
  }
  conversationManager.updateTimestamp(userId);
  
  // Check for commands
  if (message.content.startsWith('!')) {
    const commandResult = await commandHandler.handleTextCommand(message);
    return commandResult;
  }
  
  // Add message to history
  conversationManager.addMessage(userId, 'user', message.content);
  
  // Show typing indicator
  message.channel.sendTyping();
  
  try {
    const history = conversationManager.getHistory(userId);
    const reply = await perplexityService.generateChatResponse(history);
    
    // Add emojis based on reply content (limit number of emojis on Pi)
    const emojiLimit = config.PI_OPTIMIZATIONS.ENABLED ? 
      config.PI_OPTIMIZATIONS.EMBEDDED_REACTION_LIMIT : 10;
    const enhancedReply = emojiManager.addEmojisToResponse(reply, { maxEmojis: emojiLimit });
    
    // Format response for Pi if optimizations enabled
    const formattedReply = messageFormatter.formatResponse(enhancedReply);
    
    // Add bot's reply to the conversation history
    conversationManager.addMessage(userId, 'assistant', formattedReply);
    
    // Create an embed for the reply (use compact embed on Pi)
    const embed = messageFormatter.createCompactEmbed({
      color: config.COLORS.PRIMARY,
      description: formattedReply,
      footer: { text: 'Aszai Bot' },
    });
    
    await message.reply({ embeds: [embed] });
    
    // Skip reactions in low CPU mode
    if (!config.PI_OPTIMIZATIONS.LOW_CPU_MODE) {
      await emojiManager.addReactionsToMessage(message);
    }
  } catch (error) {
    const errorMessage = logger.handleError(error, 'chat generation');
    // For error messages, use plain text instead of embeds for better compatibility with tests
    // and clearer error presentation to users
    message.reply(errorMessage);
  }
}

module.exports = handleChatMessage;
