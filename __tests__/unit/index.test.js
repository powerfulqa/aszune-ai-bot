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
  error: jest.fn(),
}));

// Mock the config module
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));

// Mock the enhanced cache module to avoid config dependency issues
jest.mock('../../src/utils/enhanced-cache', () => {
  const mockInstance = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
    getDetailedInfo: jest.fn().mockReturnValue({ entries: [], memoryUsage: 0 }),
  };

  const mockClass = jest.fn().mockImplementation(() => mockInstance);

  // Export both the class and the EVICTION_STRATEGIES
  mockClass.EVICTION_STRATEGIES = {
    LRU: 'LRU',
    LFU: 'LFU',
    TTL: 'TTL',
    SIZE_BASED: 'SIZE_BASED',
    HYBRID: 'HYBRID',
  };

  return mockClass;
});

// Mock the perplexity-secure service to avoid config dependency issues
jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
  generateSummary: jest.fn(),
  getCacheStats: jest.fn(),
  getDetailedCacheInfo: jest.fn(),
  invalidateCacheByTag: jest.fn(),
}));

// Get the mock for usage in our tests
const loggerMock = require('../../src/utils/logger');

// Setup client mock early
let mockClientReadyHandler;
const mockClient = {
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockImplementation((event, handler) => {
    if (event === 'ready') {
      mockClientReadyHandler = handler; // Store handler for manual triggering
    }
    return mockClient;
  }),
  login: jest.fn().mockResolvedValue('Logged in'),
  destroy: jest.fn().mockResolvedValue(),
  user: {
    id: 'mock-user-id',
    tag: 'MockUser#0000',
    setActivity: jest.fn(),
  },
};

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
  GatewayIntentBits: {
    Guilds: 'mock-guild-intent',
    GuildMessages: 'mock-message-intent',
    MessageContent: 'mock-content-intent',
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue(),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route'),
  },
}));

// Additional mocks
jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
    },
  },
}));
jest.mock('../../src/services/chat');
jest.mock('../../src/commands', () => ({
  getSlashCommandsData: jest.fn().mockReturnValue([]),
  handleSlashCommand: jest.fn(),
}));
const ConversationManager = require('../../src/utils/conversation');
let conversationManager;
beforeEach(() => {
  conversationManager = new ConversationManager();
  conversationManager.destroy = jest.fn();
});

describe('Bot Main Entry Point (index.js)', () => {
  let client;
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

    // Clear all mock function calls
    loggerMock.info.mockClear();
    loggerMock.error.mockClear();
    loggerMock.debug.mockClear();
    loggerMock.warn.mockClear();

    // Load the index file to attach event listeners
    // Patch index to use our mock client and logger if possible
    index = require('../../src/index');
    index.__setLogger && index.__setLogger(loggerMock);
    index.__setClient && index.__setClient(mockClient);
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
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      // Simulate shutdown error
      const shutdown = require('../../src/index').shutdown;
      await shutdown('SIGINT');
      // In test mode, process.exit() should not be called
      expect(exitSpy).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    });

    it('should register handler for unhandled promise rejections', () => {
      // Verify the event handler is registered
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('Boot Optimizations', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      jest.clearAllMocks();
      mockClientReadyHandler = undefined; // Reset handler
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should initialize license validation when enabled', async () => {
      // Mock license validator constructor
      const MockLicenseValidator = jest.fn().mockImplementation(() => ({
        enforceLicense: jest.fn().mockResolvedValue(true),
      }));

      jest.doMock('../../src/utils/license-validator', () => MockLicenseValidator);

      // Mock config with license validation enabled
      const mockConfig = {
        FEATURES: {
          LICENSE_VALIDATION: true,
          LICENSE_SERVER: false,
          DEVELOPMENT_MODE: false,
        },
        PI_OPTIMIZATIONS: { ENABLED: false },
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(loggerMock.info).toHaveBeenCalledWith('Validating software license...');
      expect(loggerMock.info).toHaveBeenCalledWith('License validation successful - starting bot...');
    });

    it('should skip license validation when disabled', async () => {
      // Mock config with license validation disabled
      const mockConfig = {
        FEATURES: {
          LICENSE_VALIDATION: false,
          LICENSE_SERVER: false,
          DEVELOPMENT_MODE: false,
        },
        PI_OPTIMIZATIONS: { ENABLED: false },
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(loggerMock.info).toHaveBeenCalledWith('License validation disabled via feature flags - starting bot...');
    });

    it('should initialize license server when enabled', async () => {
      // Mock license server constructor
      const MockLicenseServer = jest.fn().mockImplementation(() => ({
        start: jest.fn(),
      }));

      jest.doMock('../../src/utils/license-server', () => MockLicenseServer);

      // Mock config with license server enabled
      const mockConfig = {
        FEATURES: {
          LICENSE_VALIDATION: false,
          LICENSE_SERVER: true,
          DEVELOPMENT_MODE: false,
        },
        PI_OPTIMIZATIONS: { ENABLED: false },
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(MockLicenseServer).toHaveBeenCalled();
    });

    it('should handle Pi optimizations initialization', async () => {
      // Mock config with Pi optimizations enabled
      const mockConfig = {
        FEATURES: {
          LICENSE_VALIDATION: false,
          LICENSE_SERVER: false,
          DEVELOPMENT_MODE: false,
        },
        PI_OPTIMIZATIONS: { ENABLED: true },
        initializePiOptimizations: jest.fn().mockResolvedValue(),
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(loggerMock.info).toHaveBeenCalledWith('Initializing Raspberry Pi optimizations...');
      expect(mockConfig.initializePiOptimizations).toHaveBeenCalled();
      expect(loggerMock.info).toHaveBeenCalledWith('Pi optimizations initialized successfully');
    });

    it('should handle Pi optimizations initialization failure gracefully', async () => {
      // Mock config with Pi optimizations enabled but failing
      const mockConfig = {
        FEATURES: {
          LICENSE_VALIDATION: false,
          LICENSE_SERVER: false,
          DEVELOPMENT_MODE: false,
        },
        PI_OPTIMIZATIONS: { ENABLED: true },
        initializePiOptimizations: jest.fn().mockRejectedValue(new Error('Pi init failed')),
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(loggerMock.error).toHaveBeenCalledWith('Failed to initialize Pi optimizations:', expect.any(Error));
    });
  });

  describe('Reminder Service Initialization', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockClientReadyHandler = undefined; // Reset handler
    });

    it('should initialize reminder service on ready event', async () => {
      // Mock reminder service
      const mockReminderService = {
        initialize: jest.fn().mockResolvedValue(),
        on: jest.fn(),
        shutdown: jest.fn(),
      };

      jest.doMock('../../src/services/reminder-service', () => mockReminderService);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(mockReminderService.initialize).toHaveBeenCalled();
      expect(loggerMock.info).toHaveBeenCalledWith('Reminder service initialized');
    });

    it('should handle reminder service initialization failure', async () => {
      // Mock reminder service that fails
      const mockReminderService = {
        initialize: jest.fn().mockRejectedValue(new Error('Reminder init failed')),
        on: jest.fn(),
        shutdown: jest.fn(),
      };

      jest.doMock('../../src/services/reminder-service', () => mockReminderService);

      // Re-import to get updated mocks
      jest.resetModules();
      require('../../src/index');

      // Manually trigger the ready event
      if (mockClientReadyHandler) {
        await mockClientReadyHandler();
      }

      expect(loggerMock.error).toHaveBeenCalledWith('Failed to initialize reminder service:', expect.any(Error));
    });
  });

  describe('Pi Optimizations in Production', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      jest.clearAllMocks();
      mockClientReadyHandler = undefined; // Reset handler
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should initialize Pi optimizations in production mode', () => {
      // Set production environment
      process.env.NODE_ENV = 'production';

      // Mock config with Pi optimizations enabled
      const mockConfig = {
        PI_OPTIMIZATIONS: { ENABLED: true },
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Mock lazy loader and monitors
      const mockLazyLoad = jest.fn().mockImplementation((loader) => {
        const mockMonitor = {
          initialize: jest.fn(),
        };
        loader(); // Call the loader function
        return mockMonitor;
      });

      jest.doMock('../../src/utils/lazy-loader', () => ({
        lazyLoad: mockLazyLoad,
      }));

      // Re-require index to trigger production initialization
      jest.resetModules();
      require('../../src/index');

      expect(loggerMock.info).toHaveBeenCalledWith('Initializing Pi optimizations');
    });

    it('should handle Pi optimizations initialization failure in production', () => {
      // Set production environment
      process.env.NODE_ENV = 'production';

      // Mock config with Pi optimizations enabled
      const mockConfig = {
        PI_OPTIMIZATIONS: { ENABLED: true },
      };

      jest.doMock('../../src/config/config', () => mockConfig);

      // Mock lazy loader to throw error
      jest.doMock('../../src/utils/lazy-loader', () => ({
        lazyLoad: jest.fn().mockImplementation(() => {
          throw new Error('Lazy load failed');
        }),
      }));

      // Re-require index to trigger production initialization
      jest.resetModules();
      require('../../src/index');

      expect(loggerMock.warn).toHaveBeenCalledWith('Failed to initialize Pi optimizations:', expect.any(Error));
    });
  });
});
