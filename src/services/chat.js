/**
 * Chat message handler for the bot
 */
const perplexityService = require('../services/perplexity');
const conversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const config = require('../config/config');
const commandHandler = require('../commands');

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
    
    // Add emojis based on reply content
    const enhancedReply = emojiManager.addEmojisToResponse(reply);
    
    // Add bot's reply to the conversation history
    conversationManager.addMessage(userId, 'assistant', enhancedReply);
    
    // Create an embed for the reply
    const embed = {
      color: config.COLORS.PRIMARY,
      description: enhancedReply,
      footer: { text: 'Aszune AI Bot' },
    };
    
    await message.reply({ embeds: [embed] });
    
    // Add reactions to the user's message based on content
    await emojiManager.addReactionsToMessage(message);
  } catch (error) {
    const errorMessage = logger.handleError(error, 'chat generation');
    message.reply(errorMessage);
  }
}

module.exports = handleChatMessage;
