/**
 * Function-specific branch coverage tests for index.js
 * Tests individual functions like bootWithOptimizations and registerSlashCommands
 */

// Mock Discord.js before any imports
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue(),
    destroy: jest.fn().mockResolvedValue(),
    user: { tag: 'MockBot#0000', id: '123456789' },
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3,
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn(),
    put: jest.fn().mockResolvedValue(),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route'),
  },
}));

describe('index.js - Function Branch Coverage', () => {
  describe('bootWithOptimizations function', () => {
    let index;
    let mockConfig;
    let mockLogger;

    beforeEach(() => {
      jest.resetModules();

      // Mock logger
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      jest.mock('../../src/utils/logger', () => mockLogger);

      // Mock config
      mockConfig = {
        DISCORD_BOT_TOKEN: 'test-token',
        PERPLEXITY_API_KEY: 'test-key',
        PI_OPTIMIZATIONS: { ENABLED: true },
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
        CACHE: {
          DEFAULT_MAX_ENTRIES: 100,
          MAX_MEMORY_MB: 50,
          DEFAULT_TTL_MS: 300000,
        },
        initializePiOptimizations: jest.fn(),
      };
      jest.mock('../../src/config/config', () => mockConfig);

      // Import the index module
      index = require('../../src/index');
    });

    it('should handle errors in Pi optimization initialization', async () => {
      // Setup
      mockConfig.initializePiOptimizations.mockRejectedValue(new Error('Test optimization error'));

      // Call the bootWithOptimizations function directly
      await index.bootWithOptimizations();

      // Verify error handling
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize Pi optimizations:',
        expect.any(Error)
      );
    });

    it('should not call initialization when PI_OPTIMIZATIONS is disabled', async () => {
      // Setup
      mockConfig.PI_OPTIMIZATIONS.ENABLED = false;

      // Call the bootWithOptimizations function directly
      await index.bootWithOptimizations();

      // Verify initialization was not called
      expect(mockConfig.initializePiOptimizations).not.toHaveBeenCalled();
    });
  });

  describe('registerSlashCommands function', () => {
    let index;
    let mockClient;
    let mockRest;
    let mockLogger;

    beforeEach(() => {
      jest.resetModules();

      // Mock logger
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      jest.mock('../../src/utils/logger', () => mockLogger);

      // Mock client
      mockClient = {
        user: { id: '123456789' },
        readyAt: new Date(),
      };

      // Mock REST
      mockRest = {
        setToken: jest.fn().mockReturnThis(),
        put: jest.fn().mockResolvedValue(),
      };

      jest.mock('discord.js', () => ({
        Client: jest.fn().mockImplementation(() => ({
          on: jest.fn(),
          once: jest.fn(),
          login: jest.fn().mockResolvedValue(),
          destroy: jest.fn().mockResolvedValue(),
          user: { tag: 'MockBot#0000', id: '123456789' },
        })),
        GatewayIntentBits: {
          Guilds: 1,
          GuildMessages: 2,
          MessageContent: 3,
        },
        REST: jest.fn(() => mockRest),
        Routes: {
          applicationCommands: jest.fn().mockReturnValue('mock-route'),
        },
      }));

      // Import the index module
      index = require('../../src/index');
    });

    it('should handle client not being ready', async () => {
      // Mock the Client constructor to return a client with no user
      const MockClient = jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        once: jest.fn(),
        login: jest.fn().mockResolvedValue(),
        destroy: jest.fn().mockResolvedValue(),
        user: null, // Client not ready
      }));
      
      jest.doMock('discord.js', () => ({
        Client: MockClient,
        GatewayIntentBits: {
          Guilds: 1,
          GuildMessages: 2,
          MessageContent: 3,
        },
        REST: jest.fn().mockImplementation(() => ({
          setToken: jest.fn(),
          put: jest.fn().mockResolvedValue(),
        })),
        Routes: {
          applicationCommands: jest.fn().mockReturnValue('mock-route'),
        },
      }));

      // Re-import the module with the mocked client
      jest.resetModules();
      const indexModule = require('../../src/index');

      // Call registerSlashCommands
      await indexModule.registerSlashCommands();

      // Verify warning was logged
      expect(mockLogger.error).toHaveBeenCalledWith('Cannot register slash commands: Client not ready');
    });

    it('should handle errors during slash command registration', async () => {
      // Setup REST to throw error
      mockRest.put.mockRejectedValue(new Error('Registration failed'));

      // Call registerSlashCommands (no parameters needed - uses global client)
      await index.registerSlashCommands();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error registering slash commands:',
        expect.any(Error)
      );
    });
  });

  describe('Multiple shutdown attempts', () => {
    let index;
    let mockClient;

    beforeEach(() => {
      jest.resetModules();

      // Mock client
      mockClient = {
        on: jest.fn(),
        once: jest.fn(),
        login: jest.fn().mockResolvedValue(),
        destroy: jest.fn().mockResolvedValue(),
        user: { tag: 'MockBot#0000', id: '123456789' },
      };

      jest.mock('discord.js', () => ({
        Client: jest.fn(() => mockClient),
        GatewayIntentBits: {
          Guilds: 1,
          GuildMessages: 2,
          MessageContent: 3,
        },
      }));

      // Import the index module
      index = require('../../src/index');
    });

    it('should prevent multiple simultaneous shutdown attempts', async () => {
      // Start two shutdown attempts simultaneously
      const shutdown1 = index.shutdown();
      const shutdown2 = index.shutdown();

      // Wait for both to complete
      await Promise.all([shutdown1, shutdown2]);

      // Verify client was only destroyed once
      expect(mockClient.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
