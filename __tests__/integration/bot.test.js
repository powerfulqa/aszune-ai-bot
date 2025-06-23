process.env.PERPLEXITY_API_KEY = 'test';
process.env.DISCORD_BOT_TOKEN = 'test';
jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });

const { Client, GatewayIntentBits } = require('discord.js');
jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  return {
    ...actual,
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
    },
    Client: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      login: jest.fn(),
    })),
  };
});
const axios = require('axios');
jest.mock('axios');
const { handleMessage, conversationHistory, lastMessageTimestamps } = require('../../index');

describe('Bot integration', () => {
  let client, message;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    client = new Client({ intents: [GatewayIntentBits.Guilds] });
    message = {
      content: 'hello',
      author: { bot: false, id: '123' },
      reply: jest.fn(),
      react: jest.fn(),
      channel: { sendTyping: jest.fn() }
    };
    // Reset shared state
    Object.keys(conversationHistory).forEach(k => delete conversationHistory[k]);
    Object.keys(lastMessageTimestamps).forEach(k => delete lastMessageTimestamps[k]);
  });

  it('handles a normal message and replies', async () => {
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalled();
  });

  it('replies to !help command', async () => {
    message.content = '!help';
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith(
      '**Aszai Bot Commands:**\n' +
      '`!help` - Show this help message\n' +
      '`!clearhistory` - Clear your conversation history\n' +
      '`!summary` - Summarise your current conversation\n' +
      'Simply chat as normal to talk to the bot!'
    );
  });

  it('replies to !clearhistory command', async () => {
    message.content = '!clearhistory';
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
  });

  it('replies to !summary with history', async () => {
    message.content = '!summary';
    conversationHistory['123'] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Summary in UK English.' } }] }
    });
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith({
      embeds: [{
        color: parseInt('0099ff', 16),
        title: 'Conversation Summary',
        description: 'Summary in UK English.',
        footer: { text: 'Powered by Sonar' }
      }]
    });
  });

  it('replies to !summary with no history', async () => {
    message.content = '!summary';
    conversationHistory['123'] = [];
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('No conversation history to summarise.');
  });

  it('ignores unknown command', async () => {
    message.content = '!foobar';
    await handleMessage(message);
    expect(message.reply).not.toHaveBeenCalled();
  });

  it('handles a normal user message and replies', async () => {
    message.content = 'hello world';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalled();
  });

  it('ignores messages from bots', async () => {
    message.author.bot = true;
    await handleMessage(message);
    expect(message.reply).not.toHaveBeenCalled();
  });

  it('adds emoji reactions for keywords', async () => {
    message.content = 'hello this is awesome';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await handleMessage(message);
    expect(message.react).toHaveBeenCalledWith('👋');
    expect(message.react).toHaveBeenCalledWith('😎');
  });

  it('adds multiple emoji reactions for multiple keywords', async () => {
    message.content = 'happy love sad';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await handleMessage(message);
    const calledEmojis = message.react.mock.calls.map(call => call[0]);
    expect(calledEmojis).toEqual(expect.arrayContaining(['😊', '❤️', '😢']));
    expect(calledEmojis.length).toBe(3);
  });

  it('rate limits user messages', async () => {
    lastMessageTimestamps['123'] = Date.now();
    message.content = 'hello';
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
  });

  it('handles API error when replying', async () => {
    axios.post.mockRejectedValueOnce(new Error('API Error'));
    message.content = 'hello';
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('There was an error processing your request. Please try again later.');
  });

  it('handles API error when summarising', async () => {
    axios.post.mockRejectedValueOnce(new Error('Summary API Error'));
    message.content = '!summary';
    conversationHistory['123'] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('There was an error generating the summary.');
  });

  it('handles empty message gracefully', async () => {
    message.content = '';
    await handleMessage(message);
    expect(message.reply).not.toThrow;
  });

  it('truncates very long conversation history', async () => {
    const MAX_HISTORY = 20;
    conversationHistory['123'] = [];
    for (let i = 0; i < MAX_HISTORY * 3; i++) {
      conversationHistory['123'].push({ role: 'user', content: `msg${i}` });
    }
    message.content = 'hello';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await handleMessage(message);
    expect(conversationHistory['123'].length).toBeLessThanOrEqual(MAX_HISTORY * 2 + 2); // +2 for user+assistant
  });

  it('handles missing environment variables gracefully', () => {
    // Remove env vars before requiring index.js
    const originalEnv = { ...process.env };
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.DISCORD_BOT_TOKEN;
    let exited = false;
    const oldExit = process.exit;
    process.exit = () => { exited = true; throw new Error('exit'); };
    jest.resetModules();
    try {
      require('../../index.js');
    } catch (e) {
      // expected
    }
    process.exit = oldExit;
    process.env = originalEnv;
    expect(exited).toBe(true);
  });

  // Add more tests for other behaviors as needed
});
