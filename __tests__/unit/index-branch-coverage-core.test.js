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

// Mock client
const mockClient = {
  on: jest.fn(),
  once: jest.fn(),
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue(),
  user: { tag: 'MockBot#0000', id: '123456789' },
};

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
    // Just require the module to execute the initialization code
    require('../../src/index');

    // Verify client was created and configured
    expect(mockClient.on).toHaveBeenCalled();
    expect(mockClient.login).toHaveBeenCalledWith('test-token');
  });

  it('handles error events', () => {
    const mockError = new Error('Test error');
    
    // Require the module
    require('../../src/index');

    // Simulate an error event
    const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
    errorHandler(mockError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith('Discord client error:', mockError);
  });

  it('handles warn events', () => {
    const mockWarning = 'Test warning';
    
    // Require the module
    require('../../src/index');

    // Simulate a warn event
    const warnHandler = mockClient.on.mock.calls.find(call => call[0] === 'warn')[1];
    warnHandler(mockWarning);

    // Verify warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith('Discord client warning:', mockWarning);
  });

  it('handles interaction events', () => {
    const mockInteraction = {
      isChatInputCommand: () => true,
      commandName: 'test',
    };

    // Require the module
    require('../../src/index');

    // Simulate an interaction event
    const interactionHandler = mockClient.on.mock.calls.find(call => call[0] === 'interactionCreate')[1];
    interactionHandler(mockInteraction);

    // Verify interaction was handled
    const { handleSlashCommand } = require('../../src/commands');
    expect(handleSlashCommand).toHaveBeenCalledWith(mockInteraction);
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

    // Require the module
    require('../../src/index');

    // Simulate ready event
    const readyHandler = mockClient.on.mock.calls.find(call => call[0] === 'ready')[1];
    await readyHandler();

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to register slash commands:',
      expect.any(Error)
    );
  });

  it('handles PI optimizations', async () => {
    // Mock config with PI optimizations enabled
    jest.doMock('../../src/config/config', () => ({
      DISCORD_BOT_TOKEN: 'test-token',
      PI_OPTIMIZATIONS: { ENABLED: true },
      initializePiOptimizations: jest.fn().mockResolvedValue(),
    }));

    // Require the module
    require('../../src/index');

    // Simulate ready event
    const readyHandler = mockClient.on.mock.calls.find(call => call[0] === 'ready')[1];
    await readyHandler();

    // Verify PI optimizations were initialized
    const config = require('../../src/config/config');
    expect(config.initializePiOptimizations).toHaveBeenCalled();
  });

  it('handles PI optimization failures', async () => {
    // Mock config with PI optimizations that fail
    jest.doMock('../../src/config/config', () => ({
      DISCORD_BOT_TOKEN: 'test-token',
      PI_OPTIMIZATIONS: { ENABLED: true },
      initializePiOptimizations: jest.fn().mockRejectedValue(new Error('PI init failed')),
    }));

    // Require the module
    require('../../src/index');

    // Simulate ready event
    const readyHandler = mockClient.on.mock.calls.find(call => call[0] === 'ready')[1];
    await readyHandler();

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to initialize Pi optimizations:',
      expect.any(Error)
    );
  });

  it('handles login failures in production mode', async () => {
    process.env.NODE_ENV = 'production';
    mockClient.login.mockRejectedValue(new Error('Login failed'));

    // Require the module
    require('../../src/index');

    // Wait for login attempt
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to login to Discord:',
      expect.any(Error)
    );
  });

  it('handles shutdown process', async () => {
    // Require the module
    const index = require('../../src/index');

    // Call shutdown
    await index.shutdown();

    // Verify client was destroyed
    expect(mockClient.destroy).toHaveBeenCalled();
  });
});
