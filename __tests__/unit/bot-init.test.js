// Test for bot initialization and login
const mockLogger = require('../__mocks__/loggerMock');

// Mock discord.js before creating any variables
jest.mock('discord.js', () => {
  // Create client mock inside the factory function
  const mockClientInstance = {
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    login: jest.fn().mockResolvedValue('test-token'),
    destroy: jest.fn().mockResolvedValue(),
    user: {
      setActivity: jest.fn(),
      id: 'botUserId',
    },
  };

  const Client = jest.fn(() => mockClientInstance);

  return {
    Client,
    mockClient: mockClientInstance, // Expose the client instance for testing
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
    },
  };
});
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));
jest.mock('../../src/services/chat');
jest.mock('../../src/commands', () => ({
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test-command' }]),
  handleSlashCommand: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => mockLogger);
jest.mock('../../src/services/web-dashboard', () => ({
  start: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
  setDiscordClient: jest.fn(),
}));

const ConversationManager = require('../../src/utils/conversation');
let conversationManager;
beforeEach(() => {
  conversationManager = new ConversationManager();
  conversationManager.destroy = jest.fn();
});

describe('Bot Initialization', () => {
  let discordMock;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset modules to ensure clean state
    jest.resetModules();

    // Import the discord mock to verify calls
    discordMock = require('discord.js');

    // Import index last after all mocks are set up - this initializes the bot
    require('../../src/index');
  });

  it('should create a Discord client and log in', async () => {
    // Startup is a promise chain with no timers: flush it without a real wait.
    jest.useFakeTimers();
    await jest.advanceTimersByTimeAsync(0);

    expect(discordMock.Client).toHaveBeenCalledTimes(1);
    expect(discordMock.mockClient.login).toHaveBeenCalledTimes(1);
    expect(discordMock.mockClient.login).toHaveBeenCalledWith('test-token');
    expect(mockLogger.info).toHaveBeenCalledWith('Logged in to Discord (test mode)');
  });

  it('should register event handlers', async () => {
    const handleChatMessage = require('../../src/services/chat');
    const commandHandler = require('../../src/commands');
    const client = discordMock.mockClient;
    const handlers = Object.fromEntries(client.on.mock.calls);

    expect(client.once.mock.calls.map(([event]) => event)).toEqual(['clientReady']);
    expect(Object.keys(handlers)).toEqual(['messageCreate', 'interactionCreate', 'error', 'warn']);

    // Chat messages go straight to the chat service.
    expect(handlers.messageCreate).toBe(handleChatMessage);

    // Only chat-input interactions reach the command router.
    const button = { isChatInputCommand: () => false };
    await handlers.interactionCreate(button);
    expect(commandHandler.handleSlashCommand).not.toHaveBeenCalled();
    const slash = { isChatInputCommand: () => true };
    await handlers.interactionCreate(slash);
    expect(commandHandler.handleSlashCommand).toHaveBeenCalledTimes(1);
    expect(commandHandler.handleSlashCommand).toHaveBeenCalledWith(slash);

    // Client errors and warnings are logged, not thrown.
    const clientError = new Error('gateway closed');
    handlers.error(clientError);
    expect(mockLogger.error).toHaveBeenCalledWith('Discord client error:', clientError);
    handlers.warn('heartbeat late');
    expect(mockLogger.warn).toHaveBeenCalledWith('Discord client warning:', 'heartbeat late');
  });
});
