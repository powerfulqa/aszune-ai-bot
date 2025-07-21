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
  },
  statusCode: 200,
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
  },
  statusCode,
});

module.exports = {
  mockSuccessResponse,
  mockErrorResponse,
};
