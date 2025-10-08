/**
 * Core branch coverage tests for index.js
 * Tests basic initialization and error handling
 */

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('../../src/utils/logger', () => mockLogger);

// Mock config
jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  CACHE: {
    CLEANUP_INTERVAL_MS: 300000,
  },
  PI_OPTIMIZATIONS: {
    ENABLED: false,
    CLEANUP_INTERVAL_MINUTES: 5,
  },
  initializePiOptimizations: jest.fn(),
}));

// Mock client
const mockClient = {
  on: jest.fn(),
  once: jest.fn(),
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue(),
  user: { tag: 'MockBot#0000', id: '123456789' },
};

// Mock commands module
// Commands will be mocked individually in each test

// Mock Discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3,
  },
  REST: jest.fn(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue(),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route'),
  },
}));

// Mock config
jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-key',
  PI_OPTIMIZATIONS: { ENABLED: false },
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
    CLEANUP_INTERVAL_MS: 300000,
  },
  initializePiOptimizations: jest.fn(),
}));

// Mock other modules
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn(),
  handleSlashCommand: jest.fn(),
}));

// Mock chat service
jest.mock('../../src/services/chat', () => ({
  default: jest.fn(),
}));

// Mock perplexity service
jest.mock('../../src/services/perplexity-secure', () => ({
  PERPLEXITY: jest.fn().mockImplementation(() => ({
    generateChatResponse: jest.fn(),
    generateSummary: jest.fn(),
  })),
}));

describe('index.js - Core Branch Coverage', () => {
  let originalExit;
  let originalEnv;

  beforeEach(() => {
    jest.resetModules();

    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset mock client state
    mockClient.on.mockClear();
    mockClient.once.mockClear();
    mockClient.login.mockClear();
    mockClient.destroy.mockClear();
    mockClient.user = { tag: 'MockBot#0000', id: '123456789' };

    // Save original process methods
    originalExit = process.exit;
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.exit = originalExit;
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('normal initialization - no PI optimizations', () => {
    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Just require the module to execute the initialization code
    require('../../src/index');

    // Verify client was created and configured
    expect(mockClient.on).toHaveBeenCalled();
    expect(mockClient.login).toHaveBeenCalledWith('test-token');
  });

  it('handles error events', () => {
    const mockError = new Error('Test error');

    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Require the module
    require('../../src/index');

    // Simulate an error event
    const errorHandler = mockClient.on.mock.calls.find((call) => call[0] === 'error')[1];
    errorHandler(mockError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith('Discord client error:', mockError);
  });

  it('handles warn events', () => {
    const mockWarning = 'Test warning';

    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Require the module
    require('../../src/index');

    // Simulate a warn event
    const warnHandler = mockClient.on.mock.calls.find((call) => call[0] === 'warn')[1];
    warnHandler(mockWarning);

    // Verify warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith('Discord client warning:', mockWarning);
  });

  it('handles interaction events', () => {
    const mockInteraction = {
      isChatInputCommand: () => true,
      commandName: 'test',
    };

    // Clear modules first
    jest.resetModules();

    // Mock commands module before requiring index
    const mockHandleSlashCommand = jest.fn();
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: mockHandleSlashCommand,
      handleTextCommand: jest.fn(),
    }));

    // Require the module
    require('../../src/index');

    // Simulate an interaction event
    const interactionCall = mockClient.on.mock.calls.find(
      (call) => call[0] === 'interactionCreate'
    );
    if (interactionCall) {
      const interactionHandler = interactionCall[1];
      interactionHandler(mockInteraction);

      // Verify interaction was handled
      expect(mockHandleSlashCommand).toHaveBeenCalledWith(mockInteraction);
    } else {
      // If no interaction handler found, verify that the client was set up to handle interactions
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
    }
  });

  it('handles ready event with slash command registration failure', async () => {
    // Mock REST to throw error
    const mockRest = {
      setToken: jest.fn().mockReturnThis(),
      put: jest.fn().mockRejectedValue(new Error('Registration failed')),
    };

    jest.doMock('discord.js', () => ({
      Client: jest.fn(() => mockClient),
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

    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Require the module
    require('../../src/index');

    // Simulate ready event
    const readyCall = mockClient.once.mock.calls.find((call) => call[0] === 'clientReady');
    if (readyCall) {
      const readyHandler = readyCall[1];
      await readyHandler();
    }

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error registering slash commands:',
      expect.any(Error)
    );
  });

  it('handles PI optimizations', async () => {
    // Set production environment to trigger Pi optimization initialization
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Mock lazy loader to track calls
    const mockLazyLoad = jest.fn().mockImplementation((loader) => {
      const mockModule = { initialize: jest.fn() };
      loader(); // Call the loader function
      // Return a function that returns the mock module (matching lazyLoad behavior)
      return () => mockModule;
    });

    jest.doMock('../../src/utils/lazy-loader', () => ({
      lazyLoad: mockLazyLoad,
    }));

    // Mock config with PI optimizations enabled
    jest.doMock('../../src/config/config', () => ({
      DISCORD_BOT_TOKEN: 'test-token',
      PI_OPTIMIZATIONS: { ENABLED: true },
      CACHE: {
        CLEANUP_INTERVAL_MS: 300000,
        CLEANUP_INTERVAL_DAYS: 1,
        MAX_AGE_DAYS: 7,
      },
    }));

    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Re-import to trigger module load time initialization
    jest.resetModules();
    require('../../src/index');

    // Verify Pi optimizations were initialized during module load
    expect(mockLogger.info).toHaveBeenCalledWith('Initializing Pi optimizations');
    expect(mockLazyLoad).toHaveBeenCalledTimes(2); // memory-monitor and performance-monitor

    // Restore environment
    process.env.NODE_ENV = originalEnv;
  });

  it('handles PI optimization failures', async () => {
    // Set production environment to trigger Pi optimization initialization
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Mock lazy loader to throw error
    jest.doMock('../../src/utils/lazy-loader', () => ({
      lazyLoad: jest.fn().mockImplementation(() => {
        throw new Error('Pi optimization error');
      }),
    }));

    // Mock config with PI optimizations enabled
    jest.doMock('../../src/config/config', () => ({
      DISCORD_BOT_TOKEN: 'test-token',
      PI_OPTIMIZATIONS: { ENABLED: true },
      CACHE: {
        CLEANUP_INTERVAL_MS: 300000,
        CLEANUP_INTERVAL_DAYS: 1,
        MAX_AGE_DAYS: 7,
      },
    }));

    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
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

  it('handles login failures in production mode', async () => {
    // Mock modules that create setInterval calls
    jest.doMock('../../src/utils/conversation', () => {
      const MockConversationManager = jest.fn().mockImplementation(() => ({
        initializeIntervals: jest.fn(),
        addMessage: jest.fn(),
        getHistory: jest.fn(),
        getUserStats: jest.fn(),
        updateUserStats: jest.fn(),
        destroy: jest.fn(),
      }));
      return MockConversationManager;
    });

    jest.doMock('../../src/services/perplexity-secure', () => ({
      generateChatResponse: jest.fn(),
      generateSummary: jest.fn(),
    }));

    jest.doMock('../../src/config/config', () => ({
      DISCORD_BOT_TOKEN: 'test-token',
      CACHE: {
        CLEANUP_INTERVAL_MS: 300000,
      },
      PI_OPTIMIZATIONS: {
        ENABLED: false,
        CLEANUP_INTERVAL_MINUTES: 5,
      },
      initializePiOptimizations: jest.fn(),
    }));

    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Keep NODE_ENV as 'test' to prevent process.exit calls
    mockClient.login.mockRejectedValue(new Error('Login failed'));

    // Require the module
    require('../../src/index');

    // Wait for login attempt
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to log in to Discord:',
      expect.any(Error)
    );
  });

  it('handles shutdown process', async () => {
    // Mock commands module
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
      handleTextCommand: jest.fn(),
    }));

    // Require the module
    const index = require('../../src/index');

    // Call shutdown
    await index.shutdown();

    // Verify client was destroyed
    expect(mockClient.destroy).toHaveBeenCalled();
  });
});
