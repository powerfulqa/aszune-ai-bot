/**
 * Shared validation utilities to eliminate code duplication
 * across responseValidator.js, input-validator.js, and other validators
 * @module validation-helpers
 */

/**
 * Create a standardized validation result object
 * @param {boolean} isValid - Whether validation passed
 * @param {string|null} error - Error message if validation failed
 * @param {*} sanitized - Sanitized/processed value
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Standardized validation result
 */
function createValidationResult(isValid, error = null, sanitized = null, metadata = {}) {
  return {
    valid: isValid,
    isValid, // Alias for compatibility
    error,
    sanitized,
    ...metadata,
  };
}

/**
 * Create a successful validation result
 * @param {*} sanitized - The sanitized value
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Success result
 */
function validResult(sanitized = null, metadata = {}) {
  return createValidationResult(true, null, sanitized, metadata);
}

/**
 * Create a failed validation result
 * @param {string} error - Error message
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Failure result
 */
function invalidResult(error, metadata = {}) {
  return createValidationResult(false, error, null, metadata);
}

/**
 * Check if a value is required (not null/undefined/empty)
 * @param {*} value - Value to check
 * @param {string} fieldName - Field name for error messages
 * @returns {Object|null} Error result if invalid, null if valid
 */
function checkRequired(value, fieldName = 'Value') {
  if (value === null || value === undefined || value === '') {
    return invalidResult(`${fieldName} is required`);
  }
  return null;
}

/**
 * Check if a value is a string
 * @param {*} value - Value to check
 * @param {string} fieldName - Field name for error messages
 * @returns {Object|null} Error result if invalid, null if valid
 */
function checkStringType(value, fieldName = 'Value') {
  if (typeof value !== 'string') {
    return invalidResult(`${fieldName} must be a string`);
  }
  return null;
}

/**
 * Check if a value is an array
 * @param {*} value - Value to check
 * @param {string} fieldName - Field name for error messages
 * @returns {Object|null} Error result if invalid, null if valid
 */
function checkArrayType(value, fieldName = 'Value') {
  if (!Array.isArray(value)) {
    return invalidResult(`${fieldName} must be an array`);
  }
  return null;
}

/**
 * Check string length against maximum
 * @param {string} value - String to check
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Field name for error messages
 * @returns {Object|null} Error result if invalid, null if valid
 */
function checkMaxLength(value, maxLength, fieldName = 'Value') {
  if (typeof value === 'string' && value.length > maxLength) {
    return invalidResult(`${fieldName} too long. Maximum length is ${maxLength} characters`);
  }
  return null;
}

/**
 * Check string length against minimum
 * @param {string} value - String to check
 * @param {number} minLength - Minimum required length
 * @param {string} fieldName - Field name for error messages
 * @returns {Object|null} Error result if invalid, null if valid
 */
function checkMinLength(value, minLength, fieldName = 'Value') {
  if (typeof value === 'string' && value.length < minLength) {
    return invalidResult(`${fieldName} must be at least ${minLength} characters`);
  }
  return null;
}

/**
 * Check if string is not empty (after trimming)
 * @param {string} value - String to check
 * @param {string} fieldName - Field name for error messages
 * @returns {Object|null} Error result if invalid, null if valid
 */
function checkNotEmpty(value, fieldName = 'Value') {
  if (typeof value === 'string' && value.trim().length === 0) {
    return invalidResult(`${fieldName} cannot be empty`);
  }
  return null;
}

/**
 * Validate string length within bounds
 * @param {string} value - String to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} Validation result
 */
function validateStringLength(value, minLength, maxLength, fieldName = 'Value') {
  const stringCheck = checkStringType(value, fieldName);
  if (stringCheck) return stringCheck;

  const trimmed = value.trim();

  const minCheck = checkMinLength(trimmed, minLength, fieldName);
  if (minCheck) return minCheck;

  const maxCheck = checkMaxLength(trimmed, maxLength, fieldName);
  if (maxCheck) return maxCheck;

  return validResult(trimmed);
}

/**
 * Validate that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} Validation result
 */
function validateNonEmptyString(value, fieldName = 'Value') {
  const stringCheck = checkStringType(value, fieldName);
  if (stringCheck) return stringCheck;

  const emptyCheck = checkNotEmpty(value, fieldName);
  if (emptyCheck) return emptyCheck;

  return validResult(value.trim());
}

/**
 * Validate that a value is within a numeric range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} Validation result
 */
function validateNumericRange(value, min, max, fieldName = 'Value') {
  if (typeof value !== 'number' || isNaN(value)) {
    return invalidResult(`${fieldName} must be a valid number`);
  }

  if (value < min) {
    return invalidResult(`${fieldName} must be at least ${min}`);
  }

  if (value > max) {
    return invalidResult(`${fieldName} must not exceed ${max}`);
  }

  return validResult(value);
}

/**
 * Validate an array has items within bounds
 * @param {Array} value - Array to validate
 * @param {number} minItems - Minimum items
 * @param {number} maxItems - Maximum items
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} Validation result
 */
function validateArrayLength(value, minItems, maxItems, fieldName = 'Array') {
  const arrayCheck = checkArrayType(value, fieldName);
  if (arrayCheck) return arrayCheck;

  if (value.length < minItems) {
    return invalidResult(`${fieldName} must have at least ${minItems} items`);
  }

  if (value.length > maxItems) {
    return invalidResult(`${fieldName} must not exceed ${maxItems} items`);
  }

  return validResult(value);
}

/**
 * Sanitize a string by removing dangerous patterns
 * @param {string} value - String to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(value, options = {}) {
  const { trimWhitespace = true, removeControlChars = true, maxLength = null } = options;

  let result = String(value);

  if (trimWhitespace) {
    result = result.trim();
  }

  if (removeControlChars) {
    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result;
}

/**
 * Run multiple validation checks in sequence
 * Returns the first error encountered or null if all pass
 * @param  {...Function} checks - Validation check functions that return null or error
 * @returns {Object|null} First error or null if all pass
 */
function runChecks(...checks) {
  for (const check of checks) {
    const result = check();
    if (result) return result;
  }
  return null;
}

module.exports = {
  // Result creators
  createValidationResult,
  validResult,
  invalidResult,

  // Individual check functions (return null if valid, error object if invalid)
  checkRequired,
  checkStringType,
  checkArrayType,
  checkMaxLength,
  checkMinLength,
  checkNotEmpty,

  // Full validators (return complete validation result)
  validateStringLength,
  validateNonEmptyString,
  validateNumericRange,
  validateArrayLength,

  // Utilities
  sanitizeString,
  runChecks,
};
