const {
  Client: _Client,
  GatewayIntentBits: _GatewayIntentBits,
  REST: _REST,
  Routes: _Routes,
} = require('discord.js');

// Mock dependencies
jest.mock('discord.js', () => ({
  Client: jest.fn(),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 32768,
  },
  REST: jest.fn(),
  Routes: {
    applicationCommands: jest.fn(),
  },
}));

// We don't mock logger at top level because we want to re-require it
// jest.mock('../../src/utils/logger');

describe('Index Uncovered Paths', () => {
  let index;
  let mockClient;
  let logger;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup config mock
    mockConfig = {
      DISCORD_BOT_TOKEN: 'test-token',
      FEATURES: {
        DEVELOPMENT_MODE: false,
      },
      PI_OPTIMIZATIONS: {
        ENABLED: false,
      },
    };

    jest.doMock('../../src/config/config', () => mockConfig);

    // Setup logger mock
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    jest.doMock('../../src/utils/logger', () => mockLogger);
    logger = require('../../src/utils/logger');

    // Setup other mocks
    jest.doMock('../../src/services/chat', () => jest.fn());
    jest.doMock('../../src/commands', () => ({
      getSlashCommandsData: jest.fn().mockReturnValue([]),
      handleSlashCommand: jest.fn(),
    }));
    jest.doMock('../../src/utils/conversation', () => {
      return jest.fn().mockImplementation(() => ({
        initializeIntervals: jest.fn(),
        destroy: jest.fn().mockResolvedValue(true),
      }));
    });
    jest.doMock('../../src/services/reminder-service', () => ({
      on: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn(),
    }));
    jest.doMock('../../src/services/database', () => ({
      logBotEvent: jest.fn(),
    }));
    jest.doMock('../../src/services/web-dashboard', () => ({
      start: jest.fn().mockResolvedValue(true),
      stop: jest.fn().mockResolvedValue(true),
      setDiscordClient: jest.fn(),
    }));
    jest.doMock('../../src/utils/lazy-loader', () => ({
      lazyLoad: jest.fn().mockReturnValue(() => ({ initialize: jest.fn() })),
    }));

    mockClient = {
      on: jest.fn(),
      once: jest.fn(),
      login: jest.fn().mockResolvedValue('token'),
      destroy: jest.fn().mockResolvedValue(true),
      user: { id: '123', tag: 'Bot#1234' },
      channels: {
        fetch: jest.fn(),
      },
    };

    require('discord.js').Client.mockImplementation(() => mockClient);

    // Load index
    index = require('../../src/index');
  });

  describe('reminderDue listener', () => {
    const reminder = {
      id: 5,
      user_id: '42',
      channel_id: '99',
      message: 'Raid starts',
      created_at: '2026-11-10T10:00:00.000Z',
    };
    const getListener = () => {
      const reminderService = require('../../src/services/reminder-service');
      return reminderService.on.mock.calls.find(([event]) => event === 'reminderDue')[1];
    };

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-11-11T10:00:00.000Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('sends the reminder with a mention of its owner', async () => {
      const channel = { send: jest.fn().mockResolvedValue({}) };
      mockClient.channels.fetch.mockResolvedValue(channel);

      await getListener()(reminder);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('99');
      expect(channel.send).toHaveBeenCalledWith({
        content: '<@42>',
        embeds: [
          {
            color: 0x00ff00,
            title: '⏰ Reminder!',
            description: 'Raid starts',
            footer: {
              text: `Reminder set ${new Date(reminder.created_at).toLocaleDateString()} • Aszai Bot`,
            },
            timestamp: '2026-11-11T10:00:00.000Z',
          },
        ],
      });
    });

    it('rejects when the send fails, so the reminder service retries', async () => {
      const channel = { send: jest.fn().mockRejectedValue(new Error('Discord unavailable')) };
      mockClient.channels.fetch.mockResolvedValue(channel);

      await expect(getListener()(reminder)).rejects.toThrow('Discord unavailable');
    });

    it('rejects with a permanent error when the channel does not exist', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      const error = await getListener()(reminder).catch((e) => e);

      expect(error.message).toBe('Could not find channel 99');
      expect(error.permanent).toBe(true);
    });
  });

  describe('registerSlashCommands', () => {
    it('should handle client not ready', async () => {
      mockClient.user = null;
      await index.registerSlashCommands();
      expect(logger.error).toHaveBeenCalledWith('Cannot register slash commands: Client not ready');
    });

    it('should handle registration error', async () => {
      const REST = require('discord.js').REST;
      const mockPut = jest.fn().mockRejectedValue(new Error('REST Error'));
      REST.mockImplementation(() => ({
        setToken: jest.fn().mockReturnThis(),
        put: mockPut,
      }));

      await index.registerSlashCommands();

      expect(logger.error).toHaveBeenCalledWith(
        'Error registering slash commands:',
        expect.any(Error)
      );
    });
  });

  describe('Shutdown Handling', () => {
    it('should handle shutdown errors gracefully', async () => {
      const webDashboardService = require('../../src/services/web-dashboard');
      webDashboardService.stop.mockRejectedValue(new Error('Dashboard Stop Error'));

      // Mock process.exit to prevent actual exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await index.shutdown('SIGINT');

      expect(logger.error).toHaveBeenCalledWith(
        'Error shutting down web dashboard service:',
        expect.any(Error)
      );
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Shutdown completed with'));

      exitSpy.mockRestore();
    });

    it('should ignore duplicate shutdown signals', async () => {
      // First call
      const p1 = index.shutdown('SIGINT');
      // Second call
      const p2 = index.shutdown('SIGTERM');

      await Promise.all([p1, p2]);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown already in progress')
      );
    });
  });

  describe('Error Handlers', () => {
    it('should handle unhandled rejections', () => {
      const reason = new Error('Unhandled');
      const promise = { catch: jest.fn() }; // Mock promise object

      index.unhandledRejectionHandler(reason, promise);

      expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection:', reason);
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught');

      index.uncaughtExceptionHandler(error);

      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', error);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received uncaughtException')
      );
    });
  });
});
