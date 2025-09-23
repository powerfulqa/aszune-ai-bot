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
  DISCORD_USER_ID: /^\d{17,19}$/,
  DISCORD_SNOWFLAKE: /^\d{17,19}$/,

  // Content patterns
  MESSAGE_CONTENT: /^[\s\S]{1,4000}$/, // 1-4000 characters (Discord limit is 2000, but we allow more for processing)
  URL_PATTERN: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Command patterns
  COMMAND_PREFIX: /^[!\/]/,
  COMMAND_NAME: /^[a-zA-Z0-9_-]{1,32}$/,

  // File patterns
  FILENAME: /^[a-zA-Z0-9._-]{1,255}$/,
  PATH: /^[a-zA-Z0-9._\-\/\\]{1,500}$/,

  // Numeric patterns
  POSITIVE_INTEGER: /^\d+$/,
  INTEGER: /^-?\d+$/,
  FLOAT: /^-?\d+\.?\d*$/,

  // Text patterns
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHANUMERIC_WITH_SPACES: /^[a-zA-Z0-9\s]+$/,
  SAFE_TEXT: /^[a-zA-Z0-9\s.,!?@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/~`]+$/,
};

/**
 * Validation limits and constraints
 */
const VALIDATION_LIMITS = {
  MAX_MESSAGE_LENGTH: 4000,
  MAX_USERNAME_LENGTH: 32,
  MAX_COMMAND_LENGTH: 100,
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 500,
  MAX_URL_LENGTH: 2048,
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
const DANGEROUS_PATTERNS = {
  SCRIPT_TAGS: /<script[^>]*>.*?<\/script>/gi,
  HTML_TAGS: /<[^>]*>/g,
  JAVASCRIPT_PROTOCOL: /javascript:/gi,
  DATA_PROTOCOL: /data:/gi,
  VBSCRIPT_PROTOCOL: /vbscript:/gi,
  ONLOAD_EVENTS: /on\w+\s*=/gi,
  SQL_INJECTION: /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
  PATH_TRAVERSAL: /\.\.\/|\.\.\\|\.\.%2f|\.\.%5c/gi,
  XSS_PATTERNS: /<iframe|<object|<embed|<link|<meta|<style/gi,
};

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
    try {
      if (!content) {
        return { valid: false, error: 'Message content is required' };
      }

      if (typeof content !== 'string') {
        return { valid: false, error: 'Message content must be a string' };
      }

      if (content.length > VALIDATION_LIMITS.MAX_MESSAGE_LENGTH) {
        return {
          valid: false,
          error: `Message too long. Maximum length is ${VALIDATION_LIMITS.MAX_MESSAGE_LENGTH} characters`,
        };
      }

      if (content.length === 0) {
        return { valid: false, error: 'Message content cannot be empty' };
      }

      // Check for dangerous patterns
      const sanitizationResult = this.sanitizeContent(content);
      if (sanitizationResult.warnings.length > 0) {
        return {
          valid: false,
          error: 'Message contains potentially dangerous content',
          warnings: sanitizationResult.warnings,
        };
      }

      return { valid: true, sanitized: sanitizationResult.content };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating message content', {
        contentLength: content?.length || 0,
      });
      return { valid: false, error: errorResponse.message };
    }
  }

  /**
   * Validate command input
   * @param {string} command - Command to validate
   * @returns {Object} - Validation result
   */
  static validateCommand(command) {
    try {
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
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating command', {
        commandLength: command?.length || 0,
      });
      return { valid: false, error: errorResponse.message };
    }
  }

  /**
   * Validate conversation history
   * @param {Array} history - Conversation history to validate
   * @returns {Object} - Validation result
   */
  static validateConversationHistory(history) {
    try {
      if (!Array.isArray(history)) {
        return { valid: false, error: 'Conversation history must be an array' };
      }

      if (history.length > VALIDATION_LIMITS.MAX_HISTORY_LENGTH) {
        return {
          valid: false,
          error: `Conversation history too long. Maximum length is ${VALIDATION_LIMITS.MAX_HISTORY_LENGTH} messages`,
        };
      }

      for (let i = 0; i < history.length; i++) {
        const message = history[i];

        if (!message || typeof message !== 'object') {
          return { valid: false, error: `Invalid message object at index ${i}` };
        }

        if (!message.role || typeof message.role !== 'string') {
          return { valid: false, error: `Invalid message role at index ${i}` };
        }

        if (!['user', 'assistant', 'system'].includes(message.role)) {
          return { valid: false, error: `Invalid message role "${message.role}" at index ${i}` };
        }

        if (!message.content || typeof message.content !== 'string') {
          return { valid: false, error: `Invalid message content at index ${i}` };
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
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating conversation history', {
        historyLength: history?.length || 0,
      });
      return { valid: false, error: errorResponse.message };
    }
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result
   */
  static validateUrl(url) {
    try {
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
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating URL', {
        urlLength: url?.length || 0,
      });
      return { valid: false, error: errorResponse.message };
    }
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

      let sanitized = content;
      const warnings = [];

      // Remove script tags
      if (DANGEROUS_PATTERNS.SCRIPT_TAGS.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.SCRIPT_TAGS, '');
        warnings.push('Script tags removed');
      }

      // Remove HTML tags (except basic formatting)
      if (DANGEROUS_PATTERNS.HTML_TAGS.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.HTML_TAGS, '');
        warnings.push('HTML tags removed');
      }

      // Remove JavaScript protocol
      if (DANGEROUS_PATTERNS.JAVASCRIPT_PROTOCOL.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.JAVASCRIPT_PROTOCOL, '');
        warnings.push('JavaScript protocol removed');
      }

      // Remove data protocol
      if (DANGEROUS_PATTERNS.DATA_PROTOCOL.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.DATA_PROTOCOL, '');
        warnings.push('Data protocol removed');
      }

      // Remove VBScript protocol
      if (DANGEROUS_PATTERNS.VBSCRIPT_PROTOCOL.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.VBSCRIPT_PROTOCOL, '');
        warnings.push('VBScript protocol removed');
      }

      // Remove onload events
      if (DANGEROUS_PATTERNS.ONLOAD_EVENTS.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.ONLOAD_EVENTS, '');
        warnings.push('Event handlers removed');
      }

      // Check for SQL injection patterns
      if (DANGEROUS_PATTERNS.SQL_INJECTION.test(sanitized)) {
        warnings.push('Potential SQL injection pattern detected');
      }

      // Check for path traversal
      if (DANGEROUS_PATTERNS.PATH_TRAVERSAL.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.PATH_TRAVERSAL, '');
        warnings.push('Path traversal pattern removed');
      }

      // Check for XSS patterns
      if (DANGEROUS_PATTERNS.XSS_PATTERNS.test(sanitized)) {
        sanitized = sanitized.replace(DANGEROUS_PATTERNS.XSS_PATTERNS, '');
        warnings.push('XSS patterns removed');
      }

      // Trim whitespace
      sanitized = sanitized.trim();

      return { content: sanitized, warnings };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'sanitizing content', {
        contentLength: content?.length || 0,
      });
      console.error(`Content sanitization error: ${errorResponse.message}`);
      return { content: content || '', warnings: ['Sanitization failed'] };
    }
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
      console.error(`HTML escaping error: ${errorResponse.message}`);
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

      if (!input) {
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

      // Check length
      if (input.length > maxLength) {
        return {
          valid: false,
          error: `Input too long. Maximum length is ${maxLength} characters`,
          sanitized: '',
          warnings: [],
        };
      }

      // Sanitize content
      const sanitizationResult = this.sanitizeContent(input);

      // Additional validation based on type
      let typeValidation = { valid: true };
      switch (type) {
      case 'userId':
        typeValidation = this.validateUserId(input);
        break;
      case 'url':
        typeValidation = this.validateUrl(input);
        break;
      case 'command':
        typeValidation = this.validateCommand(input);
        break;
      case 'message':
        typeValidation = this.validateMessageContent(input);
        break;
      case 'text':
        // Basic text validation - text is already validated for length above
        typeValidation = {
          valid: true,
          error: null,
        };
        break;
      default:
        typeValidation = {
          valid: false,
          error: `Unknown input type: ${type}`,
        };
        break;
      }

      // In strict mode, reject if any warnings
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
}

// Export validation patterns and limits for external use
module.exports = {
  InputValidator,
  VALIDATION_PATTERNS,
  VALIDATION_LIMITS,
  DANGEROUS_PATTERNS,
};
