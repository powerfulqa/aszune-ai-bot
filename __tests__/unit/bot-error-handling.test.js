// Test for bot error handling
const mockLogger = require('../__mocks__/loggerMock');

// Mock the required modules
jest.mock('discord.js', () => require('../../__mocks__/discord.js'));
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn(),
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test' }])
}));

// Mock process.exit to prevent test from actually exiting
const originalExit = process.exit;
process.exit = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  jest.resetAllMocks();
  process.exit.mockClear();
});

// Restore original after all tests
afterAll(() => {
  process.exit = originalExit;
});

describe('Bot Error Handling', () => {
  let uncaughtExceptionHandler;
  let unhandledRejectionHandler;
  
  beforeEach(() => {
    // Re-import the index module for each test
    jest.resetModules();
    require('../../src/index');
    
    // Extract the error handlers for testing
    uncaughtExceptionHandler = process.listeners('uncaughtException')[0];
    unhandledRejectionHandler = process.listeners('unhandledRejection')[0];
  });
  
  it('should log uncaught exceptions', () => {
    const testError = new Error('Test uncaught exception');
    uncaughtExceptionHandler(testError);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Uncaught Exception'),
      expect.objectContaining({ message: 'Test uncaught exception' })
    );
  });
  
  it('should log unhandled promise rejections', () => {
    const testReason = 'Test rejection reason';
    const testPromise = Promise.resolve();
    unhandledRejectionHandler(testReason, testPromise);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled Rejection'),
      expect.anything(),
      expect.stringContaining('reason:'),
      testReason
    );
    // Verify we don't exit on unhandled rejections, just log
    expect(process.exit).not.toHaveBeenCalled();
  });
});
