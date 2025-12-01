/**
 * Tests for text command handler in commands/index.js
 * Targets uncovered branches: error handling, aliases, reply errors
 */

// Mock database service first
jest.mock('../../src/services/database', () => ({
  clearUserData: jest.fn(),
  ensureUserExists: jest.fn(),
  updateUsername: jest.fn(),
}));

// Mock conversation manager
jest.mock('../../src/utils/conversation', () => {
  return jest.fn().mockImplementation(() => ({
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 0, summaries: 0, reminders: 0 }),
    updateUserStats: jest.fn(),
  }));
});

// Mock perplexity service
jest.mock('../../src/services/perplexity-secure', () => ({
  generateSummary: jest.fn().mockResolvedValue('Summary result'),
  getCacheStats: jest.fn().mockReturnValue({
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memoryUsageFormatted: '0 B',
    maxMemoryFormatted: '50 MB',
    entryCount: 0,
    maxSize: 1000,
    evictionStrategy: 'LRU',
    uptimeFormatted: '0s',
  }),
  getDetailedCacheInfo: jest.fn().mockReturnValue({ recentEntries: [] }),
}));

// Mock reminder service
jest.mock('../../src/services/reminder-service', () => ({
  setReminder: jest.fn().mockResolvedValue({ id: '1', scheduled_time: new Date().toISOString() }),
  getUserReminders: jest.fn().mockResolvedValue([]),
  cancelReminder: jest.fn().mockResolvedValue(true),
}));

// Mock analytics and utilities
jest.mock('../../src/utils/discord-analytics', () => ({
  generateDailyReport: jest.fn().mockResolvedValue({ summary: {} }),
}));

jest.mock('../../src/utils/resource-optimizer', () => ({
  monitorResources: jest.fn().mockResolvedValue({
    memory: { status: 'good', used: 100, free: 400, percentage: 20 },
    performance: { status: 'good', responseTime: 50, load: 'low' },
    optimizationTier: 'standard',
  }),
  generateOptimizationRecommendations: jest.fn().mockResolvedValue(['Recommendation 1']),
}));

jest.mock('../../src/utils/performance-dashboard', () => ({
  generateDashboardReport: jest.fn().mockResolvedValue({
    overview: { status: 'healthy', memoryUsage: '50%', responseTime: '50ms', errorRate: '0%', optimizationTier: 'standard' },
    alerts: [],
  }),
  getRealTimeStatus: jest.fn().mockReturnValue({
    uptime: { formatted: '1h 0m' },
  }),
}));

jest.mock('../../src/utils/guild-member-stats', () => ({
  getGuildMemberStats: jest.fn().mockResolvedValue({
    onlineCount: 10,
    botCount: 2,
    totalMembers: 50,
    humanMembers: 48,
  }),
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { handleTextCommand } = require('../../src/commands');
const logger = require('../../src/utils/logger');

describe('Text Command Handler - Branch Coverage', () => {
  let mockMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessage = {
      content: '',
      author: { id: '123456789012345678', bot: false },
      channel: {
        sendTyping: jest.fn(),
        send: jest.fn(),
      },
      reply: jest.fn().mockResolvedValue({}),
    };
  });

  describe('handleTextCommand', () => {
    it('should return null for non-command messages', async () => {
      mockMessage.content = 'hello there';

      const result = await handleTextCommand(mockMessage);

      expect(result).toBeNull();
    });

    it('should handle !help command', async () => {
      mockMessage.content = '!help';

      await handleTextCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalled();
    });

    it('should handle !clearhistory command', async () => {
      mockMessage.content = '!clearhistory';

      await handleTextCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        'Conversation history cleared! Your stats have been preserved.'
      );
    });

    it('should handle !stats command', async () => {
      mockMessage.content = '!stats';

      await handleTextCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalled();
      const replyArg = mockMessage.reply.mock.calls[0][0];
      expect(replyArg).toContain('Your Aszai Bot Stats');
    });

    it('should handle !summarise alias !summerise', async () => {
      mockMessage.content = '!summerise test text to summarize';

      await handleTextCommand(mockMessage);

      // Should trigger the summarise command via alias
      expect(mockMessage.channel.sendTyping).toHaveBeenCalled();
    });

    it('should handle command execution error', async () => {
      mockMessage.content = '!stats';
      // Make reply throw an error initially, then succeed
      const errorOnce = new Error('Reply failed');
      mockMessage.reply
        .mockRejectedValueOnce(errorOnce)
        .mockResolvedValue({});

      // This tests the catch block for reply errors
      await handleTextCommand(mockMessage);

      // Should log the error
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle reply failure in error handler', async () => {
      mockMessage.content = '!summary'; // summary with no history throws
      // Make reply always fail
      mockMessage.reply.mockRejectedValue(new Error('Reply completely failed'));

      await handleTextCommand(mockMessage);

      // Should log both errors
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle case-insensitive commands', async () => {
      mockMessage.content = '!HELP';

      const result = await handleTextCommand(mockMessage);

      // Command prefix check uses toLowerCase()
      expect(mockMessage.reply).toHaveBeenCalled();
    });

    it('should handle commands with extra whitespace', async () => {
      mockMessage.content = '!help   extra   args';

      await handleTextCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalled();
    });
  });
});
