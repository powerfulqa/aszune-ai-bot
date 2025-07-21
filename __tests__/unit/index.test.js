// Mock dependencies
jest.mock('events');
jest.mock('discord.js', () => {
  const original = jest.requireActual('discord.js');
  // Create mock client with EventEmitter functionality
  const mockClient = {
    on: jest.fn().mockImplementation((event, handler) => {
      if (event === 'ready') {
        handler(); // Auto-trigger ready event for testing
      }
      return mockClient;
    }),
    once: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    user: { id: 'test-user-id', tag: 'test-user#1234' },
    login: jest.fn().mockResolvedValue('Logged in'),
    destroy: jest.fn().mockResolvedValue()
  };
  
  const REST = jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue([]),
  }));

  return {
    ...original,
    Client: jest.fn(() => mockClient),
    REST,
  };
});
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
jest.mock('../../src/utils/logger');

// TODO: Consider refactoring this test suite to be more focused and easier to understand
// by breaking it into smaller, more targeted test files per feature area.
describe('Bot Main Entry Point (index.js)', () => {
  let client;
  let conversationManager;
  let logger;
  let originalProcessOn, originalProcessExit;
  let processHandlers;

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
    const { Client } = require('discord.js');
    client = new Client();
    conversationManager = require('../../src/utils/conversation');
    logger = require('../../src/utils/logger');
    
    // Load the index file to attach event listeners
    require('../../src/index');
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

    it('should handle uncaught exceptions and shut down', async () => {
      const error = new Error('Test uncaught exception');
      const uncaughtExceptionHandler = processHandlers.get('uncaughtException');
      await uncaughtExceptionHandler(error);

      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', error);
      expect(logger.info).toHaveBeenCalledWith('Received uncaughtException. Shutting down gracefully...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should log an error and exit if shutdown fails', async () => {
      const shutdownError = new Error('Shutdown failed');
      conversationManager.destroy.mockRejectedValueOnce(shutdownError);
      
      const sigintHandler = processHandlers.get('SIGINT');
      await sigintHandler();

      expect(logger.error).toHaveBeenCalledWith('Error shutting down conversation manager:', shutdownError);
      expect(logger.error).toHaveBeenCalledWith('Fatal error during shutdown process:', shutdownError);
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
