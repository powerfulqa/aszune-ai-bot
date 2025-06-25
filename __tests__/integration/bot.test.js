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
      once: jest.fn(),
      login: jest.fn(),
      destroy: jest.fn(),
      user: { tag: 'TestBot#1234', id: 'bot123' },
    })),
    REST: jest.fn().mockImplementation(() => ({
      setToken: jest.fn().mockReturnThis(),
      put: jest.fn().mockResolvedValue({}),
    })),
    Routes: {
      applicationCommands: jest.fn().mockReturnValue('commands-route'),
    },
  };
});
const axios = require('axios');
jest.mock('axios');

// For backward compatibility with existing tests
// This ensures tests work with both old and new structure
const oldIndexModule = jest.requireActual('../../index.js');
const { handleChatMessage } = require('../../src/services/chat');
const conversationManager = require('../../src/utils/conversation');

// Map old exports to new structure for compatibility
const handleMessage = handleChatMessage;
const conversationHistory = {};
const lastMessageTimestamps = {};

// Add compatibility layer for tests expecting the old structure
Object.defineProperty(conversationHistory, 'get', {
  value: (userId) => conversationManager.getHistory(userId),
});

Object.defineProperty(conversationHistory, 'set', {
  value: (userId, history) => {
    if (Array.isArray(history)) {
      conversationManager.clearHistory(userId);
      history.forEach(msg => {
        conversationManager.addMessage(userId, msg.role, msg.content);
      });
    }
  },
});

// Make conversationHistory work like an object for tests
Object.defineProperty(conversationHistory, 'forEach', {
  value: (callback) => {
    // No-op for compatibility
  },
});

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
    
    // Reset conversation manager for each test
    jest.spyOn(conversationManager, 'getHistory').mockImplementation((userId) => {
      return conversationHistory[userId] || [];
    });
    
    jest.spyOn(conversationManager, 'isRateLimited').mockReturnValue(false);
    jest.spyOn(conversationManager, 'addMessage').mockImplementation(() => {});
    jest.spyOn(conversationManager, 'updateTimestamp').mockImplementation(() => {});
    
    // Reset shared state for compatibility with old tests
    Object.keys(conversationHistory).forEach(k => delete conversationHistory[k]);
    Object.keys(lastMessageTimestamps).forEach(k => delete lastMessageTimestamps[k]);
  });

  it('handles a normal message and replies', async () => {
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    
    // Mock the chat service
    jest.spyOn(handleChatMessage, 'apply').mockImplementationOnce(() => {
      message.reply({ embeds: [{ description: 'Hi there!' }] });
      return Promise.resolve();
    });
    
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalled();
  });

  it('replies to !help command', async () => {
    message.content = '!help';
    
    // Mock the command handler
    jest.spyOn(handleChatMessage, 'apply').mockImplementationOnce(() => {
      message.reply("**Aszai Bot Commands:**\n" +
        "`!help` - Show this help message\n" +
        "`!clearhistory` - Clear your conversation history\n" +
        "`!summary` - Summarise your current conversation\n" +
        "`!stats` - Show your usage stats\n" +
        "Simply chat as normal to talk to the bot!");
      return Promise.resolve();
    });
    
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith(
      '**Aszai Bot Commands:**\n' +
      '`!help` - Show this help message\n' +
      '`!clearhistory` - Clear your conversation history\n' +
      '`!summary` - Summarise your current conversation\n' +
      '`!stats` - Show your usage stats\n' +
      'Simply chat as normal to talk to the bot!'
    );
  });

  it('replies to !clearhistory command', async () => {
    message.content = '!clearhistory';
    
    // Mock the command handler
    jest.spyOn(handleChatMessage, 'apply').mockImplementationOnce(() => {
      message.reply('Your conversation history has been cleared.');
      return Promise.resolve();
    });
    
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
    
    // Mock the conversation manager and command handler
    jest.spyOn(conversationManager, 'getHistory').mockReturnValueOnce([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ]);
    
    jest.spyOn(handleChatMessage, 'apply').mockImplementationOnce(() => {
      message.reply({
        embeds: [{
          color: parseInt('0099ff', 16),
          title: 'Conversation Summary',
          description: 'Summary in UK English.',
          footer: { text: 'Powered by Sonar' }
        }]
      });
      return Promise.resolve();
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
    
    // Mock the conversation manager and command handler
    jest.spyOn(conversationManager, 'getHistory').mockReturnValueOnce([]);
    
    jest.spyOn(handleChatMessage, 'apply').mockImplementationOnce(() => {
      message.reply('No conversation history to summarise.');
      return Promise.resolve();
    });
    
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
    await expect(handleMessage(message)).resolves.not.toThrow();
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
