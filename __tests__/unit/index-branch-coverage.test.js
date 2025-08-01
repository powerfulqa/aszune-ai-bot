/**
 * Additional branch coverage tests for index.js
 */

// Mock the logger module
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Get the mock for usage in our tests
const loggerMock = require('../../src/utils/logger');

// Mock Discord client
const mockClient = {
  on: jest.fn(),
  once: jest.fn(),
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue(),
  user: { tag: 'MockBot#0000', id: '12345' }
};

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue()
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route')
  }
}));

// Mock commands
const mockCommands = {
  getSlashCommandsData: jest.fn().mockReturnValue([]),
  handleSlashCommand: jest.fn()
};
jest.mock('../../src/commands', () => mockCommands);

// Mock chat service
jest.mock('../../src/services/chat', () => jest.fn());

describe('index.js - Branch Coverage Tests', () => {
  let originalEnv;
  let originalProcessExit;
  let originalProcessOn;
  let exitMock;
  let index;
  
  beforeEach(() => {
    // Save original environment and functions
    originalEnv = { ...process.env };
    originalProcessExit = process.exit;
    originalProcessOn = process.on;
    
    // Mock process.exit
    exitMock = jest.fn();
    process.exit = exitMock;
    
    // Reset mocks
    jest.resetModules();
    jest.clearAllMocks();
    
    // Clear all mock function calls
    loggerMock.info.mockClear();
    loggerMock.error.mockClear();
    loggerMock.debug.mockClear();
    loggerMock.warn.mockClear();
    mockClient.on.mockClear();
    mockClient.once.mockClear();
    mockClient.login.mockClear();
  });
  
  afterEach(() => {
    // Restore original environment and functions
    process.env = originalEnv;
    process.exit = originalProcessExit;
    process.on = originalProcessOn;
  });
  
  describe('bootWithOptimizations function', () => {
    it('should handle errors in Pi optimization initialization', async () => {
      // Setup config mock with Pi optimizations that will throw an error
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: true
        },
        initializePiOptimizations: jest.fn().mockRejectedValue(new Error('Test optimization error'))
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Call the bootWithOptimizations function directly
      await index.bootWithOptimizations();
      
      // Verify error handling
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to initialize Pi optimizations:',
        expect.any(Error)
      );
    });
    
    it('should not call initialization when PI_OPTIMIZATIONS is disabled', async () => {
      // Setup config mock with Pi optimizations disabled
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        },
        initializePiOptimizations: jest.fn()
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Call the bootWithOptimizations function directly
      await index.bootWithOptimizations();
      
      // Verify initialization was not called
      expect(configMock.initializePiOptimizations).not.toHaveBeenCalled();
    });
  });
  
  describe('registerSlashCommands function', () => {
    it('should handle client not being ready', async () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Get the registerSlashCommands function
      const registerSlashCommands = index.registerSlashCommands;
      
      // Set client.user to null to simulate client not ready
      const originalUser = mockClient.user;
      mockClient.user = null;
      
      // Call the registerSlashCommands function directly
      await registerSlashCommands();
      
      // Verify error handling
      expect(loggerMock.error).toHaveBeenCalledWith('Cannot register slash commands: Client not ready');
      
      // Restore mockClient.user
      mockClient.user = originalUser;
    });
    
    it('should handle errors during slash command registration', async () => {
      // Setup config mock
      
      // Mock REST to throw an error
      const { REST } = require('discord.js');
      REST.mockImplementation(() => ({
        setToken: jest.fn().mockReturnThis(),
        put: jest.fn().mockRejectedValue(new Error('Registration failed'))
      }));
      
      // Mock the config module
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Get the registerSlashCommands function
      const registerSlashCommands = index.registerSlashCommands;
      
      // Call the registerSlashCommands function directly
      await registerSlashCommands();
      
      // Verify error handling
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Error registering slash commands:',
        expect.any(Error)
      );
    });
  });
  
  describe('Multiple shutdown attempts', () => {
    it('should prevent multiple simultaneous shutdown attempts', async () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Get the shutdown function
      const shutdown = index.shutdown;
      
      // Call shutdown multiple times
      const firstShutdown = shutdown('SIGINT');
      shutdown('SIGTERM');
      
      // Wait for the first shutdown to complete
      await firstShutdown;
      
      // Verify the second shutdown was ignored
      expect(loggerMock.info).toHaveBeenCalledWith('Shutdown already in progress. Ignoring additional SIGTERM signal.');
    });
  });
  
  describe('Discord client event handlers', () => {
    it('should handle error events', () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Find the error handler
      const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
      
      // Call the error handler
      const testError = new Error('Test client error');
      errorHandler(testError);
      
      // Verify error was logged
      expect(loggerMock.error).toHaveBeenCalledWith('Discord client error:', testError);
    });
    
    it('should handle warning events', () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Find the warning handler
      const warnHandler = mockClient.on.mock.calls.find(call => call[0] === 'warn')[1];
      
      // Call the warning handler
      warnHandler('Test warning');
      
      // Verify warning was logged
      expect(loggerMock.warn).toHaveBeenCalledWith('Discord client warning:', 'Test warning');
    });
    
    it('should handle non-command interactions', async () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Find the interaction handler
      const interactionHandler = mockClient.on.mock.calls.find(call => call[0] === 'interactionCreate')[1];
      
      // Call the interaction handler with non-command interaction
      const interaction = { isChatInputCommand: () => false };
      await interactionHandler(interaction);
      
      // Verify command handler wasn't called
      expect(mockCommands.handleSlashCommand).not.toHaveBeenCalled();
    });
    
    it('should handle command interactions', async () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Import the index module
      index = require('../../src/index');
      
      // Find the interaction handler
      const interactionHandler = mockClient.on.mock.calls.find(call => call[0] === 'interactionCreate')[1];
      
      // Call the interaction handler with command interaction
      const interaction = { isChatInputCommand: () => true };
      await interactionHandler(interaction);
      
      // Verify command handler was called
      expect(mockCommands.handleSlashCommand).toHaveBeenCalledWith(interaction);
    });
  });
  
  describe('Login process', () => {
    it('should handle login failure in production mode', async () => {
      // Setup config mock
      jest.mock('../../src/config/config', () => ({
        DISCORD_BOT_TOKEN: 'test-token',
        PI_OPTIMIZATIONS: {
          ENABLED: false
        }
      }));
      
      // Mock client login to fail
      mockClient.login.mockRejectedValue(new Error('Login failed'));
      
      // Set to production mode
      process.env.NODE_ENV = 'production';
      
      // Import the index module - this will trigger the login process
      index = require('../../src/index');
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Verify error was logged
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to log in to Discord:',
        expect.any(Error)
      );
      
      // Verify process exit was called
      expect(exitMock).toHaveBeenCalledWith(1);
    });
  });
});
