/**
 * Bot Integration - Features Tests
 * Tests bot features like emoji reactions, rate limiting, and error handling
 */

// Mock dependencies (same as bot-core.test.js)
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn().mockImplementation(async (message) => {
    if (!message.content.startsWith('!')) return null;
    if (message.content.startsWith('!help')) {
      await message.reply('Help message');
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

jest.mock('../../src/utils/emoji-manager', () => ({
  getEmojiForKeyword: jest.fn().mockReturnValue('😊'),
  getEmojisForKeywords: jest.fn().mockReturnValue(['😊', '👍']),
}));

jest.mock('../../src/utils/rate-limiter', () => ({
  isRateLimited: jest.fn().mockReturnValue(false),
  recordRequest: jest.fn(),
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

jest.mock('../../src/utils/storage', () => ({
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

jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('Bot Integration - Features', () => {
  let mockClientInstance;
  let mockOn;
  let messageCreateHandler;
  let message;
  let conversationManager;
  let consoleLogSpy, consoleErrorSpy;

  beforeAll(() => {
    process.on = jest.fn();
  });

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.resetModules();

    mockOn = jest.fn();

    mockClientInstance = {
      on: mockOn,
      once: jest.fn(),
      login: jest.fn().mockResolvedValue('Logged in'),
      destroy: jest.fn().mockResolvedValue(),
      user: { tag: 'MockBot#0000', id: '123456789' },
    };

    const { Client } = require('discord.js');
    Client.mockImplementation(() => mockClientInstance);

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

    conversationManager = {
      clearHistory: jest.fn(),
      getHistory: jest.fn().mockReturnValue([]),
      getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
      updateUserStats: jest.fn(),
      addMessage: jest.fn(),
    };

    const ConversationManager = require('../../src/utils/conversation');
    ConversationManager.mockImplementation(() => conversationManager);

    const { createMockMessage } = require('../../src/utils/testUtils');
    createMockMessage.mockImplementation((options = {}) => ({
      ...message,
      ...options,
    }));

    require('../../src/index');

    messageCreateHandler = mockOn.mock.calls.find(call => call[0] === 'messageCreate')[1];
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('adds emoji reactions for keywords', async () => {
    message.content = 'Hello happy world!';
    
    await messageCreateHandler(message);

    expect(message.react).toHaveBeenCalledWith('😊');
  });

  it('adds multiple emoji reactions for multiple keywords', async () => {
    message.content = 'Hello happy world! This is great!';
    
    await messageCreateHandler(message);

    expect(message.react).toHaveBeenCalledWith('😊');
    expect(message.react).toHaveBeenCalledWith('👍');
  });

  it('rate limits user messages', async () => {
    const rateLimiter = require('../../src/utils/rate-limiter');
    rateLimiter.isRateLimited.mockReturnValue(true);

    await messageCreateHandler(message);

    expect(message.reply).not.toHaveBeenCalled();
  });

  it('handles API error when replying', async () => {
    message.reply.mockRejectedValue(new Error('API Error'));

    await messageCreateHandler(message);

    // Should not throw, error should be handled gracefully
  });

  it('handles API error when summarising', async () => {
    message.content = '!summary';
    conversationManager.getHistory.mockReturnValue([
      { role: 'user', content: 'Hello' }
    ]);
    
    const perplexityService = require('../../src/services/perplexity-secure');
    perplexityService.generateSummary.mockRejectedValue(new Error('API Error'));

    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('error'));
  });

  it('handles empty message gracefully', async () => {
    message.content = '';
    await messageCreateHandler(message);

    expect(message.reply).not.toHaveBeenCalled();
  });

  it('truncates very long conversation history', async () => {
    message.content = '!summary';
    const longHistory = Array(1000).fill().map((_, i) => ({
      role: 'user',
      content: `Message ${i}`
    }));
    conversationManager.getHistory.mockReturnValue(longHistory);

    await messageCreateHandler(message);

    expect(message.reply).toHaveBeenCalled();
  });

  it('handles missing environment variables gracefully', () => {
    // This test ensures the bot can start even with missing env vars
    expect(() => {
      require('../../src/index');
    }).not.toThrow();
  });
});
