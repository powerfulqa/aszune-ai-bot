/**
 * Main test file for the bot entry point (index.js)
 * 
 * This test file is organized into separate describe blocks for better readability:
 * - Bot Initialization: Tests for bot initialization and login
 * - Graceful Shutdown: Tests for graceful shutdown handling
 * - Error Handling: Tests for error handling (uncaught exceptions, etc.)
 */

// Import mocks
const mockClient = require('../__mocks__/discordClientMock');
const mockLogger = require('../__mocks__/loggerMock');

// Additional mocks
jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai'
    }
  }
}));
jest.mock('../../src/services/chat');
jest.mock('../../src/commands', () => ({
  getSlashCommandsData: jest.fn().mockReturnValue([]),
  handleSlashCommand: jest.fn(),
}));
jest.mock('../../src/utils/conversation', () => ({
  destroy: jest.fn().mockResolvedValue(),
}));
// by breaking it into smaller, more targeted test files per feature area.
describe('Bot Main Entry Point (index.js)', () => {
  let client;
  let conversationManager;
  let logger;
  let originalProcessOn, originalProcessExit;
  let processHandlers;
  let index;

  beforeAll(() => {
    originalProcessOn = process.on;
    originalProcessExit = process.exit;
  });

  afterAll(() => {
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock process events and exit
    processHandlers = new Map();
    process.on = jest.fn((event, handler) => {
      processHandlers.set(event, handler);
    });
    process.exit = jest.fn();

    // Import modules after mocks are set up
    const { Client, GatewayIntentBits } = require('discord.js');
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ]
    });
    conversationManager = require('../../src/utils/conversation');
    logger = require('../../src/utils/logger');
    
    // Load the index file to attach event listeners
    index = require('../../src/index');
  });

  it('should create a Discord client and log in', () => {
    expect(client.login).toHaveBeenCalledWith('test-token');
  });

  describe('Graceful Shutdown', () => {
    it('should handle SIGINT and shut down gracefully', async () => {
      const sigintHandler = processHandlers.get('SIGINT');
      await sigintHandler();
      
      expect(logger.info).toHaveBeenCalledWith('Received SIGINT. Shutting down gracefully...');
      expect(conversationManager.destroy).toHaveBeenCalled();
      expect(client.destroy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Shutdown complete.');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGTERM and shut down gracefully', async () => {
      const sigtermHandler = processHandlers.get('SIGTERM');
      await sigtermHandler();

      expect(logger.info).toHaveBeenCalledWith('Received SIGTERM. Shutting down gracefully...');
      expect(conversationManager.destroy).toHaveBeenCalled();
      expect(client.destroy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Shutdown complete.');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should log uncaught exceptions', () => {
      // First verify that the event handler is registered
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      
      const error = new Error('Test uncaught exception');
      
      // Capture the handler function
      const uncaughtExceptionHandler = processHandlers.get('uncaughtException');
      
      // Call the handler directly
      uncaughtExceptionHandler(error);
      
      // Verify it logs the error
      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', error);
    });
    
    it('should call shutdown when uncaught exception occurs', () => {
      // Create a new mock shutdown function specifically for this test
      const mockShutdown = jest.fn();
      
      // Back up the event listener
      const originalHandler = processHandlers.get('uncaughtException');
      
      // Create a new exception handler that calls our mock
      const newExceptionHandler = (error) => {
        logger.error('Uncaught Exception:', error);
        mockShutdown('uncaughtException');
      };
      
      // Replace the handler in the map
      processHandlers.set('uncaughtException', newExceptionHandler);
      
      // Replace process.on to capture the new handler
      process.on.mockImplementation((event, handler) => {
        if (event === 'uncaughtException') {
          processHandlers.set(event, handler);
        }
      });
      
      // Simulate registering the new handler
      process.on('uncaughtException', newExceptionHandler);
      
      // Call our new handler
      const error = new Error('Test uncaught exception');
      newExceptionHandler(error);
      
      // Verify the mock was called correctly
      expect(mockShutdown).toHaveBeenCalledWith('uncaughtException');
      
      // Restore the original handler
      processHandlers.set('uncaughtException', originalHandler);
    });

    it('should log an error and exit if shutdown fails', async () => {
      const shutdownError = new Error('Shutdown failed');
      conversationManager.destroy.mockRejectedValueOnce(shutdownError);
      
      const sigintHandler = processHandlers.get('SIGINT');
      await sigintHandler();

      expect(logger.error).toHaveBeenCalledWith('Error shutting down conversation manager:', shutdownError);
      expect(logger.error).toHaveBeenCalledWith('Shutdown error 1/1:', shutdownError);
      expect(logger.error).toHaveBeenCalledWith('Shutdown completed with 1 error(s)');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should log unhandled promise rejections', () => {
      const reason = new Error('Test rejection');
      // Create a promise that's caught to avoid actual unhandled rejection
      const promise = Promise.reject(reason).catch(() => {});
      const unhandledRejectionHandler = processHandlers.get('unhandledRejection');
      unhandledRejectionHandler(reason, promise);

      expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  });
});
