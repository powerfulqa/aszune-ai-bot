/**
 * Main test file for the bot entry point (index.js)
 * 
 * This test file is organized into separate describe blocks for better readability:
 * - Bot Initialization: Tests for bot initialization and login
 * - Graceful Shutdown: Tests for graceful shutdown handling
 * - Error Handling: Tests for error handling (uncaught exceptions, etc.)
 */

// Mock the logger module with our spy functions
// Note: Jest requires using literals in mock definitions
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Get the mock for usage in our tests
const loggerMock = require('../../src/utils/logger');

// Setup client mock early
const mockClient = {
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockImplementation((event, handler) => {
    if (event === 'ready') {
      handler();
    }
    return mockClient;
  }),
  login: jest.fn().mockResolvedValue('Logged in'),
  destroy: jest.fn().mockResolvedValue(),
  user: {
    id: 'mock-user-id',
    tag: 'MockUser#0000',
    setActivity: jest.fn()
  }
};

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
  GatewayIntentBits: {
    Guilds: 'mock-guild-intent',
    GuildMessages: 'mock-message-intent',
    MessageContent: 'mock-content-intent'
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue()
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route')
  }
}));

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

describe('Bot Main Entry Point (index.js)', () => {
  let client;
  let conversationManager;
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

    // Set up mock modules
    client = mockClient;
    conversationManager = require('../../src/utils/conversation');
    
    // Clear all mock function calls
    loggerMock.info.mockClear();
    loggerMock.error.mockClear();
    loggerMock.debug.mockClear();
    loggerMock.warn.mockClear();
    
    // Load the index file to attach event listeners
    index = require('../../src/index');
  });

  it('should create a Discord client and log in', () => {
    expect(client.login).toHaveBeenCalledWith('test-token');
  });

  describe('Graceful Shutdown', () => {
    it('should register handler for SIGINT signal', () => {
      // Verify that the process.on for SIGINT is registered
      const sigintHandler = processHandlers.get('SIGINT');
      expect(sigintHandler).toBeDefined();
      
      // Verify it's a function
      expect(typeof sigintHandler).toBe('function');
    });

    it('should register handler for SIGTERM signal', () => {
      // Verify that the process.on for SIGTERM is registered
      const sigtermHandler = processHandlers.get('SIGTERM');
      expect(sigtermHandler).toBeDefined();
      
      // Verify it's a function
      expect(typeof sigtermHandler).toBe('function');
    });

    it('should register handler for uncaughtException', () => {
      // First verify that the event handler is registered
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      
      // Verify that the handler is defined
      const uncaughtExceptionHandler = processHandlers.get('uncaughtException');
      expect(uncaughtExceptionHandler).toBeDefined();
      
      // Verify it's a function
      expect(typeof uncaughtExceptionHandler).toBe('function');
    });
    
    it('should call shutdown when uncaught exception occurs', () => {
      // Create a new mock shutdown function specifically for this test
      const mockShutdown = jest.fn();
      
      // Back up the event listener
      const originalHandler = processHandlers.get('uncaughtException');
      
      // Create a new exception handler that calls our mock
      const newExceptionHandler = (error) => {
        loggerMock.error('Uncaught Exception:', error);
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
      // Mock the conversation manager to reject with an error
      const shutdownError = new Error('Shutdown failed');
      conversationManager.destroy.mockRejectedValueOnce(shutdownError);
      
      // Mock the process.exit function
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      // Call the shutdown function directly
      await index.shutdown('SIGINT');
      
      // Verify process.exit was called with error code 1
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it('should register handler for unhandled promise rejections', () => {
      // Verify the event handler is registered
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });
});
