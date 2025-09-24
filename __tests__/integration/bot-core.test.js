/**
 * Bot Integration - Core Tests
 * Tests basic bot functionality and message handling
 */

// Mock dependencies
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn().mockImplementation(async (message) => {
    // Mock implementation that simulates command handling
    if (!message.content.startsWith('!')) return null;

    if (message.content.startsWith('!help')) {
      const helpReply =
        '**Aszai Bot Commands:**\n' +
        '`/help` or `!help` - Show this help message\n' +
        '`/clearhistory` or `!clearhistory` - Clear your conversation history\n' +
        '`/summary` or `!summary` - Summarise your current conversation\n' +
        '`/stats` or `!stats` - Show your usage statistics\n' +
        '`/summarise <text>` or `!summarise <text>` - Summarise provided text\n' +
        '`/summerise <text>` or `!summerise <text>` - Alternative spelling for summarise\n\n' +
        '**How to use:**\n' +
        '• Use `/` commands in any channel\n' +
        '• Use `!` commands in DMs or by mentioning the bot\n' +
        '• The bot will respond to your messages and commands\n' +
        '• Use `!clearhistory` to start fresh conversations\n\n' +
        '**Features:**\n' +
        '• Intelligent conversation tracking\n' +
        '• Automatic message summarization\n' +
        '• Usage statistics\n' +
        '• Rate limiting for fair usage\n' +
        '• Emoji reactions for keywords\n\n' +
        '**Need help?** Contact the bot administrator.';
      await message.reply(helpReply);
      return true;
    }

    if (message.content.startsWith('!clearhistory')) {
      await message.reply('Conversation history cleared!');
      return true;
    }

    if (message.content.startsWith('!summary')) {
      await message.reply('Here is a summary of your conversation...');
      return true;
    }

    if (message.content.startsWith('!stats')) {
      await message.reply('Your usage statistics: Messages: 10, Summaries: 2');
      return true;
    }

    if (message.content.startsWith('!summarise') || message.content.startsWith('!summerise')) {
      const text = message.content.split(' ').slice(1).join(' ');
      if (!text.trim()) {
        await message.reply('Please provide text to summarize.');
        return true;
      }
      await message.reply(`Summary of "${text}": This is a summary...`);
      return true;
    }

    return null;
  }),
  handleSlashCommand: jest.fn(),
}));

jest.mock('../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
  };

  return jest.fn().mockImplementation(() => mockInstance);
});

jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn().mockResolvedValue('Mock response'),
  generateSummary: jest.fn().mockResolvedValue('Mock summary'),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/utils/emoji', () => ({
  getEmojiForKeyword: jest.fn().mockReturnValue('😊'),
  getEmojisForKeywords: jest.fn().mockReturnValue(['😊', '👍']),
}));

jest.mock('../../src/utils/conversation', () => ({
  isRateLimited: jest.fn().mockReturnValue(false),
  addMessage: jest.fn(),
  getHistory: jest.fn().mockReturnValue([]),
}));

jest.mock('../../src/utils/message-formatter', () => ({
  formatResponse: jest.fn().mockImplementation((text) => text),
}));

jest.mock('../../src/utils/enhanced-cache', () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
}));

jest.mock('../../src/utils/connection-throttler', () => ({
  shouldThrottle: jest.fn().mockReturnValue(false),
  recordRequest: jest.fn(),
}));

jest.mock('../../src/utils/performance-monitor', () => ({
  recordMetric: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({}),
}));

jest.mock('../../src/utils/pi-detector', () => ({
  isRunningOnPi: jest.fn().mockReturnValue(false),
}));

jest.mock('../../src/utils/memory-monitor', () => ({
  getMemoryUsage: jest.fn().mockReturnValue({
    heapUsed: 50 * 1024 * 1024,
    heapUsedPercent: 25,
  }),
  getStatus: jest.fn().mockReturnValue({
    initialized: true,
    isLowMemory: false,
  }),
}));

jest.mock('../../src/utils/cache-pruner', () => ({
  pruneCache: jest.fn(),
}));

jest.mock('../../src/utils/debouncer', () => ({
  debounce: jest.fn().mockImplementation((fn) => fn),
}));

jest.mock('../../src/utils/lazy-loader', () => ({
  loadModule: jest.fn().mockImplementation((moduleName) => require(moduleName)),
}));

jest.mock('../../src/utils/input-validator', () => ({
  InputValidator: {
    validateUserId: jest.fn().mockReturnValue({ valid: true }),
    validateInput: jest.fn().mockReturnValue({ valid: true }),
    sanitizeInput: jest.fn().mockImplementation((input) => input),
  },
}));

jest.mock('../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn(),
  },
}));

jest.mock('../../src/services/storage', () => ({
  saveData: jest.fn(),
  loadData: jest.fn().mockReturnValue({}),
}));

jest.mock('../../src/utils/testUtils', () => ({
  createMockMessage: jest.fn(),
  createMockInteraction: jest.fn(),
  resetMocks: jest.fn(),
}));

jest.mock('../../src/config/config', () => ({
  DISCORD_BOT_TOKEN: 'test-token',
  PI_OPTIMIZATIONS: { ENABLED: false },
  initializePiOptimizations: jest.fn(),
}));

jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue(),
    destroy: jest.fn().mockResolvedValue(),
    user: { tag: 'MockBot#0000', id: '123456789' },
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3,
  },
  REST: jest.fn(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue(),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route'),
  },
}));

// Mock process.exit to track if it's called
jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('Bot Integration - Core', () => {
  let mockClientInstance;
  let mockOn;
  let mockOnce;
  let mockLogin;
  let mockDestroy;
  let messageCreateHandler;
  let message;
  let conversation;
  let conversationManager;
  let consoleLogSpy, consoleErrorSpy;

  beforeAll(() => {
    // Mock process.on to prevent MaxListenersExceededWarning
    process.on = jest.fn();
  });

  beforeEach(() => {
    // Suppress console output for cleaner test results
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.resetModules();

    mockOn = jest.fn();
    mockOnce = jest.fn();
    mockLogin = jest.fn().mockResolvedValue('Logged in');
    mockDestroy = jest.fn().mockResolvedValue();

    // Create mock client instance
    mockClientInstance = {
      on: mockOn,
      once: mockOnce,
      login: mockLogin,
      destroy: mockDestroy,
      user: { tag: 'MockBot#0000', id: '123456789' },
    };

    // Mock Discord.js Client constructor
    const { Client } = require('discord.js');
    Client.mockImplementation(() => mockClientInstance);

    // Mock axios
    const axios = require('axios');
    axios.get = jest.fn().mockResolvedValue({ data: 'Mock data' });
    axios.post = jest.fn().mockResolvedValue({ data: 'Mock response' });

    // Create mock message
    message = {
      content: 'Hello bot!',
      author: {
        id: '123456789012345678',
        bot: false,
        tag: 'TestUser#1234',
      },
      channel: {
        id: '987654321098765432',
        sendTyping: jest.fn(),
      },
      reply: jest.fn().mockResolvedValue({}),
      react: jest.fn().mockResolvedValue({}),
    };

    // Create mock conversation manager
    conversationManager = {
      clearHistory: jest.fn(),
      getHistory: jest.fn().mockReturnValue([]),
      getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
      updateUserStats: jest.fn(),
      addMessage: jest.fn(),
    };

    // Mock conversation manager constructor
    const ConversationManager = require('../../src/utils/conversation');
    ConversationManager.mockImplementation(() => conversationManager);

    // Mock testUtils
    const { createMockMessage } = require('../../src/utils/testUtils');
    createMockMessage.mockImplementation((options = {}) => ({
      ...message,
      ...options,
    }));

    // Load the bot module
    require('../../src/index');

    // Get the messageCreate handler
    messageCreateHandler = mockOn.mock.calls.find(call => call[0] === 'messageCreate')[1];
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should have attached the messageCreate handler', () => {
    expect(mockOn).toHaveBeenCalledWith('messageCreate', expect.any(Function));
  });

  it('handles a normal message and replies', async () => {
    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalled();
  });

  it('replies to !help command', async () => {
    message.content = '!help';
    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('Commands'));
  });

  it('replies to !clearhistory command', async () => {
    message.content = '!clearhistory';
    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalledWith('Conversation history cleared!');
  });

  it('replies to !summary with history', async () => {
    message.content = '!summary';
    conversationManager.getHistory.mockReturnValue([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ]);

    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('summary'));
  });

  it('replies to !summary with no history', async () => {
    message.content = '!summary';
    conversationManager.getHistory.mockReturnValue([]);

    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalledWith('No conversation history to summarize.');
  });

  it('ignores unknown command', async () => {
    message.content = '!unknown';
    await messageCreateHandler(message);

    expect(message.reply).not.toHaveBeenCalled();
  });

  it('ignores messages from bots', async () => {
    message.author.bot = true;
    await messageCreateHandler(message);

    expect(message.reply).not.toHaveBeenCalled();
  });
});
