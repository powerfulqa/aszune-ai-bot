/**
 * Input Validation and Sanitization Utilities
 * Provides comprehensive validation and sanitization for user inputs
 */
const config = require('../config/config');
const { ErrorHandler } = require('./error-handler');

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
  /\.\.\/|\.\.\\|\.\.%2f|\.\.%5c/gi,
  /<iframe|<object|<embed|<link|<meta|<style/gi,
];

/**
 * Input validation class
 */
class InputValidator {
  /**
   * Validate a Discord user ID
   * @param {string} userId - User ID to validate
   * @returns {Object} - Validation result
   */
  static validateUserId(userId) {
    try {
      if (!userId) {
        return { valid: false, error: 'User ID is required' };
      }

      if (typeof userId !== 'string') {
        return { valid: false, error: 'User ID must be a string' };
      }

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
    let result = { valid: false, error: 'Unknown validation error' };
    
    try {
      // Perform all validation checks
      const validationResult = this._performMessageContentValidation(content);
      result = validationResult;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating message content', {
        contentLength: content?.length || 0,
      });
      result = { valid: false, error: errorResponse.message };
    }
    
    return result;
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
    if (sanitizationResult.warnings.length > 0) {
      return {
        valid: false,
        error: 'Message contains potentially dangerous content',
        warnings: sanitizationResult.warnings,
      };
    }

    return { valid: true, sanitized: sanitizationResult.content };
  }

  /**
   * Validate basic content properties
   */
  static _validateBasicContent(content) {
    if (!content) {
      return { valid: false, error: 'Message content is required' };
    }

    if (typeof content !== 'string') {
      return { valid: false, error: 'Message content must be a string' };
    }

    if (content.length === 0) {
      return { valid: false, error: 'Message content cannot be empty' };
    }

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
    let result = { valid: false, error: 'Unknown validation error' };
    
    try {
      // Perform all validation checks
      const validationResult = this._performCommandValidation(command);
      result = validationResult;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating command', {
        commandLength: command?.length || 0,
      });
      result = { valid: false, error: errorResponse.message };
    }
    
    return result;
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
   * Validate basic command properties
   */
  static _validateBasicCommand(command) {
    if (!command) {
      return { valid: false, error: 'Command is required' };
    }

    if (typeof command !== 'string') {
      return { valid: false, error: 'Command must be a string' };
    }

    if (command.length > VALIDATION_LIMITS.MAX_COMMAND_LENGTH) {
      return {
        valid: false,
        error: `Command too long. Maximum length is ${VALIDATION_LIMITS.MAX_COMMAND_LENGTH} characters`,
      };
    }

    return { valid: true };
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
      if (!Array.isArray(history)) {
        return { valid: false, error: 'Conversation history must be an array' };
      }
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
    let result = { valid: false, error: 'Unknown validation error' };
    
    try {
      // Perform all validation checks
      const validationResult = this._performUrlValidation(url);
      result = validationResult;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating URL', {
        urlLength: url?.length || 0,
      });
      result = { valid: false, error: errorResponse.message };
    }
    
    return result;
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
   * Validate basic URL properties
   */
  static _validateBasicUrl(url) {
    if (!url) {
      return { valid: false, error: 'URL is required' };
    }

    if (typeof url !== 'string') {
      return { valid: false, error: 'URL must be a string' };
    }

    if (url.length > VALIDATION_LIMITS.MAX_URL_LENGTH) {
      return {
        valid: false,
        error: `URL too long. Maximum length is ${VALIDATION_LIMITS.MAX_URL_LENGTH} characters`,
      };
    }

    return { valid: true };
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
    sanitizationRules.forEach(rule => {
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
      text: (input) => {
        // Check length limits first
        if (input.length > VALIDATION_LIMITS.TEXT_MAX_LENGTH) {
          return {
            valid: false,
            error: 'Input is too long',
          };
        }
        
        // Check for dangerous patterns first (before sanitization)
        const dangerousPatterns = [
          /<script[^>]*>.*?<\/script>/gi,
          /javascript:/gi,
          /data:/gi,
          /vbscript:/gi,
          /on\w+\s*=/gi,
          /eval\s*\(/gi,
          /expression\s*\(/gi,
          /setTimeout\s*\(/gi,
          /setInterval\s*\(/gi,
        ];
        
        const hasDangerousContent = dangerousPatterns.some(pattern => pattern.test(input));
        if (hasDangerousContent) {
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
      },
      email: (input) => {
        if (!VALIDATION_PATTERNS.EMAIL_PATTERN.test(input)) {
          return {
            valid: false,
            error: 'Invalid email format',
          };
        }
        return { valid: true };
      },
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
};
