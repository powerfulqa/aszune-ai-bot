const config = require('../../../config/config');
const logger = require('../../../utils/logger');
const { ErrorHandler } = require('../../../utils/error-handler');

function _getPiSettings() {
  const defaultSettings = { enabled: false, lowCpuMode: false };
  try {
    if (config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null) {
      return {
        enabled: Boolean(config.PI_OPTIMIZATIONS.ENABLED),
        lowCpuMode: Boolean(config.PI_OPTIMIZATIONS.LOW_CPU_MODE),
      };
    }
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, 'accessing PI_OPTIMIZATIONS config');
    logger.warn(`Config access error: ${errorResponse.message}`);
  }
  return defaultSettings;
}

function _getPiOptimizationSettings() {
  return _getPiSettings();
}

function buildRequestPayload(messages, options = {}) {
  const payload = {
    model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
    messages,
    max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
    temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE,
  };

  const piOptSettings = _getPiOptimizationSettings();
  if (options.stream && piOptSettings.enabled && !piOptSettings.lowCpuMode) {
    payload.stream = true;
  }

  return payload;
}

module.exports = {
  buildRequestPayload,
  getPiSettings: _getPiSettings,
};
