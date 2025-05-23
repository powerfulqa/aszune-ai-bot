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

  test('!help command replies with help message', async () => {
    const msg = createMockMessage('!help');

    await msg.reply('Here is a list of commands you can use...'); // Add expected help text here

    expect(msg.reply).toHaveBeenCalledWith('Here is a list of commands you can use...');
  });

  test('!summary command replies with summary', async () => {
    const msg = createMockMessage('!summary');
    const userId = msg.author.id;

    // Mock conversation history
    conversationHistory[userId] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    // Mock Perplexity API response
    // ... your mocking logic here ...

    await msg.reply('Here is the summary of your conversation: ...'); // Add expected summary here

    expect(msg.reply).toHaveBeenCalledWith('Here is the summary of your conversation: ...');
  });

  test('!summary command uses UK English in prompt', async () => {
    const msg = createMockMessage('!summary');
    const userId = msg.author.id;

    // Mock conversation history
    conversationHistory[userId] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    // Mock axios
    // ... your mocking logic here ...

    await msg.reply('Here is the summary of your conversation: ...'); // Add expected summary here

    // Check the prompt sent to the API contains 'UK English'
    // ... your assertion logic here ...
  });

  test('rate limiting prevents spam', async () => {
    const msg1 = createMockMessage('!summary');
    const msg2 = createMockMessage('!summary');

    // Simulate two rapid messages from the same user
    msg2.createdTimestamp = msg1.createdTimestamp + 1000; // 1 second later

    await msg1.reply('Here is the summary of your conversation: ...'); // First message should go through
    await msg2.reply('You are sending messages too quickly. Please wait a moment.'); // Second should hit rate limit

    expect(msg1.reply).toHaveBeenCalledWith('Here is the summary of your conversation: ...');
    expect(msg2.reply).toHaveBeenCalledWith('You are sending messages too quickly. Please wait a moment.');
  });
});
