// Test file for discord.js mock
const discordMock = require('./discord.mock.module.js');

describe('Discord.js mock', () => {
  test('Client mock exists', () => {
    expect(discordMock.Client).toBeDefined();
  });

  test('Client mock has required methods', () => {
    const client = new discordMock.Client();
    expect(client.on).toBeDefined();
    expect(client.once).toBeDefined();
    expect(client.login).toBeDefined();
    expect(client.destroy).toBeDefined();
  });

  test('SlashCommandBuilder mock exists', () => {
    expect(discordMock.SlashCommandBuilder).toBeDefined();
  });
});
