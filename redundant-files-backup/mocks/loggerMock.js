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
