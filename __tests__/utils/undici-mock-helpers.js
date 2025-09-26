/**
 * Utility for consistent undici mocking across tests
 */

/**
 * Creates a mock for successful API responses
 * @param {Object} responseData - The data to include in the response
 * @returns {Object} - A mock response object with the expected structure
 */
const mockSuccessResponse = (responseData) => ({
  body: {
    json: jest.fn().mockResolvedValue(responseData),
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
  mockSuccessResponse,
  mockErrorResponse,
};

// This file is just a utility module and doesn't need tests itself.
// Jest requires all files to have a test or be explicitly ignored.
// Actual tests for these utilities are in undici-mock-helpers.test.js
