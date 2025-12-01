/**
 * Shared setup for PerplexitySecure comprehensive test suites.
 * Keeps mocks consistent while allowing smaller files to stay under QLTY limits.
 */
const { mockSuccessResponse } = require('../../utils/undici-mock-helpers');

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

const { request } = require('undici');
const fs = require('fs').promises;
const crypto = require('crypto');
const PerplexityService = require('../../../src/services/perplexity-secure');

function setupPerplexityServiceTestContext() {
  return {
    PerplexityService,
    request,
    fs,
    crypto,
    mockSuccessResponse,
  };
}

module.exports = { setupPerplexityServiceTestContext };
