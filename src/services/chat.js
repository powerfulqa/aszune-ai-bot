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
const naturalLanguageReminderProcessor = require('../utils/natural-language-reminder');

const conversationManager = new ConversationManager();

/**
 * Check if a message should be ignored by the bot
 * @param {Object} message - Discord.js message object
 * @returns {boolean} - True if the message should be ignored
 */
function shouldIgnoreMessage(message) {
  const content = message.content.trim();
  
  // Ignore empty messages
  if (!content) return true;
  
  // Ignore Discord system commands and mentions
  const systemCommands = [
    '@everyone',
    '@here',
    '@channel',
  ];
  
  // Check if message is just a system command
  if (systemCommands.includes(content.toLowerCase())) {
    logger.debug(`Ignoring Discord system command: ${content}`);
    return true;
  }
  
  // Ignore messages that are only mentions of other users (not the bot)
  const mentionRegex = /^<@!?(\d+)>$/;
  const mentionMatch = content.match(mentionRegex);
  if (mentionMatch) {
    const mentionedUserId = mentionMatch[1];
    const botId = message.client.user?.id;
    
    // If it's just a mention of someone else (not the bot), ignore it
    if (botId && mentionedUserId !== botId) {
      logger.debug(`Ignoring mention of other user: ${mentionedUserId}`);
      return true;
    }
  }
  
  // Ignore messages that start with common bot prefixes for other bots
  const commonBotPrefixes = ['!', '/', '$', '%', '&', '?', '.', '-', '+', '='];
  if (commonBotPrefixes.some(prefix => content.startsWith(prefix))) {
    // But allow our own commands through
    if (!content.startsWith('!remind') && !content.startsWith('!summ') && !content.startsWith('!help')) {
      logger.debug(`Ignoring message with bot prefix: ${content.charAt(0)}`);
      return true;
    }
  }
  
  return false;
}

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

  // Ignore Discord system commands and mentions not directed at the bot
  if (shouldIgnoreMessage(message)) return null;

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
 * Check if message contains a natural language reminder request
 * @param {string} sanitizedContent - Sanitized message content
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @param {string} serverId - Server ID
 * @returns {Promise<Object|null>} Reminder result or null
 */
async function checkForReminderRequest(sanitizedContent, userId, channelId, serverId) {
  try {
    // Check if this looks like a reminder request
    if (!naturalLanguageReminderProcessor.isReminderRequest(sanitizedContent)) {
      return null;
    }

    logger.info(`Detected potential reminder request from user ${userId}: "${sanitizedContent}"`);

    // Process the reminder request
    const reminderData = await naturalLanguageReminderProcessor.processReminderRequest(
      sanitizedContent,
      userId,
      channelId,
      serverId
    );

    if (!reminderData.success) {
      logger.warn(`Failed to process reminder request: ${reminderData.reason}`);
      return null;
    }

    // Look up the event and set the reminder
    const reminderResult =
      await naturalLanguageReminderProcessor.lookupAndSetReminder(reminderData);

    if (reminderResult.success) {
      logger.info(`Successfully set reminder for user ${userId} about "${reminderData.event}"`);
    } else {
      logger.info(`Could not set reminder for user ${userId}: ${reminderResult.reason}`);
    }

    return reminderResult;
  } catch (error) {
    logger.error('Error checking for reminder request:', error);
    return null;
  }
}

/**
 * Generates and formats bot response
 * @param {string} userId - User ID to get history for
 * @returns {Promise<string>} The formatted response
 */
async function generateBotResponse(userId) {
  // Access config inside function to prevent circular dependencies
  const config = require('../config/config');

  try {
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
  } catch (apiError) {
    // Handle specific API errors
    if (apiError.message && apiError.message.includes('should alternate with assistant message')) {
      logger.warn(`API 400 error for user ${userId}: Invalid message format - ${apiError.message}`);
      // Clear conversation history to fix the alternating message issue
      conversationManager.clearConversation(userId);
      throw new Error('I encountered an issue with our conversation. Let\'s start fresh - please try your message again.');
    }
    
    // Re-throw other errors to be handled by the main error handler
    throw apiError;
  }
}

/**
 * Track performance metrics for chat operations
 * @param {string} metricName - Name of the metric
 * @param {number} value - Metric value
 * @param {Object} metadata - Additional metadata
 */
async function trackChatPerformance(metricName, value, metadata = {}) {
  try {
    databaseService.logPerformanceMetric(metricName, value, metadata);
  } catch (metricError) {
    logger.warn(`Failed to log performance metric ${metricName}:`, metricError.message);
  }
}

/**
 * Process and store user message in database
 * @param {string} userId - User ID
 * @param {string} messageContent - Message content
 */
async function processUserMessageStorage(userId, messageContent) {
  if (!userId || !messageContent) return;

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

/**
 * Load conversation history from database if needed
 * @param {string} userId - User ID
 * @param {string} messageContent - Current message content
 * @returns {Array} Conversation history
 */
async function loadConversationHistory(userId, messageContent) {
  let conversationHistory = conversationManager.getHistory(userId);

  // Supplement with database conversation history if conversation is new or short
  if (conversationHistory.length <= 1 && userId) {
    try {
      // Access config inside function to prevent circular dependencies
      const config = require('../config/config');
      const dbLimit = config.DATABASE_CONVERSATION_LIMIT || 20;

      const dbConversationHistory = databaseService.getConversationHistory(userId, dbLimit);
      if (dbConversationHistory && dbConversationHistory.length > 0) {
        // Add database history to conversation manager for context
        // Filter out recent identical messages using timestamps to prevent duplication
        const cutoffTime = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
        const historicalMessages = dbConversationHistory.filter(
          (msg) => msg.message !== messageContent || msg.timestamp < cutoffTime
        );

        historicalMessages.forEach((msg) => {
          conversationManager.addMessage(userId, msg.role, msg.message);
        });

        // Update conversation history after adding database history
        conversationHistory = conversationManager.getHistory(userId);
      }
    } catch (dbError) {
      logger.warn('Failed to load conversation history from database:', dbError.message);
      // Continue with in-memory history only
    }
  }

  return conversationHistory;
}

/**
 * Store bot response in database
 * @param {string} userId - User ID
 * @param {string} response - Bot response
 * @param {number} responseTime - Time taken to generate response
 */
async function storeBotResponse(userId, response, responseTime) {
  if (!userId) return;

  try {
    databaseService.addBotResponse(userId, response, responseTime);
  } catch (dbError) {
    logger.warn('Failed to store bot response in database:', dbError.message);
    // Continue even if database storage fails
  }
}

/**
 * Handle an incoming chat message
 * @param {Object} message - Discord.js message object
 * @returns {Promise<void>}
 */
async function handleChatMessage(message) {
  const startTime = Date.now();
  const initialMemoryUsage = process.memoryUsage().heapUsed;

  // Process the incoming message
  const processedData = await processUserMessage(message);
  if (!processedData) return null;

  // Show typing indicator
  message.channel.sendTyping();

  try {
    const userId = processedData.userId;
    const messageContent = processedData.sanitizedContent;

    // Store user message and update stats in database
    await processUserMessageStorage(userId, messageContent);

    // Load conversation history
    const conversationHistory = await loadConversationHistory(userId, messageContent);

    // Check for natural language reminder requests
    const reminderResult = await checkForReminderRequest(
      messageContent,
      userId,
      message.channel.id,
      message.guild?.id || 'DM'
    );

    // If a reminder was processed, respond with the reminder result
    if (reminderResult) {
      await sendReminderResponse(message, reminderResult);
      return;
    }

    // Generate and format the response
    const responseStartTime = Date.now();
    const formattedReply = await generateBotResponse(processedData.userId);
    const responseTime = Date.now() - responseStartTime;

    // Add bot's reply to the conversation history
    conversationManager.addMessage(processedData.userId, 'assistant', formattedReply);

    // Store bot response in database
    await storeBotResponse(userId, formattedReply, responseTime);

    // Send the response (handles chunking if needed)
    await sendResponse(message, formattedReply);

    // Skip reactions in low CPU mode
    const config = require('../config/config');
    if (!config.PI_OPTIMIZATIONS?.LOW_CPU_MODE) {
      await emojiManager.addReactionsToMessage(message);
    }

    // Track performance metrics
    await trackPerformanceMetrics(
      startTime,
      initialMemoryUsage,
      userId,
      messageContent,
      formattedReply,
      conversationHistory,
      responseTime
    );
  } catch (error) {
    await handleChatError(error, startTime, processedData, message);
  }
}

/**
 * Send reminder response to user
 * @param {Object} message - Discord message object
 * @param {Object} reminderResult - Result from reminder processing
 */
async function sendReminderResponse(message, reminderResult) {
  const config = require('../config/config');
  const embed = messageFormatter.createCompactEmbed({
    color: reminderResult.success ? config.COLORS.SUCCESS : config.COLORS.WARNING,
    description: reminderResult.response,
    footer: { text: 'Aszai Bot' },
  });

  await message.reply({ embeds: [embed] });
}

/**
 * Track performance metrics for chat operations
 * @param {number} startTime - Start time of operation
 * @param {number} initialMemoryUsage - Initial memory usage
 * @param {string} userId - User ID
 * @param {string} messageContent - Message content
 * @param {string} formattedReply - Bot response
 * @param {Array} conversationHistory - Conversation history
 * @param {number} responseTime - Response generation time
 */
async function trackPerformanceMetrics(
  startTime,
  initialMemoryUsage,
  userId,
  messageContent,
  formattedReply,
  conversationHistory,
  responseTime
) {
  const totalTime = Date.now() - startTime;
  const finalMemoryUsage = process.memoryUsage().heapUsed;
  const memoryDelta = finalMemoryUsage - initialMemoryUsage;

  await trackChatPerformance('chat_response_time', responseTime, {
    userId,
    messageLength: messageContent.length,
    responseLength: formattedReply.length,
    conversationHistoryLength: conversationHistory.length,
  });

  await trackChatPerformance('chat_total_time', totalTime, {
    userId,
    messageLength: messageContent.length,
  });

  await trackChatPerformance('memory_usage_delta', memoryDelta, {
    userId,
    operation: 'chat_message',
  });

  await trackChatPerformance('memory_usage_current', finalMemoryUsage, {
    userId,
    operation: 'chat_message_end',
  });
}

/**
 * Handle chat processing errors
 * @param {Error} error - The error that occurred
 * @param {number} startTime - Start time of operation
 * @param {Object} processedData - Processed message data
 * @param {Object} message - Discord message object
 */
async function handleChatError(error, startTime, processedData, message) {
  const totalTime = Date.now() - startTime;

  // Log error performance metrics
  await trackChatPerformance('chat_error_time', totalTime, {
    userId: processedData?.userId || 'unknown',
    error: error.message,
  });

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

// CRITICAL: Maintain all export patterns for backward compatibility
module.exports = handleChatMessage;
module.exports.handleChatMessage = handleChatMessage;
module.exports.default = handleChatMessage;
