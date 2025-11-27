jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    stat: jest.fn(),
    appendFile: jest.fn(),
    rename: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
  },
}));

jest.mock('../../src/config/config', () => ({
  LOGGING: {
    DEFAULT_MAX_SIZE_MB: 10,
    MAX_LOG_FILES: 5,
  },
}));

const fs = require('fs').promises;
const originalConsole = { ...console };
const originalEnv = { ...process.env };

function prepareLoggerTest() {
  jest.clearAllMocks();

  process.env = { ...originalEnv };
  process.env.NODE_ENV = 'development';
  process.env.PI_LOG_LEVEL = 'DEBUG';
  process.env.PI_LOG_MAX_SIZE_MB = '5';

  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();

  fs.mkdir.mockResolvedValue();
  fs.stat.mockResolvedValue({ size: 1000000 });
  fs.appendFile.mockResolvedValue();
  fs.rename.mockResolvedValue();
  fs.readdir.mockResolvedValue(['bot.log.2023-01-01', 'bot.log.2023-01-02']);
  fs.unlink.mockResolvedValue();

  delete require.cache[require.resolve('../../src/utils/logger')];
  const logger = require('../../src/utils/logger');

  return {
    logger,
    fs,
    restoreConsole: () => {
      Object.assign(console, originalConsole);
    },
    resetEnv: () => {
      process.env = { ...originalEnv };
    },
  };
}

module.exports = {
  prepareLoggerTest,
};
