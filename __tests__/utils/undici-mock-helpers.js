/**
 * Utility for consistent undici mocking across tests
 */

/**
 * Convert a legacy Chat Completions body (`choices[0].message.content`) into
 * the Agent API shape (`output_text`) the client now parses. Bodies already in
 * Agent shape, or without choices, pass through unchanged.
 * @param {Object} data - Response body as written by a test
 * @returns {Object} Agent-shaped body
 */
const toAgentBody = (data) => {
  if (!data || typeof data !== 'object' || data.output_text || data.output) return data;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return data;
  const { choices: _choices, ...rest } = data;
  return { ...rest, output_text: content };
};

/**
 * Creates a mock for successful API responses
 * @param {Object} responseData - The data to include in the response
 * @returns {Object} - A mock response object with the expected structure
 */
const mockSuccessResponse = (responseData) => ({
  body: {
    json: jest.fn().mockResolvedValue(toAgentBody(responseData)),
    text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
  },
  statusCode: 200,
  headers: {
    get: jest.fn((key) => (key.toLowerCase() === 'content-type' ? 'application/json' : null)),
  },
});

/**
 * Creates a mock for error API responses
 * @param {Object} errorData - The error data to include
 * @param {number} statusCode - HTTP status code (default: 400)
 * @returns {Object} - A mock response object with the expected error structure
 */
const mockErrorResponse = (errorData, statusCode = 400) => ({
  body: {
    text: jest.fn().mockResolvedValue(JSON.stringify(errorData)),
    json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
  },
  statusCode,
  headers: {
    get: jest.fn((key) => (key.toLowerCase() === 'content-type' ? 'application/json' : null)),
  },
});

// Export the mock utilities for use in tests
module.exports = {
  toAgentBody,
  mockSuccessResponse,
  mockErrorResponse,
};

// This file is just a utility module and doesn't need tests itself.
// Jest requires all files to have a test or be explicitly ignored.
// Actual tests for these utilities are in undici-mock-helpers.test.js
