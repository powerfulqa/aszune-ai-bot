/**
 * Message formatting utilities for API compatibility
 */
const logger = require('./logger');
const { ErrorHandler, ERROR_TYPES } = require('./error-handler');

/**
 * Format conversation history to ensure proper alternation for Perplexity API
 * @param {Array} messages - Raw conversation history
 * @returns {Array} - Properly formatted messages
 */
function formatMessagesForAPI(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const formatted = [];
  let lastRole = null;

  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      continue;
    }

    const { role, content } = message;

    // Skip invalid messages
    if (!role || !content || typeof content !== 'string') {
      logger.warn('Skipping invalid message in formatting:', { role, contentType: typeof content });
      continue;
    }

    // Skip empty content
    if (content.trim().length === 0) {
      continue;
    }

    // Ensure proper alternation - skip consecutive messages from same role
    if (lastRole === role) {
      logger.debug(`Skipping consecutive ${role} message to maintain alternation`);
      continue;
    }

    // Add message to formatted array
    formatted.push({
      role: role,
      content: content.trim(),
    });

    lastRole = role;
  }

  // Ensure the conversation starts with a user message
  if (formatted.length > 0 && formatted[0].role !== 'user') {
    logger.debug('Removing non-user message from start of conversation');
    formatted.shift();
  }

  // Ensure the conversation ends with a user message for API requests
  if (formatted.length > 0 && formatted[formatted.length - 1].role !== 'user') {
    logger.debug('Conversation ends with assistant message, which is expected for API calls');
  }

  return formatted;
}

/**
 * Validate message format for API compatibility
 * @param {Array} messages - Messages to validate
 * @returns {Object} - Validation result
 */
function validateMessageFormat(messages) {
  // Basic array validation
  const arrayValidation = validateMessagesArray(messages);
  if (!arrayValidation.valid) return arrayValidation;

  // Individual message validation
  const messageValidation = validateIndividualMessages(messages);
  if (!messageValidation.valid) return messageValidation;

  // Conversation structure validation
  const structureValidation = validateConversationStructure(messages);
  if (!structureValidation.valid) return structureValidation;

  return {
    valid: true,
    messageCount: messages.length,
  };
}

/**
 * Validate that messages is a proper array
 * @param {Array} messages - Messages to validate
 * @returns {Object} - Validation result
 */
function validateMessagesArray(messages) {
  if (!Array.isArray(messages)) {
    return {
      valid: false,
      error: 'Messages must be an array',
      code: 'INVALID_FORMAT',
    };
  }

  if (messages.length === 0) {
    return {
      valid: false,
      error: 'Messages array cannot be empty',
      code: 'EMPTY_MESSAGES',
    };
  }

  return { valid: true };
}

/**
 * Validate individual message objects
 * @param {Array} messages - Messages to validate
 * @returns {Object} - Validation result
 */
function validateIndividualMessages(messages) {
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (!message || typeof message !== 'object') {
      return {
        valid: false,
        error: `Message at index ${i} is not a valid object`,
        code: 'INVALID_MESSAGE_OBJECT',
      };
    }

    const { role, content } = message;

    if (!role || !['user', 'assistant', 'system'].includes(role)) {
      return {
        valid: false,
        error: `Invalid role "${role}" at index ${i}`,
        code: 'INVALID_ROLE',
      };
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        valid: false,
        error: `Empty or invalid content at index ${i}`,
        code: 'INVALID_CONTENT',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate conversation structure and alternation
 * @param {Array} messages - Messages to validate
 * @returns {Object} - Validation result
 */
function validateConversationStructure(messages) {
  // Check for proper alternation
  let lastRole = null;
  for (let i = 0; i < messages.length; i++) {
    const role = messages[i].role;

    if (lastRole === role) {
      return {
        valid: false,
        error: `Consecutive ${role} messages at index ${i}`,
        code: 'ALTERNATION_ERROR',
      };
    }

    lastRole = role;
  }

  // Check that conversation starts with user message
  if (messages[0].role !== 'user') {
    return {
      valid: false,
      error: 'Conversation must start with a user message',
      code: 'MUST_START_WITH_USER',
    };
  }

  return { valid: true };
}

/**
 * Fix conversation history to meet API requirements
 * @param {Array} messages - Raw conversation history
 * @returns {Array} - Fixed and validated messages
 */
function fixConversationFormat(messages) {
  try {
    // First, format the messages for proper alternation
    const formatted = formatMessagesForAPI(messages);

    // Validate the formatted messages
    const validation = validateMessageFormat(formatted);

    if (!validation.valid) {
      logger.warn('Message validation failed after formatting:', validation.error);

      // If still invalid, return a minimal valid conversation
      return [
        {
          role: 'user',
          content: 'Hello',
        },
      ];
    }

    return formatted;
  } catch (error) {
    logger.error('Error fixing conversation format:', error.message);

    // Return minimal valid conversation as fallback
    return [
      {
        role: 'user',
        content: 'Hello',
      },
    ];
  }
}

/**
 * Create error for API 400 responses with specific handling for message alternation
 * @param {string} errorMessage - Raw error message from API
 * @param {number} statusCode - HTTP status code
 * @returns {Error} - Formatted error
 */
function createAPICompatibilityError(errorMessage, statusCode = 400) {
  if (errorMessage.includes('should alternate with assistant message')) {
    const error = ErrorHandler.createError(
      'Conversation format needs to be reset. Starting fresh conversation.',
      ERROR_TYPES.API_ERROR
    );
    error.statusCode = statusCode;
    error.needsConversationReset = true;
    error.userMessage =
      'I need to reset our conversation to fix a formatting issue. Please try your message again.';
    return error;
  }

  if (errorMessage.includes('invalid_request_error')) {
    const error = ErrorHandler.createError(
      'Invalid request format sent to API',
      ERROR_TYPES.API_ERROR
    );
    error.statusCode = statusCode;
    error.userMessage = 'There was an issue with the request format. Please try again.';
    return error;
  }

  // Generic API error
  const error = ErrorHandler.createError(
    `API request failed: ${errorMessage}`,
    ERROR_TYPES.API_ERROR
  );
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  formatMessagesForAPI,
  validateMessageFormat,
  fixConversationFormat,
  createAPICompatibilityError,
};
