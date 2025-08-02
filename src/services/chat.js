/**
 * Chat message handler for the bot
 * Updated for v1.3.0 with security fixes
 */
const perplexityService = require('../services/perplexity-secure');
const ConversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const config = require('../config/config');
const commandHandler = require('../commands');
const { debounce } = require('../utils/debouncer');
const messageFormatter = require('../utils/message-formatter');
const { chunkMessage } = require('../utils/message-chunker');

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
  const MAX_EMBED_LENGTH = 1800; // Discord's max is 2000, but we use a smaller value to be safe
  
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
      await new Promise(resolve => setTimeout(resolve, 800));
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
    const errorMessage = logger.handleError(error, 'chat generation');
    // Send error message using our sendResponse function but in plain text
    // Just reply directly for errors as they're typically shorter
    message.reply(errorMessage);
  }
}

module.exports = handleChatMessage;
