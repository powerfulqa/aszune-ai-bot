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

module.exports = {
  getPiSettings: _getPiSettings,
};
