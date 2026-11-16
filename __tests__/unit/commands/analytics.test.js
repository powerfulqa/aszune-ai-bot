/**
 * Analytics Command Tests
 * Tests the Discord analytics command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/database', () => ({
  getCommandUsageStats: jest.fn().mockReturnValue({
    totalCommands: 25,
    successRate: 96,
    commandBreakdown: [{ command: 'chat', count: 15 }],
  }),
  getErrorStats: jest.fn().mockReturnValue({
    totalErrors: 2,
    resolvedCount: 1,
    errorBreakdown: [{ error_type: 'network', count: 1 }],
  }),
  getUptimeStats: jest.fn().mockReturnValue({
    totalUptime: 3600,
    totalDowntime: 60,
    restartCount: 1,
  }),
  trackServerMetric: jest.fn(),
  trackCommandUsage: jest.fn(),
  logError: jest.fn(),
  clearUserConversationData: jest.fn(),
  clearUserData: jest.fn(),
  getPerformanceMetrics: jest.fn().mockReturnValue([
    { value: 1200, timestamp: new Date().toISOString() },
    { value: 1100, timestamp: new Date().toISOString() },
  ]),
}));
const { handleSlashCommand } = require('../../../src/commands/index');
const { ErrorHandler } = require('../../../src/utils/error-handler');

// Mock the conversation module
jest.mock('../../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
    isRateLimited: jest.fn().mockReturnValue(false),
    updateTimestamp: jest.fn(),
  };
  return jest.fn(() => mockInstance);
});

const NOW = '2026-11-16T12:00:00.000Z';

describe('Analytics Command', () => {
  const mockInteraction = {
    commandName: 'analytics',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: {
      id: 'test-user-123',
      username: 'testuser',
    },
    guild: {
      id: 'test-guild-123',
      memberCount: 150,
      members: {
        fetch: jest.fn().mockResolvedValue(),
        cache: {
          filter: jest.fn().mockImplementation((callback) => {
            const members = [
              { user: { bot: false }, presence: { status: 'online' } },
              { user: { bot: false }, presence: { status: 'idle' } },
              { user: { bot: false }, presence: { status: 'offline' } },
              { user: { bot: true }, presence: { status: 'online' } },
            ];
            return { size: members.filter(callback).length };
          }),
          size: 4,
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // jest.setup.js restores real timers after every test, so pin the clock per test.
    jest.useFakeTimers({ now: new Date(NOW) });

    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR',
    });
  });

  test('should handle analytics command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color: 0x5865f2,
          title: '📊 Server Overview',
          fields: [
            { name: '🟢 Online now', value: '3', inline: true },
            { name: '👥 Members', value: '149', inline: true },
            { name: '🤖 Bots', value: '1', inline: true },
          ],
          footer: { text: 'Aszai Bot Analytics' },
          timestamp: NOW,
        },
      ],
    });
  });

  test('should handle analytics command error', async () => {
    // Simulate error in guild member fetching
    const mockInteractionWithError = {
      ...mockInteraction,
      guild: {
        ...mockInteraction.guild,
        members: {
          fetch: jest.fn().mockRejectedValue(new Error('Failed to fetch members')),
          cache: null, // This will cause an error
        },
      },
    };

    await handleSlashCommand(mockInteractionWithError);

    expect(mockInteractionWithError.deferReply).toHaveBeenCalled();
    expect(ErrorHandler.handleError).toHaveBeenCalledTimes(1);
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(
      new TypeError("Cannot read properties of null (reading 'filter')"),
      'analytics_command'
    );
    expect(mockInteractionWithError.editReply).toHaveBeenCalledWith({
      embeds: [
        { color: 15548997, description: 'An unexpected error occurred. Please try again later.' },
      ],
    });
  });

  // Fetch fails and the cache holds no presences: 20% are assumed online, and
  // 5% are assumed bots only above 10 members.
  test.each([
    [150, '30', '143', '7'],
    [100, '20', '95', '5'],
    [10, '2', '10', '0'],
  ])(
    'estimates from a member count of %i when nothing is cached',
    async (memberCount, online, humans, bots) => {
      const mockInteractionFallback = {
        ...mockInteraction,
        deferReply: jest.fn(),
        editReply: jest.fn(),
        guild: {
          id: 'test-guild-123',
          memberCount,
          members: {
            fetch: jest.fn().mockRejectedValue(new Error('Failed to fetch members')),
            cache: { filter: jest.fn().mockReturnValue({ size: 0 }), size: memberCount },
          },
        },
      };

      await handleSlashCommand(mockInteractionFallback);

      expect(mockInteractionFallback.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x5865f2,
            title: '📊 Server Overview',
            fields: [
              { name: '🟢 Online now', value: online, inline: true },
              { name: '👥 Members', value: humans, inline: true },
              { name: '🤖 Bots', value: bots, inline: true },
            ],
            footer: { text: 'Aszai Bot Analytics' },
            timestamp: NOW,
          },
        ],
      });
    }
  );
});

describe('Stats Command', () => {
  const mockInteraction = {
    commandName: 'stats',
    reply: jest.fn(),
    user: {
      id: '123456789012345678', // Valid Discord snowflake format (18 digits)
    },
  };

  test('should handle stats command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      '**Your Aszai Bot Stats:**\n' +
        'Messages sent: 10\n' +
        'Summaries requested: 2\n' +
        'Active reminders: 0'
    );
  });
});

describe('Help Command', () => {
  const mockInteraction = {
    commandName: 'help',
    reply: jest.fn(),
    user: {
      id: 'test-user-123',
    },
  };

  test('should handle help command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      '**Aszai Bot Commands:**\n' +
        '`/help` - Show this help message\n' +
        '`/clearhistory` - Clear your conversation history (keeps your stats)\n' +
        '`/summary` - Summarise your current conversation\n' +
        '`/summarise <text>` - Summarise provided text\n' +
        '`/stats` - Show your usage stats\n' +
        '`/analytics` - Show Discord server analytics\n' +
        '`/dashboard` - Show performance dashboard\n' +
        '`/resources` - Show resource optimization status\n' +
        '`/cache` - Show cache statistics\n' +
        '`/remind <time> <message>` - Set a reminder\n' +
        '`/reminders` - List your active reminders\n' +
        '`/cancelreminder <id>` - Cancel a specific reminder\n' +
        '`/userinfo [user]` - Show detailed user information\n' +
        '`/serverinfo` - Show detailed server information\n' +
        '`/diag [live]` - Bot diagnostics (owner only, private)\n' +
        'Simply chat as normal to talk to the bot!'
    );
  });
});

describe('Clear History Command', () => {
  const mockInteraction = {
    commandName: 'clearhistory',
    reply: jest.fn(),
    user: {
      id: '123456789012345678', // Valid Discord snowflake format (18 digits)
    },
  };

  test('should handle clearhistory command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      'Conversation history cleared! Your stats have been preserved.'
    );
  });
});

describe('Summary Command', () => {
  const mockInteraction = {
    commandName: 'summary',
    reply: jest.fn(),
    user: {
      id: '123456789012345678', // Valid Discord snowflake format (18 digits)
    },
  };

  test('should handle summary command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith('No conversation history to summarize.');
  });
});
