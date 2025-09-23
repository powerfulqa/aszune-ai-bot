// Mock for discord.js module
const EventEmitter = require('events');

class ClientMock extends EventEmitter {
  constructor() {
    super();
    this.user = {
      setActivity: jest.fn(),
      id: 'botUserId',
      tag: 'MockBot#0000',
    };
    this.login = jest.fn().mockResolvedValue('token');
    this.destroy = jest.fn().mockResolvedValue();
  }
}

module.exports = {
  Client: jest.fn(() => new ClientMock()),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
  },
  Collection: class Collection extends Map {},
  Events: {
    ClientReady: 'ready',
    MessageCreate: 'messageCreate',
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue({}),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('application-commands-route'),
  },
};
