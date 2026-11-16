/**
 * Input Validation and Sanitization Utilities
 * Provides comprehensive validation and sanitization for user inputs
 */
const config = require('../config/config');
const { ErrorHandler } = require('./error-handler');
const {
  checkRequired,
  checkStringType,
  checkArrayType,
  checkNotEmpty,
  wrapValidation,
} = require('./validation-helpers');

/**
 * Validation rules and patterns
 */
const VALIDATION_PATTERNS = {
  // User ID patterns
  USER_ID: /^\d{17,19}$/,
  DISCORD_USER_ID: /^\d{17,19}$/,
  DISCORD_SNOWFLAKE: /^\d{17,19}$/,

  // Content patterns
  TEXT: /^[\s\S]{1,4000}$/,
  MESSAGE_CONTENT: /^[\s\S]{1,4000}$/, // 1-4000 characters (Discord limit is 2000, but we allow more for processing)

  // File patterns
  FILENAME: /^[a-zA-Z0-9._-]{1,255}$/,
  PATH: /^[a-zA-Z0-9._\-/\\]{1,500}$/,

  // Numeric patterns
  POSITIVE_INTEGER: /^\d+$/,
  INTEGER: /^-?\d+$/,
  FLOAT: /^-?\d+\.?\d*$/,

  // Text patterns
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHANUMERIC_WITH_SPACES: /^[a-zA-Z0-9\s]+$/,
};

/**
 * Validation limits and constraints
 */
const VALIDATION_LIMITS = {
  MAX_MESSAGE_LENGTH: 4000,
  USER_ID_LENGTH: 18,
  MAX_USERNAME_LENGTH: 32,
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 500,
  MAX_HISTORY_LENGTH: (() => {
    try {
      return config.CONVERSATION_MAX_LENGTH ?? 100;
    } catch (error) {
      return 100;
    }
  })(),
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
};

/**
 * Sanitization rules: each dangerous pattern is paired with the warning
 * emitted when it is removed. Keeping pattern and message together (rather
 * than in parallel arrays indexed by position) prevents mismatches.
 *
 * SQL keywords are deliberately NOT stripped from user text: the database
 * layer uses parameterized statements throughout, and words like "select",
 * "update", "create" or "drop" are ordinary vocabulary in chat messages
 * (e.g. "what's the drop rate?").
 */
const SANITIZATION_RULES = [
  { pattern: /<script[^>]*>.*?<\/script>/gi, message: 'Script tags removed' },
  { pattern: /<[^>]*>/g, message: 'HTML tags removed' },
  { pattern: /javascript:/gi, message: 'JavaScript protocol removed' },
  { pattern: /data:/gi, message: 'Data protocol removed' },
  { pattern: /vbscript:/gi, message: 'VBScript protocol removed' },
  { pattern: /on\w+\s*=/gi, message: 'Event handlers removed' },
  { pattern: /\.\.\/|\.\.\\/g, message: 'Path traversal pattern removed' },
  { pattern: /<iframe|<object|<embed|<link|<meta|<style/gi, message: 'Embedded content removed' },
];

/**
 * Dangerous patterns that should be sanitized or rejected
 * (derived from SANITIZATION_RULES; exported for external use)
 */
const DANGEROUS_PATTERNS = SANITIZATION_RULES.map((rule) => rule.pattern);

/**
 * Security patterns for input validation (shared across multiple validators)
 * These patterns detect common XSS and injection attempts
 */
// Detection-only patterns used with .test() — no /g flag, because global
// regexes are stateful across .test() calls (lastIndex carries over) and
// produce intermittent false negatives.
const DANGEROUS_SECURITY_PATTERNS = [
  /<script[^>]*>.*?<\/script>/i,
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /on\w+\s*=/i,
];

/**
 * Input validation class
 */
class InputValidator {
  /**
   * Common validation helper - checks if value is required
   * @param {any} value - Value to check
   * @param {string} fieldName - Name of the field for error message
   * @returns {Object|null} - Error object if invalid, null if valid
   */
  static _validateRequired(value, fieldName) {
    return checkRequired(value, fieldName);
  }

  /**
   * Common validation helper - checks if value is a string
   * @param {any} value - Value to check
   * @param {string} fieldName - Name of the field for error message
   * @returns {Object|null} - Error object if invalid, null if valid
   */
  static _validateStringType(value, fieldName) {
    return checkStringType(value, fieldName);
  }

  /**
   * Common validation helper - checks if value is an array
   * @param {any} value - Value to check
   * @param {string} fieldName - Name of the field for error message
   * @returns {Object|null} - Error object if invalid, null if valid
   */
  static _validateArrayType(value, fieldName) {
    return checkArrayType(value, fieldName);
  }

  /**
   * Common validation helper - checks if string is empty
   * @param {string} value - Value to check
   * @param {string} fieldName - Name of the field for error message
   * @returns {Object|null} - Error object if invalid, null if valid
   */
  static _validateNotEmpty(value, fieldName) {
    return checkNotEmpty(value, fieldName);
  }
  /**
   * Validate a Discord user ID
   * @param {string} userId - User ID to validate
   * @returns {Object} - Validation result
   */
  static validateUserId(userId) {
    try {
      // Use common validation helpers
      const requiredCheck = this._validateRequired(userId, 'User ID');
      if (requiredCheck) return requiredCheck;

      const stringCheck = this._validateStringType(userId, 'User ID');
      if (stringCheck) return stringCheck;

      if (!VALIDATION_PATTERNS.DISCORD_USER_ID.test(userId)) {
        return { valid: false, error: 'Invalid Discord user ID format' };
      }

      return { valid: true };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating user ID', {
        userId: typeof userId,
      });
      return { valid: false, error: errorResponse.message };
    }
  }

  /**
   * Validate message content
   * @param {string} content - Message content to validate
   * @returns {Object} - Validation result
   */
  static validateMessageContent(content) {
    return wrapValidation(
      () => this._performMessageContentValidation(content),
      'validating message content',
      { contentLength: content?.length || 0 },
      ErrorHandler
    );
  }

  /**
   * Perform the actual message content validation logic
   * @param {string} content - Content to validate
   * @returns {Object} - Validation result
   */
  static _performMessageContentValidation(content) {
    // Basic validation checks
    const basicValidation = this._validateBasicContent(content);
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // Length validation
    const lengthValidation = this._validateContentLength(content);
    if (!lengthValidation.valid) {
      return lengthValidation;
    }

    // Sanitization and safety checks
    const sanitizationResult = this.sanitizeContent(content);
    // For messages, we sanitize the content but don't reject on warnings
    // The sanitized content is safe to use, and overly strict rejection
    // can block legitimate user messages (e.g., game names, normal text)
    // Warnings are still logged for monitoring purposes

    return {
      valid: true,
      sanitized: sanitizationResult.content,
      warnings: sanitizationResult.warnings,
    };
  }

  /**
   * Validate basic content properties
   */
  static _validateBasicContent(content) {
    // Use common validation helpers
    const requiredCheck = this._validateRequired(content, 'Message content');
    if (requiredCheck) return requiredCheck;

    const stringCheck = this._validateStringType(content, 'Message content');
    if (stringCheck) return stringCheck;

    const notEmptyCheck = this._validateNotEmpty(content, 'Message content');
    if (notEmptyCheck) return notEmptyCheck;

    return { valid: true };
  }

  /**
   * Validate content length
   */
  static _validateContentLength(content) {
    if (content.length > VALIDATION_LIMITS.MAX_MESSAGE_LENGTH) {
      return {
        valid: false,
        error: `Message too long. Maximum length is ${VALIDATION_LIMITS.MAX_MESSAGE_LENGTH} characters`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate conversation history
   * @param {Array} history - Conversation history to validate
   * @returns {Object} - Validation result
   */
  static validateConversationHistory(history) {
    try {
      // Early validation checks
      const arrayCheck = this._validateArrayType(history, 'Conversation history');
      if (arrayCheck) return arrayCheck;
      if (history.length > VALIDATION_LIMITS.MAX_HISTORY_LENGTH) {
        return {
          valid: false,
          error: `Conversation history too long. Maximum length is ${VALIDATION_LIMITS.MAX_HISTORY_LENGTH} messages`,
        };
      }

      // Validate each message
      const messageValidation = this._validateHistoryMessages(history);
      if (!messageValidation.valid) {
        return messageValidation;
      }

      return { valid: true };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating conversation history', {
        historyLength: history?.length || 0,
      });
      return { valid: false, error: errorResponse.message };
    }
  }

  static _validateHistoryMessages(history) {
    for (let i = 0; i < history.length; i++) {
      const message = history[i];

      // Validate message structure
      const structureValidation = this._validateMessageStructure(message, i);
      if (!structureValidation.valid) {
        return structureValidation;
      }

      // Validate message content
      const contentValidation = this.validateMessageContent(message.content);
      if (!contentValidation.valid) {
        return {
          valid: false,
          error: `Invalid message content at index ${i}: ${contentValidation.error}`,
        };
      }
    }

    return { valid: true };
  }

  static _validateMessageStructure(message, index) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: `Invalid message object at index ${index}` };
    }

    if (!message.role || typeof message.role !== 'string') {
      return { valid: false, error: `Invalid message role at index ${index}` };
    }

    if (!['user', 'assistant', 'system'].includes(message.role)) {
      return { valid: false, error: `Invalid message role "${message.role}" at index ${index}` };
    }

    if (!message.content || typeof message.content !== 'string') {
      return { valid: false, error: `Invalid message content at index ${index}` };
    }

    return { valid: true };
  }

  /**
   * Sanitize content by removing or escaping dangerous patterns
   * @param {string} content - Content to sanitize
   * @returns {Object} - Sanitization result with warnings
   */
  static sanitizeContent(content) {
    try {
      if (!content || typeof content !== 'string') {
        return { content: '', warnings: [] };
      }

      const sanitizationResult = this._performSanitization(content);
      return { content: sanitizationResult.content.trim(), warnings: sanitizationResult.warnings };
    } catch (error) {
      ErrorHandler.handleError(error, 'sanitizing content', {
        contentLength: content?.length || 0,
      });
      return { content: content || '', warnings: ['Sanitization failed'] };
    }
  }

  static _performSanitization(content) {
    let sanitized = content;
    const warnings = [];

    for (const rule of SANITIZATION_RULES) {
      // replace() with a /g pattern always scans from the start, unlike
      // test(), which is stateful on global regexes.
      const replaced = sanitized.replace(rule.pattern, '');
      if (replaced !== sanitized) {
        sanitized = replaced;
        warnings.push(rule.message);
      }
    }

    return { content: sanitized, warnings };
  }

  /**
   * Validate and sanitize input with comprehensive checks
   * @param {string} input - Input to validate and sanitize
   * @param {Object} options - Validation options
   * @returns {Object} - Validation and sanitization result
   */
  static validateAndSanitize(input, options = {}) {
    try {
      const {
        type = 'message',
        maxLength = VALIDATION_LIMITS.MAX_MESSAGE_LENGTH,
        strict = false,
      } = options;

      // Early validation checks
      const basicValidation = this._validateBasicSanitizeInput(input, maxLength);
      if (!basicValidation.valid) {
        return basicValidation;
      }

      // Sanitize content
      const sanitizationResult = this.sanitizeContent(input);

      // Type-specific validation
      const typeValidation = this._validateByType(input, type);

      // Strict mode check
      if (strict && sanitizationResult.warnings.length > 0) {
        return {
          valid: false,
          error: 'Input contains potentially dangerous content',
          sanitized: sanitizationResult.content,
          warnings: sanitizationResult.warnings,
        };
      }

      return {
        valid: typeValidation.valid,
        error: typeValidation.error,
        sanitized: sanitizationResult.content,
        warnings: sanitizationResult.warnings,
      };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating and sanitizing input', {
        inputType: typeof input,
        inputLength: input?.length || 0,
        options,
      });
      return {
        valid: false,
        error: errorResponse.message,
        sanitized: input || '',
        warnings: [],
      };
    }
  }

  /**
   * Basic validation for sanitization flow
   * Returns sanitization-compatible result format
   * @private
   */
  static _validateBasicSanitizeInput(input, maxLength) {
    if (input === null || input === undefined) {
      return {
        valid: false,
        error: 'Input is required',
        sanitized: '',
        warnings: [],
      };
    }

    if (typeof input !== 'string') {
      return {
        valid: false,
        error: 'Input must be a string',
        sanitized: '',
        warnings: [],
      };
    }

    if (input.length > maxLength) {
      return {
        valid: false,
        error: `Input too long. Maximum length is ${maxLength} characters`,
        sanitized: '',
        warnings: [],
      };
    }

    // Empty string is valid for text type
    if (input.length === 0) {
      return { valid: true };
    }

    return { valid: true };
  }

  static _validateByType(input, type) {
    const typeValidators = {
      userId: (input) => InputValidator.validateUserId(input),
      message: (input) => InputValidator.validateMessageContent(input),
    };

    if (typeValidators[type]) {
      return typeValidators[type](input);
    }

    return {
      valid: false,
      error: `Unknown input type: ${type}`,
    };
  }

  /**
   * Validate time string format
   * @param {string} timeString - Time string to validate
   * @returns {Object} - Validation result
   */
  static validateTimeString(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      return { valid: false, error: 'Time string is required' };
    }

    if (timeString.length > 100) {
      return { valid: false, error: 'Time string is too long' };
    }

    // Basic safety check using shared security patterns
    if (this._containsDangerousContent(timeString)) {
      return { valid: false, error: 'Time string contains unsafe content' };
    }

    return { valid: true };
  }

  /**
   * Validate reminder message
   * @param {string} message - Message to validate
   * @returns {Object} - Validation result
   */
  static validateReminderMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message is required' };
    }

    if (message.length > VALIDATION_LIMITS.MAX_MESSAGE_LENGTH) {
      return { valid: false, error: 'Message is too long' };
    }

    // Basic safety check using shared security patterns
    if (this._containsDangerousContent(message)) {
      return { valid: false, error: 'Message contains unsafe content' };
    }

    return { valid: true };
  }

  /**
   * Check if content contains dangerous security patterns
   * @param {string} content - Content to check
   * @returns {boolean} True if dangerous content detected
   * @private
   */
  static _containsDangerousContent(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return DANGEROUS_SECURITY_PATTERNS.some((pattern) => pattern.test(content));
  }
}

// Export validation patterns and limits for external use
module.exports = {
  InputValidator,
  VALIDATION_PATTERNS,
  VALIDATION_LIMITS,
  DANGEROUS_PATTERNS,
  DANGEROUS_SECURITY_PATTERNS,
};
