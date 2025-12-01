const { ErrorHandler, ERROR_TYPES } = require('../../src/utils/error-handler');
const logger = require('../../src/utils/logger');

jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../src/config/config', () => ({
  RATE_LIMITS: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
}));

function resetErrorHandlerMocks() {
  jest.clearAllMocks();
}

module.exports = {
  ErrorHandler,
  ERROR_TYPES,
  logger,
  resetErrorHandlerMocks,
};
