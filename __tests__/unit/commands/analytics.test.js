/**
 * Analytics Command Tests
 * Tests the Discord analytics command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/discord-analytics', () => ({
  generateDailyReport: jest.fn(),
  generateServerInsights: jest.fn(),
}));
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
  getPerformanceMetrics: jest.fn().mockReturnValue([
    { value: 1200, timestamp: new Date().toISOString() },
    { value: 1100, timestamp: new Date().toISOString() },
  ]),
  getUserReminderCount: jest.fn().mockReturnValue(0),
  getReminderStats: jest.fn().mockReturnValue({
    totalReminders: 5,
    activeReminders: 3,
    completedReminders: 2,
    cancelledReminders: 0,
  }),
}));
jest.mock('../../../src/utils/performance-dashboard', () => ({
  generateDashboardReport: jest.fn().mockResolvedValue({
    overview: {
      status: 'healthy',
      memoryUsage: '128MB',
    },
    alerts: [],
  }),
  getRealTimeStatus: jest.fn().mockReturnValue({
    uptime: { formatted: '2h 30m' },
    memoryUsage: '128MB',
  }),
}));

const { handleSlashCommand } = require('../../../src/commands/index');
const DiscordAnalytics = require('../../../src/utils/discord-analytics');
const { ErrorHandler } = require('../../../src/utils/error-handler');

// Mock the conversation module
jest.mock('../../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2, reminders: 0 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
  };
  return jest.fn(() => mockInstance);
});

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

    // Setup default successful mocks
    DiscordAnalytics.generateDailyReport.mockResolvedValue({
      summary: {
        totalServers: 5,
        totalUsers: 150,
        totalCommands: 45,
        successRate: 97.8,
        errorRate: 2.2,
        avgResponseTime: 1200,
      },
      commandStats: [
        { command: 'chat', count: 20 },
        { command: 'help', count: 15 },
        { command: 'ping', count: 10 },
      ],
    });

    DiscordAnalytics.generateServerInsights.mockResolvedValue({
      recommendations: [
        'Server activity is high during peak hours',
        'Consider adding more moderation during weekends',
      ],
    });

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
          title: '📊 Discord Analytics Dashboard',
          fields: [
            {
              name: '🏢 Server Overview',
              value: 'Servers: 1\nActive Users: 149\nTotal Members: 150\nBots: 1',
              inline: true,
            },
            {
              name: '📈 Command Analytics (7 days)',
              value: 'Total Commands: 25\nSuccess Rate: 96%\nTop Command: chat (15)',
              inline: true,
            },
            {
              name: '⚠️ Error Tracking (7 days)',
              value: 'Total Errors: 2\nResolved: 1\nTop Error: network (1)',
              inline: true,
            },
            {
              name: '⏱️ Bot Uptime',
              value: 'Total Uptime: 1h\nDowntime: 0h\nRestarts: 1',
              inline: true,
            },
            {
              name: '⏰ Reminder System',
              value: 'Total Reminders: 5\nActive: 3\nCompleted: 2',
              inline: true,
            },
            {
              name: '💡 Server Insights',
              value: '🟢 Currently Online: 3\n📊 Server Health: Excellent\n🤖 Bot Activity: Active',
              inline: false,
            },
          ],
          footer: { text: 'Aszai Bot Analytics • Database-powered' },
          timestamp: expect.any(String),
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
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(expect.any(Error), 'analytics_command');
    expect(mockInteractionWithError.editReply).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again later.',
    });
  });

  test('should handle analytics with fallback calculations', async () => {
    // Mock guild with members that would trigger fallback calculations
    const mockInteractionFallback = {
      ...mockInteraction,
      deferReply: jest.fn(),
      editReply: jest.fn(),
      guild: {
        id: 'test-guild-123',
        memberCount: 100, // Large member count to trigger fallback calculations
        members: {
          fetch: jest.fn().mockRejectedValue(new Error('Failed to fetch members')),
          cache: {
            filter: jest.fn().mockReturnValue({ size: 0 }), // No online members in cache
            size: 100,
          },
        },
      },
    };

    await handleSlashCommand(mockInteractionFallback);

    expect(mockInteractionFallback.editReply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          color: 0x5865f2,
          title: '📊 Discord Analytics Dashboard',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '🏢 Server Overview',
              // Should show fallback calculations: onlineCount = Math.floor(100 * 0.2) = 20
              // botCount = Math.floor(100 * 0.05) = 5, so humanMembers = 100 - 5 = 95
              value: expect.stringContaining(
                'Servers: 1\nActive Users: 95\nTotal Members: 100\nBots: 5'
              ),
              inline: true,
            }),
            expect.objectContaining({
              name: '💡 Server Insights',
              value: expect.stringContaining('🟢 Currently Online: 20'), // Fallback online count
              inline: false,
            }),
          ]),
          footer: { text: 'Aszai Bot Analytics • Database-powered' },
          timestamp: expect.any(String),
        }),
      ],
    });
  });
});

describe('Stats Command', () => {
  const mockInteraction = {
    commandName: 'stats',
    reply: jest.fn(),
    user: {
      id: 'test-user-123',
    },
  };

  test('should handle stats command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      '**Your Aszai Bot Stats:**\n' + 'Messages sent: 10\n' + 'Summaries requested: 2\n' + 'Active reminders: 0'
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
        '`/remind <time> <message>` - Set a reminder\n' +
        '`/reminders` - List your active reminders\n' +
        '`/cancelreminder <id>` - Cancel a specific reminder\n' +
        '\n**Note:** Use "!" at the start of any message to prevent the bot from responding.\n' +
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

describe('Dashboard Command', () => {
  const mockInteraction = {
    commandName: 'dashboard',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: {
      id: '123456789012345678', // Valid Discord snowflake format (18 digits)
    },
    guild: {
      id: 'test-guild-123',
      memberCount: 150,
      members: {
        fetch: jest.fn().mockResolvedValue(),
        cache: {
          filter: jest.fn().mockReturnValue({ size: 100 }),
          size: 150,
        },
      },
    },
  };

  test('should handle dashboard command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          color: expect.any(Number),
          title: '🖥️ Performance Dashboard',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '🚦 System Status',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⚡ Performance (24h)',
              value: expect.stringContaining('Response Time:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '📊 Activity',
              value: expect.stringContaining('Servers: 1'),
              inline: true,
            }),
          ]),
          footer: { text: 'Aszai Bot Dashboard • Database-powered • Real-time data' },
          timestamp: expect.any(String),
        }),
      ],
    });
  });
});

describe('Resources Command', () => {
  const mockInteraction = {
    commandName: 'resources',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: {
      id: '123456789012345678', // Valid Discord snowflake format (18 digits)
    },
  };

  test('should handle resources command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          color: expect.any(Number),
          title: '🔧 Resource Optimization',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '💾 Memory Status',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⚙️ Performance',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '📈 Database Metrics (24h)',
              value: expect.stringContaining('Avg Memory:'),
              inline: true,
            }),
          ]),
          footer: { text: 'Aszai Bot Resource Monitor • Database-powered' },
          timestamp: expect.any(String),
        }),
      ],
    });
  });
});
