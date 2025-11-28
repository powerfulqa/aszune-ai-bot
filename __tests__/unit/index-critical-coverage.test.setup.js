const originalProcessOn = process.on;
const originalProcessExit = process.exit;
const originalEnv = { ...process.env };

const createMocks = () => {
  const freshMockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockClient = {
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue(),
    destroy: jest.fn().mockResolvedValue(),
    user: { tag: 'TestBot#0000', id: '123456789' },
  };

  const mockRest = {
    put: jest.fn().mockResolvedValue(),
    setToken: jest.fn().mockReturnThis(),
  };

  const mockConversationManager = {
    initializeIntervals: jest.fn(),
    destroy: jest.fn().mockResolvedValue(),
  };

  const mockMemoryMonitor = { initialize: jest.fn() };
  const mockPerformanceMonitor = { initialize: jest.fn() };

  return {
    freshMockLogger,
    mockClient,
    mockRest,
    mockConversationManager,
    mockMemoryMonitor,
    mockPerformanceMonitor,
  };
};

function setupIndexCriticalMocks() {
  jest.resetModules();
  jest.clearAllMocks();

  const {
    freshMockLogger,
    mockClient,
    mockRest,
    mockConversationManager,
    mockMemoryMonitor,
    mockPerformanceMonitor,
  } = createMocks();

  jest.doMock('../../src/utils/logger', () => freshMockLogger);
  jest.doMock('../../src/config/config', () => ({
    DISCORD_BOT_TOKEN: 'test-token',
    PERPLEXITY_API_KEY: 'test-key',
    PI_OPTIMIZATIONS: {
      ENABLED: true,
      CLEANUP_INTERVAL_MINUTES: 5,
    },
    CACHE: {
      CLEANUP_INTERVAL_MS: 300000,
    },
    API: {
      PERPLEXITY: {
        BASE_URL: 'https://api.perplexity.ai',
        ENDPOINTS: {
          CHAT_COMPLETIONS: '/chat/completions',
        },
      },
    },
    FILE_PERMISSIONS: {
      FILE: 0o644,
      DIRECTORY: 0o755,
    },
    initializePiOptimizations: jest.fn().mockResolvedValue(),
  }));

  jest.doMock('discord.js', () => ({
    Client: jest.fn(() => mockClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
    },
    REST: jest.fn(() => mockRest),
    Routes: {
      applicationCommands: jest.fn(() => 'applications/123456789/commands'),
    },
  }));

  jest.doMock('../../src/services/chat', () => jest.fn());
  jest.doMock('../../src/commands', () => ({
    getSlashCommandsData: jest.fn(() => [
      { name: 'help', description: 'Show help' },
      { name: 'stats', description: 'Show stats' },
    ]),
    handleSlashCommand: jest.fn(),
  }));
  jest.doMock('../../src/utils/conversation', () => jest.fn(() => mockConversationManager));
  jest.doMock('../../src/utils/lazy-loader', () => ({
    lazyLoad: jest.fn((fn) => fn),
  }));
  jest.doMock('../../src/utils/memory-monitor', () => mockMemoryMonitor);
  jest.doMock('../../src/utils/performance-monitor', () => mockPerformanceMonitor);
  jest.doMock('../../src/services/web-dashboard', () => ({
    start: jest.fn().mockResolvedValue(),
    stop: jest.fn().mockResolvedValue(),
    setDiscordClient: jest.fn(),
  }));

  process.on = jest.fn();
  process.exit = jest.fn();

  return {
    freshMockLogger,
    mockClient,
    mockRest,
    mockConversationManager,
    mockMemoryMonitor,
    mockPerformanceMonitor,
    loadIndex: () => require('../../src/index'),
    resetEnv: () => {
      process.env = { ...originalEnv };
    },
    restoreProcess: () => {
      process.on = originalProcessOn;
      process.exit = originalProcessExit;
    },
  };
}

module.exports = {
  setupIndexCriticalMocks,
};

describe('Index critical coverage setup', () => {
  it('exposes the setup helper', () => {
    expect(typeof setupIndexCriticalMocks).toBe('function');
  });
});