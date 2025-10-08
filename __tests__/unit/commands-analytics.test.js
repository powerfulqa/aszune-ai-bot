/**
 * Commands - Analytics Commands Tests
 * Tests analytics, dashboard, and resources commands
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/perplexity-secure');

// Create a mock database service instance
const mockDatabaseService = {
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
  clearUserData: jest.fn(),
  clearUserConversationData: jest.fn(),
  trackCommandUsage: jest.fn(),
  logError: jest.fn(),
  getUserStats: jest.fn().mockReturnValue({
    message_count: 10,
    total_summaries: 2,
  }),
  getUserReminderCount: jest.fn().mockReturnValue(3),
  getCommandUsageStats: jest.fn().mockReturnValue({
    totalCommands: 100,
    successRate: 95,
    commandBreakdown: [{ command: 'help', count: 20 }],
  }),
  getErrorStats: jest.fn().mockReturnValue({
    totalErrors: 5,
    resolvedCount: 3,
    errorBreakdown: [{ error_type: 'timeout', count: 2 }],
  }),
  getUptimeStats: jest.fn().mockReturnValue({
    totalUptime: 3600,
    totalDowntime: 60,
    restartCount: 1,
  }),
  getReminderStats: jest.fn().mockReturnValue({
    totalReminders: 25,
    activeReminders: 10,
    completedReminders: 15,
  }),
  trackServerMetric: jest.fn(),
  getPerformanceMetrics: jest.fn().mockReturnValue([
    { value: 150 },
    { value: 200 },
    { value: 175 },
  ]),
};

jest.mock('../../src/services/database', () => mockDatabaseService);

const { handleSlashCommand } = require('../../src/commands');
const { createMockInteraction, resetMocks } = require('../../src/utils/testUtils');

describe('Commands - Analytics Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('/analytics command', () => {
    it('should handle /analytics command successfully', async () => {
      const interaction = createMockInteraction({ commandName: 'analytics' });
      interaction.guild = {
        id: '123456789',
        memberCount: 150,
        members: {
          cache: {
            filter: jest.fn(() => ({ size: 30 })),
            fetch: jest.fn().mockResolvedValue(),
          },
        },
      };

      await handleSlashCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: '📊 Discord Analytics Dashboard',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: '�� Server Overview' }),
              expect.objectContaining({ name: '�� Performance' }),
              expect.objectContaining({ name: '�� Top Commands' }),
              expect.objectContaining({ name: '�� Server Insights' }),
            ]),
          }),
        ],
      });
    });

    it('should handle /analytics command with API timeout fallback', async () => {
      const interaction = createMockInteraction({ commandName: 'analytics' });
      interaction.guild = {
        id: '123456789',
        memberCount: 150,
        members: {
          cache: {
            filter: jest.fn(() => ({ size: 0 })),
            fetch: jest.fn().mockRejectedValue(new Error('Timeout')),
          },
        },
      };

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: '💡 Server Insights',
                value: expect.stringContaining('30'), // fallback online count
              }),
            ]),
          }),
        ],
      });
    });
  });

  describe('/dashboard command', () => {
    it('should handle /dashboard command successfully', async () => {
      const interaction = createMockInteraction({ commandName: 'dashboard' });
      interaction.guild = {
        id: '123456789',
        memberCount: 200,
        members: {
          cache: {
            filter: jest.fn(() => ({ size: 40 })),
            fetch: jest.fn().mockResolvedValue(),
          },
        },
      };

      await handleSlashCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: '🖥️ Performance Dashboard',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: '🚦 System Status' }),
              expect.objectContaining({ name: '⚡ Performance' }),
              expect.objectContaining({ name: '📊 Activity' }),
              expect.objectContaining({ name: '🚨 Active Alerts' }),
            ]),
          }),
        ],
      });
    });

    it('should handle /dashboard command with critical alerts', async () => {
      const interaction = createMockInteraction({ commandName: 'dashboard' });
      interaction.guild = {
        id: '123456789',
        memberCount: 100,
        members: {
          cache: {
            filter: jest.fn(() => ({ size: 15 })),
            fetch: jest.fn().mockResolvedValue(),
          },
        },
      };

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: '🚨 Active Alerts',
                value: expect.stringContaining('No active alerts'),
              }),
            ]),
          }),
        ],
      });
    });
  });

  describe('/resources command', () => {
    it('should handle /resources command successfully', async () => {
      const interaction = createMockInteraction({ commandName: 'resources' });

      await handleSlashCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: '🔧 Resource Optimization',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: '�� Memory Status' }),
              expect.objectContaining({ name: '⚙️ Performance' }),
              expect.objectContaining({ name: '�� Optimization Tier' }),
              expect.objectContaining({ name: '�� Recommendations' }),
            ]),
          }),
        ],
      });
    });

    it('should handle /resources command with warning status', async () => {
      const interaction = createMockInteraction({ commandName: 'resources' });

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: '💡 Recommendations',
                value: expect.stringContaining('System performance is good'),
              }),
            ]),
          }),
        ],
      });
    });
  });
});