const { ErrorHandler, ERROR_TYPES } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');
const config = require('../../../config/config');

function _validateResponseExists(response) {
  if (!response) {
    throw ErrorHandler.createError(
      'Invalid response: response is null or undefined',
      ERROR_TYPES.API_ERROR
    );
  }
}

function _validateResponseBody(body) {
  if (!body || typeof body.json !== 'function') {
    throw ErrorHandler.createError(
      'Invalid response: body is missing or does not have json method',
      ERROR_TYPES.API_ERROR
    );
  }
}

async function _parseResponseJson(body) {
  try {
    const responseData = await body.json();
    if (!responseData || typeof responseData !== 'object') {
      throw ErrorHandler.createError(
        'Invalid response: response is not a valid object',
        ERROR_TYPES.API_ERROR
      );
    }
    return responseData;
  } catch (error) {
    throw ErrorHandler.createError(
      `Failed to parse response as JSON: ${error.message}`,
      ERROR_TYPES.API_ERROR
    );
  }
}

function _validateResponseStructure(responseData) {
  if (
    !responseData.choices ||
    !Array.isArray(responseData.choices) ||
    responseData.choices.length === 0
  ) {
    throw ErrorHandler.createError(
      'Invalid response: missing or empty choices array',
      ERROR_TYPES.API_ERROR
    );
  }
  const firstChoice = responseData.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    throw ErrorHandler.createError(
      'Invalid response: invalid choice structure',
      ERROR_TYPES.API_ERROR
    );
  }
  if (!firstChoice.message || typeof firstChoice.message !== 'object') {
    throw ErrorHandler.createError(
      'Invalid response: choice missing required message field',
      ERROR_TYPES.API_ERROR
    );
  }
}

async function _handleErrorResponse(statusCode, body) {
  let responseText = 'Could not read response body';
  if (body && typeof body.text === 'function') {
    try {
      responseText = await body.text();
    } catch (textError) {
      responseText = `Error reading response body: ${textError.message}`;
    }
  }

  const errorMessage =
    `API request failed with status ${statusCode}: ` +
    `${responseText.substring(0, config.MESSAGE_LIMITS.ERROR_MESSAGE_MAX_LENGTH)}${
      responseText.length > config.MESSAGE_LIMITS.ERROR_MESSAGE_MAX_LENGTH ? '...' : ''
    }`;
  const error = ErrorHandler.createError(errorMessage, ERROR_TYPES.API_ERROR);
  error.statusCode = statusCode;
  throw error;
}

function _extractResponseContent(response) {
  if (!response) {
    throw new Error('Empty response received from the service.');
  }

  if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
    throw new Error('Empty response received from the service.');
  }

  const firstChoice = response.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    throw new Error('Empty response received from the service.');
  }

  if (
    firstChoice.message &&
    typeof firstChoice.message === 'object' &&
    typeof firstChoice.message.content === 'string'
  ) {
    return firstChoice.message.content;
  }

  if (typeof firstChoice.content === 'string') {
    return firstChoice.content;
  }

  logger.warn('Failed to extract response content: choice missing message or content fields');
  return 'Sorry, I could not extract content from the response.';
}

async function handleApiResponse(response) {
  _validateResponseExists(response);
  const statusCode = response.statusCode || 500;
  const body = response.body || null;

  if (statusCode < 200 || statusCode >= 300) {
    return _handleErrorResponse(statusCode, body);
  }

  _validateResponseBody(body);
  const responseData = await _parseResponseJson(body);
  _validateResponseStructure(responseData);

  return responseData;
}

module.exports = {
  handleApiResponse,
  extractResponseContent: _extractResponseContent,
  handleErrorResponse: _handleErrorResponse,
};
