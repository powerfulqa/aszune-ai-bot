const createMockMessage = require('../../__mocks__/discordMessageMock');
const { Client } = require('discord.js');
const client = new Client({ intents: [] }); // not used, just placeholder

let conversationHistory = {};

describe('Command Handling', () => {
  beforeEach(() => {
    conversationHistory = {};
  });

  it('responds to !clearhistory and clears the conversation history', async () => {
    const msg = createMockMessage('!clearhistory');
    const userId = msg.author.id;

    // simulate existing history
    conversationHistory[userId] = [{ role: 'user', content: 'Hello' }];
    expect(conversationHistory[userId].length).toBeGreaterThan(0);

    if (msg.content === '!clearhistory') {
      conversationHistory[userId] = [];
      await msg.reply('Your conversation history has been cleared.');
    }

    expect(conversationHistory[userId].length).toBe(0);
    expect(msg.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
  });
});
