const baseConfig = {
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  CACHE: {
    CLEANUP_INTERVAL_MS: 300000,
    CLEANUP_INTERVAL_DAYS: 1,
    MAX_AGE_DAYS: 7,
  },
  PI_OPTIMIZATIONS: { ENABLED: false },
  FEATURES: {
    LICENSE_VALIDATION: false,
    LICENSE_SERVER: false,
    LICENSE_ENFORCEMENT: false,
    DEVELOPMENT_MODE: false,
  },
  COLORS: { PRIMARY: '#5865F2' },
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
    },
  },
};

const mockConfigData = { ...baseConfig };
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

let mockClientReadyHandler;
const mockClient = {
  user: {
    id: 'mock-user-id',
    tag: 'MockUser#0000',
    setActivity: jest.fn(),
  },
  login: jest.fn().mockResolvedValue('Logged in'),
  destroy: jest.fn().mockResolvedValue(),
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
};

const originalProcessOn = process.on;
const originalProcessExit = process.exit;
const originalEnv = { ...process.env };

function resetConfig() {
  const previousInitialize = mockConfigData.initializePiOptimizations;
  Object.keys(mockConfigData).forEach((key) => {
    delete mockConfigData[key];
  });
  Object.assign(mockConfigData, JSON.parse(JSON.stringify(baseConfig)));
  mockConfigData.initializePiOptimizations =
    previousInitialize || jest.fn().mockResolvedValue(mockConfigData);
}

function resetMockClient() {
  mockClientReadyHandler = undefined;
  mockClient.on = jest.fn().mockReturnThis();
  mockClient.once = jest.fn((event, handler) => {
    if (event === 'clientReady' || event === 'ready') {
      mockClientReadyHandler = handler;
    }
    return mockClient;
  });
  mockClient.login = jest.fn().mockResolvedValue('Logged in');
  mockClient.destroy = jest.fn().mockResolvedValue();
}

jest.mock('../../src/utils/logger', () => mockLogger);
jest.mock('../../src/config/config', () => mockConfigData);
jest.mock('../../src/utils/enhanced-cache', () => {
  const mockInstance = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
    getDetailedInfo: jest.fn().mockReturnValue({ entries: [], memoryUsage: 0 }),
  };

  const mockClass = jest.fn().mockImplementation(() => mockInstance);
  mockClass.EVICTION_STRATEGIES = {
    LRU: 'LRU',
    LFU: 'LFU',
    TTL: 'TTL',
    SIZE_BASED: 'SIZE_BASED',
    HYBRID: 'HYBRID',
  };

  return mockClass;
});

jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
  generateSummary: jest.fn(),
  getCacheStats: jest.fn(),
  getDetailedCacheInfo: jest.fn(),
  invalidateCacheByTag: jest.fn(),
}));

jest.mock('../../src/services/chat');

jest.mock('../../src/services/reminder-service', () => ({
  initialize: jest.fn().mockResolvedValue(),
  on: jest.fn(),
  shutdown: jest.fn(),
}));

jest.mock('../../src/commands', () => ({
  getSlashCommandsData: jest.fn().mockReturnValue([]),
  handleSlashCommand: jest.fn(),
}));

jest.mock('discord.js', () => ({
  Client: jest.fn(() => mockClient),
  GatewayIntentBits: {
    Guilds: 'mock-guild-intent',
    GuildMessages: 'mock-message-intent',
    MessageContent: 'mock-content-intent',
  },
  REST: jest.fn(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue(),
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('mock-route'),
  },
}));

const ConversationManager = require('../../src/utils/conversation');

function setupIndexContext() {
  jest.resetModules();
  jest.clearAllMocks();
  resetConfig();
  resetMockClient();

  const processHandlers = new Map();
  process.on = jest.fn((event, handler) => {
    processHandlers.set(event, handler);
  });
  process.exit = jest.fn();
  process.env = { ...originalEnv, NODE_ENV: 'test' };

  const conversationManager = new ConversationManager();
  conversationManager.destroy = jest.fn();

  const index = require('../../src/index');
  index.__setLogger && index.__setLogger(mockLogger);
  index.__setClient && index.__setClient(mockClient);

  return {
    index,
    mockClient,
    processHandlers,
    conversationManager,
    getReadyHandler: () => mockClientReadyHandler,
    resetEnv: () => {
      process.env = { ...originalEnv };
    },
    restoreProcess: () => {
      process.on = originalProcessOn;
      process.exit = originalProcessExit;
    },
    loadIndex: () => {
      jest.resetModules();
      resetConfig();
      resetMockClient();
      const reloaded = require('../../src/index');
      reloaded.__setLogger && reloaded.__setLogger(mockLogger);
      reloaded.__setClient && reloaded.__setClient(mockClient);
      return reloaded;
    },
    resetConfig,
    mockConfigData,
    mockLogger,
    loggerMock: mockLogger,
  };
}

module.exports = {
  setupIndexContext,
  mockConfigData,
  loggerMock: mockLogger,
  mockLogger,
};
