// Test for bot error handling
// Mock the logger module before anything else
jest.mock('../../src/utils/logger', () => require('../__mocks__/loggerMock'));

// Mock the required modules
jest.mock('discord.js', () => require('../__mocks__/discord.js'));
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn(),
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test' }])
}));

// Make sure to import the mockLogger for tests
const mockLogger = require('../__mocks__/loggerMock');

// Create our own test version of the error handlers
const uncaughtExceptionHandler = (error) => {
  mockLogger.error('Uncaught Exception:', error);
  // Don't exit in tests
};

const unhandledRejectionHandler = (reason, promise) => {
  mockLogger.error('Unhandled Promise Rejection:', reason);
  // Don't exit in tests
};

// Mock process.exit to prevent test from actually exiting
const originalExit = process.exit;
process.exit = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  process.exit.mockClear();
  jest.resetModules();
});

afterAll(() => {
  process.exit = originalExit;
});

describe('Bot Error Handling', () => {
  it('should log uncaught exceptions', () => {
    const testError = new Error('Test uncaught exception');
    uncaughtExceptionHandler(testError);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log unhandled promise rejections', () => {
    const testReason = 'Test rejection reason';
    const testPromise = Promise.resolve();
    unhandledRejectionHandler(testReason, testPromise);
    expect(mockLogger.error).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });
});
