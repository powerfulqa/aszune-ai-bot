// @ts-check
/**
 * Chat message handler for the bot
 * Updated for v1.3.2 with source link formatting and truncation fixes
 *
 * @module services/chat
 */
const perplexityService = require('../services/perplexity-secure');
// Use singleton ConversationManager for consistent state across the app
const conversationManager = require('../state/conversationManager');
const emojiManager = require('../utils/emoji');
const logger = require('../utils/logger');
// Command handler removed - all commands are now slash commands
const messageFormatter = require('../utils/message-formatter');
const { chunkMessage } = require('../utils/message-chunking');
const { ErrorHandler } = require('../utils/error-handler');
const { InputValidator } = require('../utils/input-validator');
const databaseService = require('../services/database');
const naturalLanguageReminderProcessor = require('../utils/natural-language-reminder');
// Performance metrics and session validation
const sessionValidator = require('../utils/metrics/session-validator');

const processingMessages = new Set();

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
  const systemCommands = ['@everyone', '@here', '@channel'];

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
  // This includes "!" which we use to prevent bot pickup of conversations
  const commonBotPrefixes = ['!', '/', '$', '%', '&', '?', '.', '-', '+', '='];
  if (commonBotPrefixes.some((prefix) => content.startsWith(prefix))) {
    logger.debug(`Ignoring message with bot prefix: ${content.charAt(0)}`);
    return true;
  }

  return false;
}

/**
 * Sends a response message, handling long messages by chunking if needed
 * @param {Object} message - Discord.js message object
 * @param {string} responseText - The formatted response to send
 * @returns {Promise<void>}
 */
/**
 * Processes user message and prepares for response
 * @param {Object} message - Discord.js message object
 * @returns {Promise<Object|null>} processedData or null if early return
 */
async function processUserMessage(message) {
  // Early validation - consolidate initial checks
  const validationResult = validateMessageBasics(message);
  if (!validationResult.valid) return null;

  const userId = message.author.id;

  // Run validation pipeline
  const pipelineResult = await runValidationPipeline(message, userId);
  if (!pipelineResult.success) return null;

  // Add sanitized message to history
  conversationManager.addMessage(userId, 'user', pipelineResult.sanitizedContent);

  return { userId, sanitizedContent: pipelineResult.sanitizedContent };
}

/**
 * Validate basic message requirements
 * @param {Object} message - Discord.js message object
 * @returns {{valid: boolean}} Validation result
 */
function validateMessageBasics(message) {
  if (message.author.bot || !message.content) return { valid: false };
  if (shouldIgnoreMessage(message)) return { valid: false };
  return { valid: true };
}

/**
 * Run validation pipeline for message processing
 * @param {Object} message - Discord.js message object
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, sanitizedContent?: string}>} Pipeline result
 */
async function runValidationPipeline(message, userId) {
  // Validate user ID
  const userIdValidation = InputValidator.validateUserId(userId);
  if (!userIdValidation.valid) {
    logger.warn(`Invalid user ID: ${userIdValidation.error}`);
    return { success: false };
  }

  // Process message content and handle validation
  const contentResult = await processMessageContent(message, userId);
  if (!contentResult.success) return { success: false };

  // Handle rate limiting
  const rateLimitResult = await handleRateLimiting(message, userId);
  if (!rateLimitResult.success) return { success: false };

  // Handle commands
  const commandResult = await handleCommandCheck(message, contentResult.sanitizedContent);
  if (!commandResult.success) return { success: false };

  return { success: true, sanitizedContent: contentResult.sanitizedContent };
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

async function handleCommandCheck(_message, _sanitizedContent) {
  // Commands are now handled via slash commands only
  // Messages starting with "!" are ignored by shouldIgnoreMessage()
  return { success: true };
}

/**
 * Check for simple time-based reminder requests (e.g. "remind me in 5 minutes")
 */
async function checkForSimpleReminderRequest(messageContent, userId, channelId, serverId) {
  try {
    const match = findSimpleReminderMatch(messageContent);
    if (!match) return null;

    logger.info(`Detected simple reminder request from user ${userId}: "${messageContent}"`);
    return await createSimpleReminder(match, userId, channelId, serverId);
  } catch (error) {
    logger.error('Error checking for simple reminder request:', error);
    return null;
  }
}

function findSimpleReminderMatch(messageContent) {
  const simpleReminderPatterns = [
    /(?:can you |please )?remind me (?:to |about )?(.+?) in (\d+) (minute|minutes|hour|hours|day|days)/i,
    /(?:can you |please )?remind me in (\d+) (minute|minutes|hour|hours|day|days)(?: to | about | that | )(.+)?/i,
    /set (?:a )?reminder (?:for |to )?(.+?) (?:in |for )(\d+) (minute|minutes|hour|hours|day|days)/i,
    /remind me in (\d+) (minute|minutes|hour|hours|day|days)/i,
  ];

  for (const pattern of simpleReminderPatterns) {
    const match = messageContent.match(pattern);
    if (match) return match;
  }
  return null;
}

/**
 * Create a simple reminder using the canonical ReminderService API
 * Replaces legacy handleReminderCommand path for correctness
 *
 * @param {RegExpMatchArray} match - Regex match from findSimpleReminderMatch
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @param {string} serverId - Server ID ('DM' for direct messages)
 * @returns {Promise<{success: boolean, message: string, response: string}>}
 */
async function createSimpleReminder(match, userId, channelId, serverId) {
  // Use canonical reminder service directly instead of legacy command module
  const reminderService = require('./reminder-service');

  // Extract time and message components from regex match
  let timeAmount, timeUnit, reminderMessage;

  if (match[2] && match[3]) {
    // Pattern: "remind me about X in Y Z"
    reminderMessage = match[1] || 'Reminder';
    timeAmount = match[2];
    timeUnit = match[3];
  } else if (match[1] && match[2]) {
    // Pattern: "remind me in Y Z to/about X"
    timeAmount = match[1];
    timeUnit = match[2];
    reminderMessage = match[3] || 'Reminder';
  }

  // Build time string for reminderService.setReminder
  const timeString = `in ${timeAmount} ${timeUnit}`;

  try {
    // Initialize reminder service if needed
    if (!reminderService.isInitialized) {
      await reminderService.initialize();
    }

    // Call the canonical reminder service API directly
    const reminder = await reminderService.setReminder(
      userId,
      timeString,
      reminderMessage,
      channelId,
      serverId !== 'DM' ? serverId : null
    );

    const responseMessage =
      reminderMessage && reminderMessage !== 'Reminder'
        ? `I'll remind you about "${reminderMessage}" in ${timeAmount} ${timeUnit}.`
        : `I'll remind you in ${timeAmount} ${timeUnit}.`;

    const fullResponse = `✅ **Reminder Set!**\n\n${responseMessage}\n\n*Reminder ID: ${reminder.id}*`;

    return {
      success: true,
      message: responseMessage, // For backward compatibility with tests
      response: fullResponse, // For UI rendering
    };
  } catch (error) {
    logger.error('Error creating simple reminder:', error);
    const errorMessage =
      'Sorry, I couldn\'t set that reminder. Please try using the /remind command or say "remind me in 5 minutes to check the oven".';
    return {
      success: false,
      message: errorMessage, // For backward compatibility with tests
      response: errorMessage, // For UI rendering
    };
  }
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
 * @param {string} username - Username
 */
async function processUserMessageStorage(userId, messageContent, username = null) {
  if (!userId || !messageContent) return;

  try {
    databaseService.addUserMessage(userId, messageContent, 0, username);
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
/**
 * Filter messages by session timeout and deduplication
 * @private
 */
function filterRecentMessages(dbHistory, messageContent, sessionTimeoutMs) {
  const sessionCutoffTime = new Date(Date.now() - sessionTimeoutMs).toISOString();
  const recentMessages = dbHistory.filter((msg) => msg.timestamp >= sessionCutoffTime);

  if (recentMessages.length === 0) return null;

  // Filter out recent identical messages using timestamps to prevent duplication
  const cutoffTime = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
  return recentMessages.filter(
    (msg) => msg.message !== messageContent || msg.timestamp < cutoffTime
  );
}

async function loadConversationHistory(userId, messageContent) {
  let conversationHistory = conversationManager.getHistory(userId);

  // Supplement with database conversation history if conversation is new or short
  if (conversationHistory.length > 1 || !userId) {
    return conversationHistory;
  }

  try {
    // Access config inside function to prevent circular dependencies
    const config = require('../config/config');
    const dbLimit = config.DATABASE_CONVERSATION_LIMIT || 20;
    const SESSION_TIMEOUT_MS = config.SESSION_TIMEOUT_MS || 30 * 60 * 1000; // 30 minutes default

    const dbConversationHistory = databaseService.getConversationHistory(userId, dbLimit);
    if (!dbConversationHistory || dbConversationHistory.length === 0) {
      return conversationHistory;
    }

    const historicalMessages = filterRecentMessages(
      dbConversationHistory,
      messageContent,
      SESSION_TIMEOUT_MS
    );

    if (!historicalMessages) {
      logger.debug(
        `Session timeout: No messages within ${SESSION_TIMEOUT_MS / 60000} minutes for user ${userId}`
      );
      return conversationHistory;
    }

    // Add database history to conversation manager for context
    historicalMessages.forEach((msg) => {
      conversationManager.addMessage(userId, msg.role, msg.message);
    });

    // Update conversation history after adding database history
    conversationHistory = conversationManager.getHistory(userId);
  } catch (dbError) {
    logger.warn('Failed to load conversation history from database:', dbError.message);
    // Continue with in-memory history only
  }

  return conversationHistory;
}

/**
 * Handle an incoming chat message
 * @param {Object} message - Discord.js message object
 * @returns {Promise<void>}
 */
async function handleChatMessage(message) {
  // Deduplication: Prevent processing the same message multiple times
  if (processingMessages.has(message.id)) {
    logger.debug(`Ignoring duplicate message processing for ID: ${message.id}`);
    return null;
  }

  processingMessages.add(message.id);
  const startTime = Date.now();

  try {
    // Process the incoming message
    const processedData = await processUserMessage(message);
    if (!processedData) return null;

    // Show typing indicator
    message.channel.sendTyping();

    const userId = processedData.userId;
    const messageContent = processedData.sanitizedContent;

    // Store user message and update stats in database
    await processUserMessageStorage(userId, messageContent, message.author.username);

    // Load conversation history
    await loadConversationHistory(userId, messageContent);

    // Check for reminder requests
    const reminderHandled = await handleReminderRequests(message, messageContent, userId);
    if (reminderHandled) return;

    // Generate and process AI response
    await processAIResponse(message, processedData, userId);

    // Skip reactions in low CPU mode
    const config = require('../config/config');
    if (!config.PI_OPTIMIZATIONS?.LOW_CPU_MODE) {
      await emojiManager.addReactionsToMessage(message);
    }

    // Track performance metrics (simplified for refactored version)
    const totalTime = Date.now() - startTime;
    await trackChatPerformance('chat_response_time', totalTime, {
      userId,
      messageLength: processedData?.messageContent?.length || 0,
    });
  } catch (error) {
    await handleChatError(error, startTime, null, message);
  } finally {
    // Always remove message from processing set
    processingMessages.delete(message.id);
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

async function handleReminderRequests(message, messageContent, userId) {
  // Check for simple time-based reminder requests first
  const simpleReminderResult = await checkForSimpleReminderRequest(
    messageContent,
    userId,
    message.channel.id,
    message.guild?.id || 'DM'
  );

  if (simpleReminderResult) {
    await sendReminderResponse(message, simpleReminderResult);
    return true;
  }

  // Check for natural language reminder requests (for events/releases)
  const reminderResult = await checkForReminderRequest(
    messageContent,
    userId,
    message.channel.id,
    message.guild?.id || 'DM'
  );

  if (reminderResult) {
    await sendReminderResponse(message, reminderResult);
    return true;
  }

  return false;
}

async function processAIResponse(message, processedData, userId) {
  try {
    // Validate session before generating response
    const validation = sessionValidator.validateRequest();
    if (validation.degraded) {
      logger.debug('Session validation pending, response may be limited');
    }

    // Generate and format the response
    const response = await perplexityService.generateChatResponse(
      conversationManager.getHistory(processedData.userId)
    );

    // Process response through session validator
    const processedResponse = sessionValidator.processResponse(response);
    const formattedReply = messageFormatter.formatResponse(processedResponse);

    // Add emojis to response
    const finalResponse = emojiManager.addEmojisToResponse(formattedReply);

    // Add bot's reply to the conversation history
    conversationManager.addMessage(processedData.userId, 'assistant', finalResponse);

    // Store bot response in database
    try {
      databaseService.addBotResponse(userId, finalResponse);
    } catch (dbError) {
      logger.warn('Failed to store bot response:', dbError.message);
    }

    // Send the response as embed (handles chunking if needed)
    const chunks = chunkMessage(finalResponse);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const config = require('../config/config');
      const embed = messageFormatter.createCompactEmbed({
        color: config.COLORS.PRIMARY,
        description: chunk,
        footer: { text: 'Aszai Bot' },
      });

      await message.reply({ embeds: [embed] });
    }

    // Add emoji reactions to the message (skip in low CPU mode)
    const config = require('../config/config');
    if (!config.PI_OPTIMIZATIONS?.LOW_CPU_MODE) {
      await emojiManager.addReactionsToMessage(message);
    }

    return finalResponse;
  } catch (error) {
    logger.error('Error in processAIResponse:', error);
    throw error;
  }
}

// CRITICAL: Maintain all export patterns for backward compatibility
module.exports = handleChatMessage;
module.exports.handleChatMessage = handleChatMessage;
module.exports.checkForSimpleReminderRequest = checkForSimpleReminderRequest;
module.exports.default = handleChatMessage;
