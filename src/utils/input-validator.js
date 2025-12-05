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
  checkMaxLength,
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
  URL: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  URL_PATTERN: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Command patterns
  COMMAND_PREFIX: /^[!/]/,
  COMMAND_NAME: /^[a-zA-Z0-9_-]{1,32}$/,

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
  SAFE_TEXT: /^[a-zA-Z0-9\s.,!?@#$%^&*()_+\-=[\]{};':"\\|,.<>/~`]+$/,
};

/**
 * Validation limits and constraints
 */
const VALIDATION_LIMITS = {
  TEXT_MAX_LENGTH: 4000,
  MAX_MESSAGE_LENGTH: 4000,
  EMAIL_MAX_LENGTH: 254,
  URL_MAX_LENGTH: 2048,
  USER_ID_LENGTH: 18,
  MAX_USERNAME_LENGTH: 32,
  MAX_COMMAND_LENGTH: 100,
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
 * Dangerous patterns that should be sanitized or rejected
 */
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<[^>]*>/g,
  /javascript:/gi,
  /data:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
  /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
  /\.\.\/|\.\.\\/gi,
  /<iframe|<object|<embed|<link|<meta|<style/gi,
];

/**
 * Security patterns for input validation (shared across multiple validators)
 * These patterns detect common XSS and injection attempts
 */
const DANGEROUS_SECURITY_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /data:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
];

/**
 * Extended security patterns for JavaScript execution detection
 * Used for stricter text input validation
 */
const DANGEROUS_JS_EXECUTION_PATTERNS = [
  ...DANGEROUS_SECURITY_PATTERNS,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /setTimeout\s*\(/gi,
  /setInterval\s*\(/gi,
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
   * Common validation helper - checks string length
   * @param {string} value - Value to check
   * @param {number} maxLength - Maximum allowed length
   * @param {string} fieldName - Name of the field for error message
   * @returns {Object|null} - Error object if invalid, null if valid
   */
  static _validateStringLength(value, maxLength, fieldName) {
    return checkMaxLength(value, maxLength, fieldName);
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
   * Generic basic input validation helper
   * Consolidates common pattern: required + string type + max length checks
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {number} maxLength - Maximum allowed length
   * @returns {Object} - Validation result {valid: boolean, error?: string}
   */
  static _validateBasicInput(value, fieldName, maxLength) {
    const requiredCheck = this._validateRequired(value, fieldName);
    if (requiredCheck) return requiredCheck;

    const stringCheck = this._validateStringType(value, fieldName);
    if (stringCheck) return stringCheck;

    const lengthCheck = this._validateStringLength(value, maxLength, fieldName);
    if (lengthCheck) return lengthCheck;

    return { valid: true };
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
   * Validate command input
   * @param {string} command - Command to validate
   * @returns {Object} - Validation result
   */
  static validateCommand(command) {
    return wrapValidation(
      () => this._performCommandValidation(command),
      'validating command',
      { commandLength: command?.length || 0 },
      ErrorHandler
    );
  }

  /**
   * Perform the actual command validation logic
   * @param {string} command - Command to validate
   * @returns {Object} - Validation result
   */
  static _performCommandValidation(command) {
    // Basic validation checks
    const basicValidation = this._validateBasicCommand(command);
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // Structure validation
    const structureValidation = this._validateCommandStructure(command);
    if (!structureValidation.valid) {
      return structureValidation;
    }

    return { valid: true };
  }

  /**
   * Validate basic command properties using generic helper
   */
  static _validateBasicCommand(command) {
    return this._validateBasicInput(command, 'Command', VALIDATION_LIMITS.MAX_COMMAND_LENGTH);
  }

  static _validateCommandStructure(command) {
    // Check if command starts with valid prefix
    if (!VALIDATION_PATTERNS.COMMAND_PREFIX.test(command)) {
      return { valid: false, error: 'Command must start with ! or /' };
    }

    // Extract command name (everything after prefix until first space)
    const commandName = command.substring(1).split(' ')[0];
    if (!VALIDATION_PATTERNS.COMMAND_NAME.test(commandName)) {
      return { valid: false, error: 'Invalid command name format' };
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
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result
   */
  static validateUrl(url) {
    return wrapValidation(
      () => this._performUrlValidation(url),
      'validating URL',
      { urlLength: url?.length || 0 },
      ErrorHandler
    );
  }

  /**
   * Perform the actual URL validation logic
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result
   */
  static _performUrlValidation(url) {
    // Basic validation checks
    const basicValidation = this._validateBasicUrl(url);
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // Format and safety validation
    const formatValidation = this._validateUrlFormatAndSafety(url);
    if (!formatValidation.valid) {
      return formatValidation;
    }

    return { valid: true };
  }

  /**
   * Validate basic URL properties using generic helper
   */
  static _validateBasicUrl(url) {
    return this._validateBasicInput(url, 'URL', VALIDATION_LIMITS.MAX_URL_LENGTH);
  }

  static _validateUrlFormatAndSafety(url) {
    if (!VALIDATION_PATTERNS.URL_PATTERN.test(url)) {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check for dangerous protocols
    const lowerUrl = url.toLowerCase();
    if (
      lowerUrl.startsWith('javascript:') ||
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('vbscript:')
    ) {
      return { valid: false, error: 'Dangerous URL protocol detected' };
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
      const errorResponse = ErrorHandler.handleError(error, 'sanitizing content', {
        contentLength: content?.length || 0,
      });
      ErrorHandler.logError(errorResponse, {
        operation: 'sanitizeContent',
        contentLength: content?.length || 0,
      });
      return { content: content || '', warnings: ['Sanitization failed'] };
    }
  }

  static _performSanitization(content) {
    let sanitized = content;
    const warnings = [];

    // Apply all sanitization rules
    const sanitizationRules = [
      { pattern: DANGEROUS_PATTERNS[0], message: 'Script tags removed' },
      { pattern: DANGEROUS_PATTERNS[1], message: 'HTML tags removed' },
      { pattern: DANGEROUS_PATTERNS[2], message: 'JavaScript protocol removed' },
      { pattern: DANGEROUS_PATTERNS[3], message: 'Data protocol removed' },
      { pattern: DANGEROUS_PATTERNS[4], message: 'VBScript protocol removed' },
      { pattern: DANGEROUS_PATTERNS[5], message: 'Event handlers removed' },
      { pattern: DANGEROUS_PATTERNS[6], message: 'Path traversal pattern removed' },
      { pattern: DANGEROUS_PATTERNS[7], message: 'XSS patterns removed' },
    ];

    // Apply removal patterns
    sanitizationRules.forEach((rule) => {
      if (rule.pattern.test(sanitized)) {
        sanitized = sanitized.replace(rule.pattern, '');
        warnings.push(rule.message);
      }
    });

    // Check for detection-only patterns
    if (DANGEROUS_PATTERNS[6].test(sanitized)) {
      warnings.push('Potential SQL injection pattern detected');
    }

    return { content: sanitized, warnings };
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  static escapeHtml(text) {
    try {
      if (!text || typeof text !== 'string') {
        return '';
      }

      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'escaping HTML', {
        textLength: text?.length || 0,
      });
      ErrorHandler.logError(errorResponse, {
        operation: 'escapeHtml',
        textLength: text?.length || 0,
      });
      return text || '';
    }
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
        type = 'text',
        maxLength = VALIDATION_LIMITS.MAX_MESSAGE_LENGTH,
        strict = false,
      } = options;

      // Early validation checks
      const basicValidation = this._validateBasicInput(input, maxLength);
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

  static _validateBasicInput(input, maxLength) {
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
      url: (input) => InputValidator.validateUrl(input),
      command: (input) => InputValidator.validateCommand(input),
      message: (input) => InputValidator.validateMessageContent(input),
      text: (input) => InputValidator._validateTextType(input),
      email: (input) => InputValidator._validateEmailType(input),
    };

    if (typeValidators[type]) {
      return typeValidators[type](input);
    }

    return {
      valid: false,
      error: `Unknown input type: ${type}`,
    };
  }

  static _validateTextType(input) {
    // Check length limits first
    if (input.length > VALIDATION_LIMITS.TEXT_MAX_LENGTH) {
      return {
        valid: false,
        error: 'Input is too long',
      };
    }

    // Check for dangerous patterns (including JS execution patterns)
    if (this._containsJsExecutionPatterns(input)) {
      return {
        valid: false,
        error: 'Input contains potentially unsafe content',
      };
    }

    // Sanitize content
    const sanitizedResult = this.sanitizeContent(input);
    const sanitizedInput = sanitizedResult.content;

    // Allow empty strings
    if (sanitizedInput.length === 0) {
      return { valid: true };
    }

    if (!VALIDATION_PATTERNS.SAFE_TEXT.test(sanitizedInput)) {
      return {
        valid: false,
        error: 'Input contains unsafe characters',
      };
    }
    return { valid: true };
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

  /**
   * Check if content contains JavaScript execution patterns
   * @param {string} content - Content to check
   * @returns {boolean} True if JS execution patterns detected
   * @private
   */
  static _containsJsExecutionPatterns(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return DANGEROUS_JS_EXECUTION_PATTERNS.some((pattern) => pattern.test(content));
  }

  static _validateEmailType(input) {
    if (!VALIDATION_PATTERNS.EMAIL_PATTERN.test(input)) {
      return {
        valid: false,
        error: 'Invalid email format',
      };
    }
    return { valid: true };
  }

  /**
   * General input validation method
   * @param {string} input - Input to validate
   * @param {string} type - Type of input to validate
   * @returns {Object} - Validation result
   */
  static validateInput(input, type) {
    // For validation without sanitization, use _validateByType directly
    return this._validateByType(input, type);
  }

  /**
   * Sanitize input by removing dangerous patterns
   * @param {string} input - Input to sanitize
   * @returns {string} - Sanitized input
   */
  static sanitizeInput(input) {
    const result = this.sanitizeContent(input);
    return result.content;
  }
}

// Export validation patterns and limits for external use
module.exports = {
  InputValidator,
  VALIDATION_PATTERNS,
  VALIDATION_LIMITS,
  DANGEROUS_PATTERNS,
  DANGEROUS_SECURITY_PATTERNS,
  DANGEROUS_JS_EXECUTION_PATTERNS,
};
