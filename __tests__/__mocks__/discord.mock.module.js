/* istanbul ignore file */
// Jest mock for discord.js - NOT A TEST FILE
class SlashCommandBuilder {
  constructor() {
    this.name = '';
    this.description = '';
  }
  setName(name) {
    this.name = name;
    return this;
  }
  setDescription(description) {
    this.description = description;
    return this;
  }
}

module.exports = {
  SlashCommandBuilder,
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue('login-success'),
    destroy: jest.fn().mockResolvedValue(),
    user: {
      setActivity: jest.fn(),
      tag: 'MockBot#0000',
      id: '123456789',
    },
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3,
  },
  ApplicationCommandOptionType: {
    String: 3,
    Integer: 4,
    Boolean: 5,
    User: 6,
    Channel: 7,
    Role: 8,
    Mentionable: 9,
    Number: 10,
    Attachment: 11,
  },
  Partials: {},
  Events: {},
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue({}),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('application-commands-route'),
  },
};

// Instead of adding tests here, move them to a separate file
// This file is only for mock implementations
