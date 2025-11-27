jest.mock('undici', () => ({
  request: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    chmod: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('No access')),
    stat: jest.fn().mockResolvedValue({
      isDirectory: jest.fn().mockReturnValue(true),
    }),
  },
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash-123'),
  }),
}));

const PerplexityService = require('../../../src/services/perplexity-secure');

function preparePerplexitySecurePrivate() {
  jest.clearAllMocks();

  const fs = require('fs').promises;
  const crypto = require('crypto');

  fs.readFile.mockRejectedValue(new Error('File not found'));

  return {
    PerplexityService,
    fs,
    crypto,
  };
}

module.exports = {
  preparePerplexitySecurePrivate,
};
