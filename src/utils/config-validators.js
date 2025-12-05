/**
 * Configuration File Validators
 *
 * Provides common validation patterns for config files
 * to reduce code duplication in web-dashboard.js and configHandlers.js.
 */

/**
 * Validate lines in an environment file
 * @param {string} content - File content to validate
 * @returns {Object} Validation result with errors and warnings arrays
 */
function validateEnvContent(content) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    if (!trimmedLine.includes('=')) {
      result.errors.push(`Line ${index + 1}: Invalid format (missing '=')`);
      result.valid = false;
    }

    const [key] = trimmedLine.split('=');
    if (key && !key.match(/^[A-Z_][A-Z0-9_]*$/)) {
      result.warnings.push(`Line ${index + 1}: Key '${key}' doesn't follow convention`);
    }
  });

  return result;
}

/**
 * Validate JavaScript file content syntax
 * @param {string} content - File content to validate
 * @returns {Object} Validation result
 */
function validateJsContent(content) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    new Function(content);
  } catch (error) {
    result.valid = false;
    result.errors.push(`Syntax error: ${error.message}`);
  }

  return result;
}

/**
 * Perform file validation based on file type
 * @param {string} fileType - Type of file ('env' or 'js')
 * @param {string} content - File content to validate
 * @returns {Object} Validation result
 */
function validateConfigContent(fileType, content) {
  if (fileType === 'env') {
    return validateEnvContent(content);
  } else if (fileType === 'js') {
    return validateJsContent(content);
  }

  return { valid: true, errors: [], warnings: [] };
}

module.exports = {
  validateEnvContent,
  validateJsContent,
  validateConfigContent,
};
