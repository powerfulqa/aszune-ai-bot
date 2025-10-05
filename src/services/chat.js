/**
 * Chat message handler for the bot
 * Updated for v1.3.2 with source link formatting and truncation fixes
 */
const perplexityService = require('../services/perplexity-secure');
const ConversationManager = require('../utils/conversation');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
const commandHandler = require('../commands');
const messageFormatter = require('../utils/message-formatter');
const { chunkMessage, formatTablesForDiscord } = require('../utils/message-chunking');
const { ErrorHandler } = require('../utils/error-handler');
const { InputValidator } = require('../utils/input-validator');
const databaseService = require('../services/database');

const conversationManager = new ConversationManager();

/**
 * Sends a response message, handling long messages by chunking if needed
 * @param {Object} message - Discord.js message object
 * @param {string} responseText - The formatted response to send
 * @returns {Promise<void>}
 */
async function sendResponse(message, responseText) {
  // Access config inside function to prevent circular dependencies
  const config = require('../config/config');

  // Maximum length for Discord embeds (reduced to ensure we don't hit limits)
  // Further reduced to prevent truncation issues with source links and URL formatting
  const MAX_EMBED_LENGTH = config.MESSAGE_LIMITS?.EMBED_MAX_LENGTH ?? 1900;

  logger.debug(`Preparing to send response of length: ${responseText.length}`);

  // Split the message into chunks with our smaller max length
  const messageChunks = chunkMessage(responseText, MAX_EMBED_LENGTH);

  logger.debug(`Response split into ${messageChunks.length} chunks`);

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
  for (const [index, chunk] of messageChunks.entries()) {
    logger.debug(`Sending chunk ${index + 1}/${messageChunks.length}, length: ${chunk.length}`);

    const embed = messageFormatter.createCompactEmbed({
      color: config.COLORS.PRIMARY,
      description: chunk,
      footer: { text: `Aszai Bot (Part ${index + 1}/${messageChunks.length})` },
    });

    // Reply to the original message for the first chunk, then send as follow-ups
    if (index === 0) {
      await message.reply({ embeds: [embed] });
    } else {
      // Small delay between messages for better readability
      await new Promise((resolve) =>
        setTimeout(resolve, config.MESSAGE_LIMITS?.CHUNK_DELAY_MS || 1000)
      );
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
  // Early validation checks
  if (message.author.bot || !message.content) return null;

  const userId = message.author.id;

  // Validate user ID
  const userIdValidation = InputValidator.validateUserId(userId);
  if (!userIdValidation.valid) {
    logger.warn(`Invalid user ID: ${userIdValidation.error}`);
    return null;
  }

  // Process message content and handle validation
  const contentResult = await processMessageContent(message, userId);
  if (!contentResult.success) return null;

  // Handle rate limiting
  const rateLimitResult = await handleRateLimiting(message, userId);
  if (!rateLimitResult.success) return null;

  // Handle commands
  const commandResult = await handleCommandCheck(message, contentResult.sanitizedContent);
  if (!commandResult.success) return null;

  // Add sanitized message to history
  conversationManager.addMessage(userId, 'user', contentResult.sanitizedContent);

  return { userId, sanitizedContent: contentResult.sanitizedContent };
}

async function processMessageContent(message, userId) {
  // Validate and sanitize message content
  const contentValidation = InputValidator.validateAndSanitize(message.content, {
    type: 'message',
    strict: false, // Allow with warnings for better user experience
  });

  if (!contentValidation.valid) {
    await message.reply(`❌ ${contentValidation.error}`);
    return { success: false };
  }

  // Log warnings if any
  if (contentValidation.warnings.length > 0) {
    logger.warn(`Message sanitization warnings for user ${userId}:`, contentValidation.warnings);
  }

  return { success: true, sanitizedContent: contentValidation.sanitized };
}

async function handleRateLimiting(message, userId) {
  // Check for rate limiting
  if (conversationManager.isRateLimited(userId)) {
    await message.reply('Please wait a few seconds before sending another message.');
    return { success: false };
  }
  conversationManager.updateTimestamp(userId);
  return { success: true };
}

async function handleCommandCheck(message, sanitizedContent) {
  // Check for commands
  if (sanitizedContent.startsWith('!')) {
    await commandHandler.handleTextCommand(message);
    return { success: false };
  }
  return { success: true };
}

/**
 * Generates and formats bot response
 * @param {string} userId - User ID to get history for
 * @returns {Promise<string>} The formatted response
 */
async function generateBotResponse(userId) {
  // Access config inside function to prevent circular dependencies
  const config = require('../config/config');

  const history = conversationManager.getHistory(userId);
  const reply = await perplexityService.generateChatResponse(history);

  // Format tables for Discord embeds before other processing
  const tableFormattedReply = formatTablesForDiscord(reply);

  // Add emojis based on reply content (limit number of emojis on Pi)
  const emojiLimit = config.PI_OPTIMIZATIONS?.ENABLED
    ? config.PI_OPTIMIZATIONS.EMBEDDED_REACTION_LIMIT
    : 10;
  const enhancedReply = emojiManager.addEmojisToResponse(tableFormattedReply, {
    maxEmojis: emojiLimit,
  });

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
    const userId = processedData.userId;
    const messageContent = processedData.sanitizedContent;

    // Store user message and update stats in database
    if (userId && messageContent) {
      try {
        databaseService.addUserMessage(userId, messageContent);
        databaseService.updateUserStats(userId, {
          message_count: 1,
          last_active: new Date().toISOString(),
        });
      } catch (dbError) {
        logger.warn('Database operation failed:', dbError.message);
        // Continue processing even if database fails
      }
    }

    // Get conversation history - use existing conversation manager history
    const conversationHistory = conversationManager.getHistory(processedData.userId);

    // Supplement with recent database messages if conversation is new
    if (conversationHistory.length <= 1 && userId) {
      try {
        const recentMessages = databaseService.getUserMessages(userId, 5);
        if (recentMessages && recentMessages.length > 0) {
          const dbHistory = recentMessages.reverse().map((msg) => ({
            role: 'user',
            content: msg,
          }));

          // Add database history to conversation manager for context
          dbHistory.forEach((msg) => {
            conversationManager.addMessage(userId, msg.role, msg.content);
          });
        }
      } catch (dbError) {
        logger.warn('Failed to load conversation history from database:', dbError.message);
        // Continue with in-memory history only
      }
    }

    // Generate and format the response
    const formattedReply = await generateBotResponse(processedData.userId);

    // Add bot's reply to the conversation history
    conversationManager.addMessage(processedData.userId, 'assistant', formattedReply);

    // Store bot response in database
    if (userId) {
      try {
        databaseService.addBotResponse(userId, formattedReply);
      } catch (dbError) {
        logger.warn('Failed to store bot response in database:', dbError.message);
        // Continue even if database storage fails
      }
    }

    // Send the response (handles chunking if needed)
    await sendResponse(message, formattedReply);

    // Skip reactions in low CPU mode
    const config = require('../config/config');
    if (!config.PI_OPTIMIZATIONS?.LOW_CPU_MODE) {
      await emojiManager.addReactionsToMessage(message);
    }
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'chat generation', {
      userId: processedData?.userId || 'unknown',
      messageLength: message.content?.length || 0,
      sanitizedContent: processedData?.sanitizedContent?.length || 0,
    });

    // Send user-friendly error message as embed
    const config = require('../config/config');
    const embed = messageFormatter.createCompactEmbed({
      color: config.COLORS.PRIMARY,
      description: errorResponse.message,
      footer: { text: 'Aszai Bot' },
    });

    await message.reply({ embeds: [embed] });
  }
}

// CRITICAL: Maintain all export patterns for backward compatibility
module.exports = handleChatMessage;
module.exports.handleChatMessage = handleChatMessage;
module.exports.default = handleChatMessage;
