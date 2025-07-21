// Logger mock
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  _formatMessage: jest.fn().mockReturnValue('formatted message')
};

module.exports = mockLogger;

// Mock the logger module
jest.mock('../../src/utils/logger', () => mockLogger);
