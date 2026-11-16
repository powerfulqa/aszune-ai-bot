/**
 * Shared validation utilities to eliminate code duplication
 * across input-validator.js, and other validators
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
 * Wrap a validation function with error handling
 * Eliminates repetitive try-catch patterns across validators
 * @param {Function} validationFn - The validation function to execute
 * @param {string} operationName - Name of the operation for error logging
 * @param {Object} errorContext - Additional context for error logging
 * @param {Function} errorHandler - Error handler function (defaults to basic handler)
 * @returns {Object} Validation result
 */
function wrapValidation(validationFn, operationName, errorContext = {}, errorHandler = null) {
  try {
    return validationFn();
  } catch (error) {
    if (errorHandler && typeof errorHandler.handleError === 'function') {
      const errorResponse = errorHandler.handleError(error, operationName, errorContext);
      return invalidResult(errorResponse.message);
    }
    return invalidResult(error.message || 'Validation failed');
  }
}

module.exports = {
  // Result creators
  createValidationResult,
  invalidResult,

  // Individual check functions (return null if valid, error object if invalid)
  checkRequired,
  checkStringType,
  checkArrayType,
  checkNotEmpty,
  wrapValidation,
};
