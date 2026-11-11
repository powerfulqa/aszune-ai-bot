const logger = require('../../../utils/logger');

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

module.exports = {
  extractResponseContent: _extractResponseContent,
};
