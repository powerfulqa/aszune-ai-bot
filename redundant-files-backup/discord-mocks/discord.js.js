// Mock for discord.js module
const mockClient = {
  on: jest.fn().mockImplementation((event, handler) => {
    if (event === 'ready') {
      handler(); // Auto-trigger ready event for testing
    }
    return mockClient;
  }),
  once: jest.fn().mockImplementation((event, handler) => {
    if (event === 'ready') {
      handler(); // Auto-trigger ready event for testing
    }
    return mockClient;
  }),
  emit: jest.fn(),
  user: { id: 'test-user-id', tag: 'test-user#1234' },
  login: jest.fn().mockResolvedValue('Logged in'),
  destroy: jest.fn().mockResolvedValue()
};

// Mock the Client constructor
const Client = jest.fn(() => mockClient);

// Mock REST API client
const mockRest = {
  setToken: jest.fn().mockReturnThis(),
  put: jest.fn().mockResolvedValue([])
};
const REST = jest.fn(() => mockRest);

// Mock Routes
const Routes = {
  applicationCommands: jest.fn(() => '/application-commands')
};

// Mock Gateway Intents
const GatewayIntentBits = {
  Guilds: 'GUILDS',
  GuildMessages: 'GUILD_MESSAGES',
  MessageContent: 'MESSAGE_CONTENT'
};

// Mock ApplicationCommandOptionType
const ApplicationCommandOptionType = {
  String: 3,
  Integer: 4,
  Boolean: 5,
  User: 6,
  Channel: 7,
  Role: 8,
  Mentionable: 9,
  Number: 10,
  Attachment: 11
};

module.exports = {
  Client,
  REST,
  Routes,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  mockClient // Export for direct access in tests
};
