/**
 * Chat message handler for the bot
 * Updated for v1.3.2 with source link formatting and truncation fixes
 */
const perplexityService = require('../services/perplexity-secure');
const ConversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const config = require('../config/config');
const commandHandler = require('../commands');
const { debounce } = require('../utils/debouncer');
const messageFormatter = require('../utils/message-formatter');
const { chunkMessage } = require('../utils/enhanced-message-chunker');
const { ErrorHandler, ERROR_TYPES } = require('../utils/error-handler');

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
 * Sends a response message, handling long messages by chunking if needed
 * @param {Object} message - Discord.js message object
 * @param {string} responseText - The formatted response to send
 * @returns {Promise<void>}
 */
async function sendResponse(message, responseText) {
  // Maximum length for Discord embeds (reduced to ensure we don't hit limits)
  // Further reduced to prevent truncation issues with source links and URL formatting
  const MAX_EMBED_LENGTH = config.MESSAGE_LIMITS.EMBED_MAX_LENGTH;
  
  console.log(`Preparing to send response of length: ${responseText.length}`);
  
  // Split the message into chunks with our smaller max length
  const messageChunks = chunkMessage(responseText, MAX_EMBED_LENGTH);
  
  console.log(`Response split into ${messageChunks.length} chunks`);
  
  // If there's only one chunk, send it as normal
  if (messageChunks.length === 1) {
    // Create an embed for the reply (use compact embed on Pi)
    const embed = messageFormatter.createCompactEmbed({
      color: config.COLORS.PRIMARY,
      description: responseText,
      footer: { text: 'Aszai Bot' },
    });
    
    await message.reply({ embeds: [embed] });
    return;
  }
  
  // Send multiple chunks sequentially
  let firstReply = null;
  
  for (const [index, chunk] of messageChunks.entries()) {
    console.log(`Sending chunk ${index + 1}/${messageChunks.length}, length: ${chunk.length}`);
    
    const embed = messageFormatter.createCompactEmbed({
      color: config.COLORS.PRIMARY,
      description: chunk,
      footer: { text: `Aszai Bot (Part ${index + 1}/${messageChunks.length})` },
    });
    
    // Reply to the original message for the first chunk, then send as follow-ups
    if (index === 0) {
      firstReply = await message.reply({ embeds: [embed] });
    } else {
      // Small delay between messages for better readability
      await new Promise(resolve => setTimeout(resolve, config.MESSAGE_LIMITS.CHUNK_DELAY_MS));
      await message.channel.send({ embeds: [embed] });
    }
  }
}

/**
 * Processes user message and prepares for response
 * @param {Object} message - Discord.js message object
 * @returns {Promise<Object|null>} processedData or null if early return
 */
async function processUserMessage(message) {
  if (message.author.bot || !message.content) return null;
  
  const userId = message.author.id;
  
  // Check for rate limiting
  if (conversationManager.isRateLimited(userId)) {
    await message.reply('Please wait a few seconds before sending another message.');
    return null;
  }
  conversationManager.updateTimestamp(userId);
  
  // Check for commands
  if (message.content.startsWith('!')) {
    const commandResult = await commandHandler.handleTextCommand(message);
    return null;
  }
  
  // Add message to history
  conversationManager.addMessage(userId, 'user', message.content);
  
  return { userId };
}

/**
 * Generates and formats bot response
 * @param {string} userId - User ID to get history for
 * @returns {Promise<string>} The formatted response
 */
async function generateBotResponse(userId) {
  const history = conversationManager.getHistory(userId);
  const reply = await perplexityService.generateChatResponse(history);
  
  // Add emojis based on reply content (limit number of emojis on Pi)
  const emojiLimit = config.PI_OPTIMIZATIONS.ENABLED ? 
    config.PI_OPTIMIZATIONS.EMBEDDED_REACTION_LIMIT : 10;
  const enhancedReply = emojiManager.addEmojisToResponse(reply, { maxEmojis: emojiLimit });
  
  // Format response for Pi if optimizations enabled
  return messageFormatter.formatResponse(enhancedReply);
}

/**
 * Handle an incoming chat message
 * @param {Object} message - Discord.js message object
 * @returns {Promise<void>}
 */
async function handleChatMessage(message) {
  // Process the incoming message
  const processedData = await processUserMessage(message);
  if (!processedData) return;
  
  // Show typing indicator
  message.channel.sendTyping();
  
  try {
    // Generate and format the response
    const formattedReply = await generateBotResponse(processedData.userId);
    
    // Add bot's reply to the conversation history
    conversationManager.addMessage(processedData.userId, 'assistant', formattedReply);
    
    // Send the response (handles chunking if needed)
    await sendResponse(message, formattedReply);
    
    // Skip reactions in low CPU mode
    if (!config.PI_OPTIMIZATIONS.LOW_CPU_MODE) {
      await emojiManager.addReactionsToMessage(message);
    }
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'chat generation', {
      userId: processedData.userId,
      messageLength: message.content?.length || 0
    });
    
    // Send user-friendly error message
    message.reply(errorResponse.message);
  }
}

module.exports = handleChatMessage;
