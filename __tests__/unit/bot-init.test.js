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
    // Verify the client was created and logged in
    expect(discordMock.Client).toHaveBeenCalled();
    expect(discordMock.Client().login).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/Logged in to Discord/));
  });

  it('should register event handlers', () => {
    // Verify that critical event handlers are registered
    expect(discordMock.Client).toHaveBeenCalled();
    const mockClientInstance = discordMock.Client.mock.results[0].value;
    expect(mockClientInstance.once).toHaveBeenCalled();
    expect(mockClientInstance.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    expect(mockClientInstance.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
    expect(mockClientInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
