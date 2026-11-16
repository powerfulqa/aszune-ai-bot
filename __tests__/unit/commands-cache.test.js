/**
 * Commands - Cache Command Tests
 * Tests cache command functionality
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
};

jest.mock('../../src/services/database', () => mockDatabaseService);

const { handleSlashCommand } = require('../../src/commands');
const perplexityService = require('../../src/services/perplexity-secure');
const { createMockInteraction, resetMocks } = require('../utils/testUtils');

const NOW = '2026-11-16T12:00:00.000Z';
const FOOTER = {
  text: 'Cache memory tracks stored responses only - see /resources for total bot memory',
};

describe('Commands - Cache Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jest.setup.js restores real timers after every test, so pin the clock per test.
    jest.useFakeTimers({ now: new Date(NOW) });
  });

  afterEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('/cache command', () => {
    it('should handle /cache command successfully', async () => {
      const interaction = createMockInteraction({ commandName: 'cache' });

      perplexityService.getCacheStats = jest.fn().mockReturnValue({
        hitRate: 90,
        hits: 180,
        misses: 20,
        sets: 150,
        deletes: 15,
        evictions: 5,
        memoryUsageFormatted: '50MB',
        maxMemoryFormatted: '100MB',
        entryCount: 75,
        maxSize: 100,
        evictionStrategy: 'LRU',
        uptimeFormatted: '2h 30m',
      });

      perplexityService.getDetailedCacheInfo = jest.fn().mockReturnValue({
        entries: [],
      });

      await handleSlashCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x0099ff,
            title: 'Cache Statistics',
            description: null,
            fields: [
              { name: 'Performance', value: 'Hit Rate: 90%\nHits: 180\nMisses: 20', inline: true },
              { name: 'Operations', value: 'Sets: 150\nDeletes: 15\nEvictions: 5', inline: true },
              {
                name: 'Cache Memory Usage',
                value: '50MB / 100MB\nEntries: 75 / 100',
                inline: true,
              },
              { name: 'Configuration', value: 'Strategy: LRU\nUptime: 2h 30m', inline: true },
              { name: 'Recent Entries', value: 'No recent entries', inline: false },
            ],
            footer: FOOTER,
            timestamp: new Date(NOW),
          },
        ],
      });
    });

    it('should handle /cache command with detailed info having entries', async () => {
      const interaction = createMockInteraction({ commandName: 'cache' });

      perplexityService.getCacheStats = jest.fn().mockReturnValue({
        hitRate: 85,
        hits: 170,
        misses: 30,
        sets: 100,
        deletes: 20,
        evictions: 10,
        memoryUsageFormatted: '75MB',
        maxMemoryFormatted: '100MB',
        entryCount: 50,
        maxSize: 100,
        evictionStrategy: 'LRU',
        uptimeFormatted: '3h 45m',
      });

      perplexityService.getDetailedCacheInfo = jest.fn().mockReturnValue({
        recentEntries: [
          { key: 'entry1', value: 'value1', ttl: 300 },
          { key: 'entry2', value: 'value2', ttl: 600 },
          { key: 'entry3', value: 'value3', ttl: 900 },
        ],
      });

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x0099ff,
            title: 'Cache Statistics',
            description: null,
            fields: [
              { name: 'Performance', value: 'Hit Rate: 85%\nHits: 170\nMisses: 30', inline: true },
              { name: 'Operations', value: 'Sets: 100\nDeletes: 20\nEvictions: 10', inline: true },
              {
                name: 'Cache Memory Usage',
                value: '75MB / 100MB\nEntries: 50 / 100',
                inline: true,
              },
              { name: 'Configuration', value: 'Strategy: LRU\nUptime: 3h 45m', inline: true },
              {
                name: 'Recent Entries',
                value:
                  '• entry1: value1 (TTL: 300s)\n• entry2: value2 (TTL: 600s)\n• entry3: value3 (TTL: 900s)',
                inline: false,
              },
            ],
            footer: FOOTER,
            timestamp: new Date(NOW),
          },
        ],
      });
    });

    it('should handle /cache command API error', async () => {
      const interaction = createMockInteraction({ commandName: 'cache' });

      // Mock the service to reject
      perplexityService.getCacheStats = jest.fn().mockImplementation(() => {
        throw new Error('Cache service unavailable');
      });
      perplexityService.getDetailedCacheInfo = jest.fn().mockImplementation(() => {
        throw new Error('Cache service unavailable');
      });

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 15548997,
            description:
              'Error retrieving cache statistics: An unexpected error occurred. Please try again later.',
          },
        ],
      });
    });

    it('should handle /cache command with invalid user ID', async () => {
      const interaction = createMockInteraction({
        commandName: 'cache',
        userId: 'invalid-id',
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          { color: 15548997, description: 'Invalid user ID: Invalid Discord user ID format' },
        ],
      });
      expect(interaction.deferReply).not.toHaveBeenCalled();
    });
  });
});
