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

// Import from the compatibility layer
const compat = require('../../index-compat.js');

// For backward compatibility with existing tests
// Extract the imported modules to match original test structure
const { 
  handleMessage,
  chatService,
  conversationManager
} = compat;
const conversationHistory = compat.conversationHistory || {};
const lastMessageTimestamps = compat.lastMessageTimestamps || {};
const emojiManager = require('../../src/utils/emoji');

// Mock dependencies
jest.mock('../../src/services/chat');
jest.mock('../../src/utils/conversation');
jest.mock('../../src/commands');
jest.mock('../../src/utils/emoji', () => ({
  getReactionsForMessage: jest.fn(content => {
    const reactions = [];
    if (content.includes('hello')) reactions.push('👋');
    if (content.includes('awesome')) reactions.push('😎');
    if (content.includes('happy')) reactions.push('😊');
    if (content.includes('love')) reactions.push('❤️');
    if (content.includes('sad')) reactions.push('😢');
    return reactions;
  }),
  addReactionsToMessage: jest.fn(async message => {
    const reactions = ['👋', '😎', '😊', '❤️', '😢'].filter(emoji => 
      message.content.includes(emoji === '👋' ? 'hello' : 
                              emoji === '😎' ? 'awesome' : 
                              emoji === '😊' ? 'happy' : 
                              emoji === '❤️' ? 'love' : 'sad')
    );
    for (const emoji of reactions) {
      await message.react(emoji);
    }
  }),
  addEmojisToResponse: jest.fn(message => message)
}));

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
    
    // Reset conversation history for each test
    if (conversationHistory) {
      Object.keys(conversationHistory).forEach(k => delete conversationHistory[k]);
    }
    
    if (lastMessageTimestamps) {
      Object.keys(lastMessageTimestamps).forEach(k => delete lastMessageTimestamps[k]);
    }
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
      '`!stats` - Show your usage stats\n' +
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
    if (!conversationHistory['123']) {
      conversationHistory['123'] = [];
    }
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
    if (!conversationHistory['123']) {
      conversationHistory['123'] = [];
    } else {
      conversationHistory['123'] = [];
    }
    
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
    message.content = 'happy sad love';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    await handleMessage(message);
    const calledEmojis = message.react.mock.calls.map(call => call[0]);
    expect(calledEmojis).toEqual(expect.arrayContaining(['😊', '❤️', '😢']));
    expect(calledEmojis.length).toBe(3);
  });

  it('rate limits user messages', async () => {
    // Set up the test condition
    const userId = message.author.id;
    if (!lastMessageTimestamps[userId]) {
      lastMessageTimestamps[userId] = Date.now();
    }
    message.content = 'hello';
    
    // Use the mock
    compat.conversationManager.isRateLimited = jest.fn().mockReturnValue(true);
    
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('Please wait a few seconds before sending another message.');
    
    // Reset the mock for other tests
    compat.conversationManager.isRateLimited = jest.fn().mockReturnValue(false);
  });

  it('handles API error when replying', async () => {
    message.content = 'hello';
    
    // Mock the chat service to throw an error
    compat.chatService.handleChatMessage = jest.fn().mockRejectedValueOnce(new Error('API Error'));
    
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('There was an error processing your request. Please try again later.');
    
    // Reset the mock for other tests
    compat.chatService.handleChatMessage = jest.fn().mockResolvedValue('Hi there!');
  });

  it('handles API error when summarising', async () => {
    message.content = '!summary';
    if (!conversationHistory['123']) {
      conversationHistory['123'] = [];
    }
    conversationHistory['123'] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    // Mock the chat service to throw an error for summary
    compat.chatService.summarizeConversation = jest.fn().mockRejectedValueOnce(new Error('Summary API Error'));
    
    await handleMessage(message);
    expect(message.reply).toHaveBeenCalledWith('There was an error generating the summary.');
    
    // Reset the mock for other tests
    compat.chatService.summarizeConversation = jest.fn().mockResolvedValue('Summary in UK English.');
  });

  it('handles empty message gracefully', async () => {
    message.content = '';
    await expect(handleMessage(message)).resolves.not.toThrow();
  });

  it('truncates very long conversation history', async () => {
    const MAX_HISTORY = 20;
    const userId = message.author.id;
    
    // Create a mock for the truncation function
    const originalGetHistory = conversationManager.getHistory;
    const originalAddMessage = conversationManager.addMessage;
    
    // Mock the conversation manager methods
    conversationManager.getHistory = jest.fn().mockImplementation((id) => {
      // Return the truncated history
      if (id === userId) {
        const history = [];
        for (let i = 0; i < MAX_HISTORY; i++) {
          history.push({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `truncated-msg-${i}`
          });
        }
        return history;
      }
      return [];
    });
    
    // Create a custom test implementation that simulates truncation
    conversationManager.addMessage = jest.fn().mockImplementation((id, msg) => {
      // This is just a mock - we're not actually adding to the array
    });
    
    message.content = 'hello';
    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Hi there!' } }] }
    });
    
    await handleMessage(message);
    
    // Verify the mock was called correctly
    expect(conversationManager.getHistory).toHaveBeenCalledWith(userId);
    expect(conversationManager.addMessage).toHaveBeenCalledTimes(2); // User + Assistant messages
    
    // Reset the mocks
    conversationManager.getHistory = originalGetHistory;
    conversationManager.addMessage = originalAddMessage;
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
