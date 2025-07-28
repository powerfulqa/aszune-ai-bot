// Jest mock for discord.js
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
    login: jest.fn(),
    destroy: jest.fn(),
    user: { setActivity: jest.fn() },
  })),
  GatewayIntentBits: {},
  Partials: {},
  Events: {},
  REST: jest.fn(),
  Routes: {},
};
