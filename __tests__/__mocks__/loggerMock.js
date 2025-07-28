// Logger mock
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  handleError: jest.fn().mockReturnValue('Error message'),
  _formatMessage: jest.fn().mockReturnValue('formatted message')
};

module.exports = mockLogger;

// Mock the logger module
jest.mock('../../src/utils/logger', () => mockLogger);

// Instead of adding tests here, move them to a separate file
// This file is only for mock implementations
