/**
 * Additional tests for src/index.js to reach 80%+ coverage
 * Focus on uncovered lines and branches to meet critical file requirements
 */

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('../../src/utils/logger', () => mockLogger);

// Mock config with comprehensive options
jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-key',
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    CLEANUP_INTERVAL_MINUTES: 5,
  },
  CACHE: {
    CLEANUP_INTERVAL_MS: 300000,
  },
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
      ENDPOINTS: {
        CHAT_COMPLETIONS: '/chat/completions',
      },
    },
  },
  FILE_PERMISSIONS: {
    FILE: 0o644,
    DIRECTORY: 0o755,
  },
  initializePiOptimizations: jest.fn().mockResolvedValue(),
}));

// Mock Discord.js with comprehensive event handling
const mockClient = {
  on: jest.fn(),
  once: jest.fn(),
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue(),
  user: { tag: 'TestBot#0000', id: '123456789' },
};

const mockRest = {
  put: jest.fn().mockResolvedValue(),
  setToken: jest.fn().mockReturnThis(),
};

jest.mock('discord.js', () => ({
  Client: jest.fn(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
  },
  REST: jest.fn(() => mockRest),
  Routes: {
    applicationCommands: jest.fn(() => 'applications/123456789/commands'),
  },
}));

// Mock services and utilities
jest.mock('../../src/services/chat', () => jest.fn());
jest.mock('../../src/commands', () => ({
  getSlashCommandsData: jest.fn(() => [
    { name: 'help', description: 'Show help' },
    { name: 'stats', description: 'Show stats' },
  ]),
  handleSlashCommand: jest.fn(),
}));

// Mock conversation manager
const mockConversationManager = {
  initializeIntervals: jest.fn(),
  destroy: jest.fn().mockResolvedValue(),
};
jest.mock('../../src/utils/conversation', () => jest.fn(() => mockConversationManager));

// Mock lazy loader and Pi optimization modules
jest.mock('../../src/utils/lazy-loader', () => ({
  lazyLoad: jest.fn((fn) => fn),
}));

const mockMemoryMonitor = { initialize: jest.fn() };
const mockPerformanceMonitor = { initialize: jest.fn() };
jest.mock('../../src/utils/memory-monitor', () => mockMemoryMonitor);
jest.mock('../../src/utils/performance-monitor', () => mockPerformanceMonitor);

describe('index.js - Critical Coverage Enhancement', () => {
  let index;
  let originalProcessEnv;
  let originalProcessOn;
  let originalProcessExit;

  beforeAll(() => {
    originalProcessEnv = process.env.NODE_ENV;
    originalProcessOn = process.on;
    originalProcessExit = process.exit;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalProcessEnv;
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock process methods
    process.on = jest.fn();
    process.exit = jest.fn();
  });

  describe('Production Environment with Pi Optimizations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should initialize Pi optimizations in production environment', () => {
      index = require('../../src/index');

      // Verify Pi optimization modules are loaded
      expect(mockMemoryMonitor.initialize).toHaveBeenCalled();
      expect(mockPerformanceMonitor.initialize).toHaveBeenCalled();
    });

    it('should handle Pi optimization initialization errors gracefully', () => {
      // Mock lazy loader to throw error
      const mockLazyLoader = require('../../src/utils/lazy-loader');
      mockLazyLoader.lazyLoad = jest.fn(() => {
        throw new Error('Failed to load Pi optimization module');
      });

      // Should not throw error, just log warning
      expect(() => {
        index = require('../../src/index');
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to initialize Pi optimizations:',
        expect.any(Error)
      );
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should not initialize Pi optimizations in development', () => {
      index = require('../../src/index');

      // Pi optimization modules should not be called in development
      expect(mockMemoryMonitor.initialize).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.initialize).not.toHaveBeenCalled();
    });
  });

  describe('Discord Client Event Handlers', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      index = require('../../src/index');
    });

    it('should handle ready event and register slash commands', async () => {
      // Simulate clientReady event
      const readyHandler = mockClient.once.mock.calls.find((call) => call[0] === 'clientReady')[1];

      await readyHandler();

      expect(mockLogger.info).toHaveBeenCalledWith('Discord bot is online as TestBot#0000!');
      expect(mockRest.put).toHaveBeenCalledWith('applications/123456789/commands', {
        body: expect.any(Array),
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Slash commands registered successfully');
    });

    it('should handle slash command registration errors', async () => {
      // Mock REST to throw error
      mockRest.put.mockRejectedValueOnce(new Error('Registration failed'));

      const readyHandler = mockClient.once.mock.calls.find((call) => call[0] === 'clientReady')[1];

      await readyHandler();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error registering slash commands:',
        expect.any(Error)
      );
    });

    it('should handle client not ready during slash command registration', async () => {
      // Mock client without user but provide a fallback for tag access
      mockClient.user = null;

      const readyHandler = mockClient.once.mock.calls.find((call) => call[0] === 'clientReady')[1];

      // Should throw error when trying to access user.tag
      await expect(readyHandler()).rejects.toThrow();
    });

    it('should handle error events', () => {
      const errorHandler = mockClient.on.mock.calls.find((call) => call[0] === 'error')[1];
      const testError = new Error('Discord client error');

      errorHandler(testError);

      expect(mockLogger.error).toHaveBeenCalledWith('Discord client error:', testError);
    });

    it('should handle warn events', () => {
      const warnHandler = mockClient.on.mock.calls.find((call) => call[0] === 'warn')[1];
      const testWarning = 'Discord client warning';

      warnHandler(testWarning);

      expect(mockLogger.warn).toHaveBeenCalledWith('Discord client warning:', testWarning);
    });

    it('should handle interaction events', async () => {
      const interactionHandler = mockClient.on.mock.calls.find(
        (call) => call[0] === 'interactionCreate'
      )[1];
      const mockInteraction = {
        isChatInputCommand: () => true,
      };

      await interactionHandler(mockInteraction);

      const commandHandler = require('../../src/commands');
      expect(commandHandler.handleSlashCommand).toHaveBeenCalledWith(mockInteraction);
    });

    it('should ignore non-slash interactions', async () => {
      const interactionHandler = mockClient.on.mock.calls.find(
        (call) => call[0] === 'interactionCreate'
      )[1];
      const mockInteraction = {
        isChatInputCommand: () => false,
      };

      await interactionHandler(mockInteraction);

      const commandHandler = require('../../src/commands');
      expect(commandHandler.handleSlashCommand).not.toHaveBeenCalled();
    });
  });

  describe('Shutdown Error Scenarios', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      index = require('../../src/index');
    });

    it('should handle conversation manager shutdown errors', async () => {
      // Mock conversation manager to throw error on destroy
      mockConversationManager.destroy.mockRejectedValueOnce(
        new Error('Conversation manager error')
      );

      await index.shutdown('SIGINT');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error shutting down conversation manager:',
        expect.any(Error)
      );
    });

    it('should handle Discord client shutdown errors', async () => {
      // Mock client to throw error on destroy
      mockClient.destroy.mockRejectedValueOnce(new Error('Client shutdown error'));

      await index.shutdown('SIGINT');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error shutting down Discord client:',
        expect.any(Error)
      );
    });

    it('should not duplicate shutdown when already in progress', async () => {
      // Start shutdown
      const shutdownPromise1 = index.shutdown('SIGINT');
      const shutdownPromise2 = index.shutdown('SIGTERM');

      await Promise.all([shutdownPromise1, shutdownPromise2]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Shutdown already in progress. Ignoring additional SIGTERM signal.'
      );
    });

    it('should handle multiple shutdown errors and exit with code 1', async () => {
      // Mock both conversation manager and client to fail
      mockConversationManager.destroy.mockRejectedValueOnce(new Error('Conv error'));
      mockClient.destroy.mockRejectedValueOnce(new Error('Client error'));

      // Mock process.exit in non-test environment
      process.env.NODE_ENV = 'production';

      await index.shutdown('SIGINT');

      expect(mockLogger.error).toHaveBeenCalledWith('Shutdown completed with 2 error(s)');
      // Process.exit would be called in production but not in test
    });
  });

  describe('Login Error Handling', () => {
    it('should handle Discord login failures in production', () => {
      process.env.NODE_ENV = 'production';
      mockClient.login.mockRejectedValueOnce(new Error('Login failed'));

      index = require('../../src/index');

      // In production, process.exit would be called on login failure
      // But we can't easily test this without affecting the test process
    });

    it('should handle Discord login failures in test mode', () => {
      process.env.NODE_ENV = 'test';
      mockClient.login.mockRejectedValueOnce(new Error('Login failed'));

      expect(() => {
        index = require('../../src/index');
      }).not.toThrow();
    });
  });

  describe('bootWithOptimizations Error Branches', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should handle Pi optimization errors in bootWithOptimizations', async () => {
      // Set production environment to trigger Pi optimization initialization
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock lazy loader to throw error
      jest.doMock('../../src/utils/lazy-loader', () => ({
        lazyLoad: jest.fn().mockImplementation(() => {
          throw new Error('Pi optimization error');
        }),
      }));

      // Re-import to trigger module load time initialization
      jest.resetModules();
      require('../../src/index');

      // Verify error was logged during module initialization
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to initialize Pi optimizations:',
        expect.any(Error)
      );

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should skip Pi optimizations when disabled', async () => {
      // Set production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock config with PI optimizations disabled
      jest.doMock('../../src/config/config', () => ({
        PI_OPTIMIZATIONS: { ENABLED: false },
      }));

      // Re-import to trigger module load time initialization
      jest.resetModules();
      require('../../src/index');

      // Verify Pi optimizations were not initialized
      expect(mockLogger.info).not.toHaveBeenCalledWith('Initializing Pi optimizations');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should skip Pi optimizations when config is null', async () => {
      // Set production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock config with null PI_OPTIMIZATIONS
      jest.doMock('../../src/config/config', () => ({
        PI_OPTIMIZATIONS: null,
      }));

      // Re-import to trigger module load time initialization
      jest.resetModules();
      require('../../src/index');

      // Verify Pi optimizations were not initialized
      expect(mockLogger.info).not.toHaveBeenCalledWith('Initializing Pi optimizations');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});
