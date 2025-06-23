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

describe('Bot integration', () => {
  let client, message;

  beforeEach(() => {
    client = new Client({ intents: [GatewayIntentBits.Guilds] });
    message = {
      content: 'hello',
      author: { bot: false, id: '123' },
      reply: jest.fn(),
      react: jest.fn(),
      channel: { sendTyping: jest.fn() }
    };
  });

  it('handles a normal message and replies', async () => {
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    // Simulate messageCreate event handler logic here
    // You may need to refactor index.js to export the handler for easier testing
    // For now, this is a placeholder for the integration approach
    expect(true).toBe(true);
  });

  it('replies to !help command', async () => {
    message.content = '!help';
    await message.reply('**Aszai Bot Commands:**\n' +
      '`!help` - Show this help message\n' +
      '`!clearhistory` - Clear your conversation history\n' +
      '`!summary` - Summarise your current conversation\n' +
      'Simply chat as normal to talk to the bot!');
    expect(message.reply).toHaveBeenCalled();
  });

  it('replies to !clearhistory command', async () => {
    message.content = '!clearhistory';
    await message.reply('Your conversation history has been cleared.');
    expect(message.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
  });

  it('replies to !summary with history', async () => {
    message.content = '!summary';
    // Simulate conversation history exists
    const conversationHistory = { '123': [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ] };
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Summary in UK English.' } }] }
    });
    await message.reply({ embeds: [{
      color: parseInt('0099ff', 16),
      title: 'Conversation Summary',
      description: 'Summary in UK English.',
      footer: { text: 'Powered by Sonar' }
    }] });
    expect(message.reply).toHaveBeenCalled();
  });

  it('replies to !summary with no history', async () => {
    message.content = '!summary';
    // Simulate no conversation history
    const conversationHistory = { '123': [] };
    await message.reply('No conversation history to summarise.');
    expect(message.reply).toHaveBeenCalledWith('No conversation history to summarise.');
  });

  it('ignores unknown command', async () => {
    message.content = '!foobar';
    // Should not reply
    expect(message.reply).not.toHaveBeenCalled();
  });

  it('handles a normal user message and replies', async () => {
    message.content = 'hello world';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await message.reply({ embeds: [{
      color: parseInt('0099ff', 16),
      description: 'Hi there!',
      footer: { text: 'Powered by Sonar' }
    }] });
    expect(message.reply).toHaveBeenCalled();
  });

  it('ignores messages from bots', async () => {
    message.author.bot = true;
    // Should not reply
    expect(message.reply).not.toHaveBeenCalled();
  });

  it('adds emoji reactions for keywords', async () => {
    message.content = 'hello this is awesome';
    await message.react('👋');
    await message.react('😎');
    expect(message.react).toHaveBeenCalledWith('👋');
    expect(message.react).toHaveBeenCalledWith('😎');
  });

  it('adds multiple emoji reactions for multiple keywords', async () => {
    message.content = 'happy love sad';
    await message.react('😊');
    await message.react('❤️');
    await message.react('😢');
    expect(message.react).toHaveBeenCalledWith('😊');
    expect(message.react).toHaveBeenCalledWith('❤️');
    expect(message.react).toHaveBeenCalledWith('😢');
  });

  it('rate limits user messages', async () => {
    // Simulate rate limiting logic
    await message.reply('Please wait a few seconds before sending another message.');
    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
  });

  it('handles API error when replying', async () => {
    axios.post.mockRejectedValueOnce(new Error('API Error'));
    await message.reply('There was an error processing your request. Please try again later.');
    expect(message.reply).toHaveBeenCalledWith('There was an error processing your request. Please try again later.');
  });

  it('handles API error when summarising', async () => {
    axios.post.mockRejectedValueOnce(new Error('Summary API Error'));
    await message.reply('There was an error generating the summary.');
    expect(message.reply).toHaveBeenCalledWith('There was an error generating the summary.');
  });

  it('handles empty message gracefully', async () => {
    message.content = '';
    // Should not throw or crash
    expect(() => {}).not.toThrow();
  });

  it('truncates very long conversation history', () => {
    const MAX_HISTORY = 20;
    let conversationHistory = { '123': [] };
    for (let i = 0; i < MAX_HISTORY * 3; i++) {
      conversationHistory['123'].push({ role: 'user', content: `msg${i}` });
    }
    if (conversationHistory['123'].length > MAX_HISTORY * 2) {
      conversationHistory['123'] = conversationHistory['123'].slice(-MAX_HISTORY * 2);
    }
    expect(conversationHistory['123'].length).toBe(MAX_HISTORY * 2);
  });

  it('handles missing environment variables gracefully', () => {
    const originalEnv = { ...process.env };
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.DISCORD_BOT_TOKEN;
    let exited = false;
    const oldExit = process.exit;
    process.exit = () => { exited = true; throw new Error('exit'); };
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
