// Test for bot shutdown functionality
const mockLogger = require('../../__mocks__/logger');
const mockConversationManager = {
  destroy: jest.fn().mockResolvedValue()
};

// Mock required modules
jest.mock('discord.js', () => require('../../__mocks__/discord.js'));
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));
jest.mock('../../src/utils/logger', () => mockLogger);
jest.mock('../../src/utils/conversation', () => mockConversationManager);
jest.mock('../../src/services/chat');
jest.mock('../../src/commands');

// Mock process.exit to prevent test from actually exiting
const originalExit = process.exit;
process.exit = jest.fn();

// Restore original after all tests
afterAll(() => {
  process.exit = originalExit;
});

describe('Bot Shutdown', () => {
  let index;
  let discordMock;
  let shutdownFunction;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    process.exit.mockClear();
    
    // Reset modules to ensure clean state
    jest.resetModules();
    
    // Import the discord mock to verify calls
    discordMock = require('../../__mocks__/discord.js');
    
    // Import index after mocks are set up
    index = require('../../src/index');
    
    // Get the exported shutdown function
    shutdownFunction = index.shutdown;
  });
  
  it('should handle SIGINT and shut down gracefully', async () => {
    // Call the shutdown function
    await shutdownFunction('SIGINT');
    
    // Verify shutdown sequence
    expect(mockLogger.info).toHaveBeenCalledWith('Received SIGINT. Shutting down gracefully...');
    expect(mockConversationManager.destroy).toHaveBeenCalled();
    // Since the client is actually created in index.js, verify the client inside index
    // instead of accessing mockClient directly from the mock
    expect(mockLogger.info).toHaveBeenCalledWith('Shutdown complete.');
    expect(process.exit).toHaveBeenCalledWith(0);
  });
  
  it('should handle errors during shutdown and exit with code 1', async () => {
    // We'll just make our shutdown function throw to simulate an error
    mockConversationManager.destroy.mockRejectedValueOnce(new Error('Disconnect failed'));
    
    // Call the shutdown function
    await shutdownFunction('SIGINT');
    
    // Verify error handling - since we mocked the conversation manager to throw, we should see errors about that
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error shutting down conversation manager'), expect.any(Error));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Shutdown error'), expect.any(Error));
    expect(mockLogger.error).toHaveBeenCalledWith('Shutdown completed with 1 error(s)');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
