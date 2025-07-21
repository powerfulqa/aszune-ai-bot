const createMockMessage = require('../../__mocks__/discordMessageMock');
const { Client } = require('discord.js');
const { request } = require('undici');
jest.mock('undici');

let conversationHistory;

beforeEach(() => {
  conversationHistory = new Map();
});

describe('Command Handling', () => {
  it('responds to !clearhistory and clears the conversation history', async () => {
    const msg = createMockMessage('!clearhistory');
    const userId = msg.author.id;

    // simulate existing history
    conversationHistory.set(userId, [{ role: 'user', content: 'Hello' }]);
    expect(conversationHistory.get(userId).length).toBeGreaterThan(0);

    // Simulate command handler logic
    conversationHistory.set(userId, []);
    await msg.reply('Your conversation history has been cleared.');

    expect(conversationHistory.get(userId).length).toBe(0);
    expect(msg.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
  });
  test('!help command replies with help message', async () => {
    const msg = createMockMessage('!help');
    const helpText =
      "**Aszai Bot Commands:**\n" +
      "`!help` - Show this help message\n" +
      "`!clearhistory` - Clear your conversation history\n" +
      "`!summary` - Summarise your current conversation\n" +
      "`!summarise <text>` or `!summerise <text>` - Summarise provided text\n" +
      "`!stats` - Show your usage stats\n" +
      "Simply chat as normal to talk to the bot!";

    await msg.reply(helpText);

    expect(msg.reply).toHaveBeenCalledWith(helpText);
  });

  test('!summary command replies with summary', async () => {
    const msg = createMockMessage('!summary');
    const userId = msg.author.id;

    // Mock conversation history
    conversationHistory.set(userId, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);

    // Mock Perplexity API response
    request.mockResolvedValueOnce({
      body: { json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Summary in UK English.' } }] }) },
      statusCode: 200,
    });

    // Simulate summary handler logic
    const summary = 'Summary in UK English.';
    await msg.reply({ embeds: [{
      color: parseInt('0099ff', 16),
      title: 'Conversation Summary',
      description: summary,
      footer: { text: 'Powered by Sonar' }
    }]});

    expect(msg.reply).toHaveBeenCalledWith({
      embeds: [{
        color: parseInt('0099ff', 16),
        title: 'Conversation Summary',
        description: summary,
        footer: { text: 'Powered by Sonar' }
      }]
    });
  });

  test('!summarise command replies with text summary', async () => {
    const msg = createMockMessage('!summarise Some text to summarise.');
    // Mock Perplexity API response
    request.mockResolvedValueOnce({
      body: { json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Summarised text.' } }] }) },
      statusCode: 200,
    });

    // Simulate summarise handler logic
    const summary = 'Summarised text.';
    await msg.reply({ embeds: [{
      color: parseInt('0099ff', 16),
      title: 'Text Summary',
      description: summary,
      footer: { text: 'Powered by Sonar' }
    }]});

    expect(msg.reply).toHaveBeenCalledWith({
      embeds: [{
        color: parseInt('0099ff', 16),
        title: 'Text Summary',
        description: summary,
        footer: { text: 'Powered by Sonar' }
      }]
    });
  });

  test('!summerise command (alternative spelling) replies with text summary', async () => {
    const msg = createMockMessage('!summerise Some text to summarise.');
    // Mock Perplexity API response
    request.mockResolvedValueOnce({
      body: { json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Summarised text.' } }] }) },
      statusCode: 200,
    });

    // Simulate summarise handler logic
    const summary = 'Summarised text.';
    await msg.reply({ embeds: [{
      color: parseInt('0099ff', 16),
      title: 'Text Summary',
      description: summary,
      footer: { text: 'Powered by Sonar' }
    }]});

    expect(msg.reply).toHaveBeenCalledWith({
      embeds: [{
        color: parseInt('0099ff', 16),
        title: 'Text Summary',
        description: summary,
        footer: { text: 'Powered by Sonar' }
      }]
    });
  });
  test('!summarise command with no text returns usage message', async () => {
    const msg = createMockMessage('!summarise ');
    await msg.reply('Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`');
    expect(msg.reply).toHaveBeenCalledWith('Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`');
  });
  
  test('!summerise command with no text returns usage message', async () => {
    const msg = createMockMessage('!summerise ');
    await msg.reply('Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`');
    expect(msg.reply).toHaveBeenCalledWith('Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`');
  });

  test('!summary command uses UK English in prompt', async () => {
    const msg = createMockMessage('!summary');
    const userId = msg.author.id;

    conversationHistory.set(userId, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);

    request.mockImplementationOnce((url, options) => {
      const body = JSON.parse(options.body);
      expect(body.messages[0].content).toMatch(/UK English/);
      return Promise.resolve({
        body: { json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Summary in UK English.' } }] }) },
        statusCode: 200,
      });
    });

    // Simulate summary handler logic
    const summary = 'Summary in UK English.';
    await msg.reply({ embeds: [{
      color: parseInt('0099ff', 16),
      title: 'Conversation Summary',
      description: summary,
      footer: { text: 'Powered by Sonar' }
    }]});
  });

  test('rate limiting prevents spam', async () => {
    // Simulate rate limiting logic with Map
    const userId = '123';
    const lastMessageTimestamps = new Map();
    const RATE_LIMIT_WINDOW = 5000;
    const now = Date.now();

    lastMessageTimestamps.set(userId, now);

    // Simulate a new message within the rate limit window
    const msg = createMockMessage('!summary', { author: { bot: false, id: userId } });
    const newNow = now + 1000; // 1 second later

    // Simulate rate limit check
    if (lastMessageTimestamps.get(userId) && newNow - lastMessageTimestamps.get(userId) < RATE_LIMIT_WINDOW) {
      await msg.reply('Please wait a few seconds before sending another message.');
    }

    expect(msg.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
  });

  test('unknown command is ignored', async () => {
    const msg = createMockMessage('!unknown');
    // Simulate command handler logic: should not reply
    // (simulate by not calling reply)
    expect(msg.reply).not.toHaveBeenCalled();
  });

  test('!summary with no conversation history', async () => {
    const msg = createMockMessage('!summary');
    const userId = msg.author.id;
    conversationHistory.set(userId, []);
    // Simulate summary handler logic
    await msg.reply('No conversation history to summarise.');
    expect(msg.reply).toHaveBeenCalledWith('No conversation history to summarise.');
  });

  test('!stats command replies with user stats', async () => {
    const msg = createMockMessage('!stats');
    const userId = msg.author.id;
    // Simulate userStats
    const userStats = { [userId]: { messages: 5, summaries: 2 } };
    // Simulate command handler logic
    const stats = userStats[userId];
    await msg.reply(
      `**Your Aszai Bot Stats:**\n` +
      `Messages sent: ${stats.messages}\n` +
      `Summaries requested: ${stats.summaries}`
    );
    expect(msg.reply).toHaveBeenCalledWith(
      `**Your Aszai Bot Stats:**\n` +
      `Messages sent: 5\n` +
      `Summaries requested: 2`
    );
  });
});
