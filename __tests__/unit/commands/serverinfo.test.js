/**
 * ServerInfo Command Tests
 * Tests the Discord serverinfo command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/database', () => ({
  clearUserConversationData: jest.fn(),
  clearUserData: jest.fn(),
  ensureUserExists: jest.fn(),
  updateUsername: jest.fn(),
}));

// Mock the conversation module
jest.mock('../../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
  };
  return jest.fn(() => mockInstance);
});

// Mock guild-member-stats
jest.mock('../../../src/utils/guild-member-stats', () => ({
  getGuildMemberStats: jest.fn().mockResolvedValue({
    onlineCount: 50,
    botCount: 10,
    totalMembers: 200,
    humanMembers: 190,
  }),
}));

const { handleSlashCommand } = require('../../../src/commands/index');
const { getGuildMemberStats } = require('../../../src/utils/guild-member-stats');

describe('ServerInfo Command', () => {
  const mockGuild = {
    id: 'test-guild-123',
    name: 'Test Server',
    description: 'A test Discord server',
    ownerId: 'owner-123',
    memberCount: 200,
    premiumTier: 2,
    premiumSubscriptionCount: 15,
    verificationLevel: 2,
    explicitContentFilter: 1,
    createdAt: new Date('2019-06-15'),
    iconURL: jest.fn().mockReturnValue('https://cdn.discord.com/icon.png'),
    bannerURL: jest.fn().mockReturnValue(null),
    features: ['COMMUNITY', 'WELCOME_SCREEN_ENABLED'],
    channels: {
      cache: {
        filter: jest.fn().mockImplementation((callback) => {
          const channels = [
            { type: 0 }, // Text
            { type: 0 },
            { type: 2 }, // Voice
            { type: 4 }, // Category
          ];
          return { size: channels.filter(callback).length };
        }),
        size: 50,
      },
    },
    roles: {
      cache: {
        filter: jest.fn().mockImplementation((callback) => {
          const roles = [
            { managed: false, hoist: true },
            { managed: true, hoist: false },
            { managed: false, hoist: false },
          ];
          return { size: roles.filter(callback).length };
        }),
        size: 15,
      },
    },
    emojis: {
      cache: {
        filter: jest.fn().mockImplementation((callback) => {
          const emojis = [
            { animated: false },
            { animated: true },
            { animated: false },
          ];
          return { size: emojis.filter(callback).length };
        }),
        size: 25,
      },
    },
    stickers: {
      cache: {
        size: 5,
      },
    },
  };

  const mockInteraction = {
    commandName: 'serverinfo',
    reply: jest.fn(),
    deferReply: jest.fn().mockResolvedValue(),
    editReply: jest.fn().mockResolvedValue(),
    user: {
      id: 'test-user-123',
      username: 'testuser',
    },
    guild: mockGuild,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should defer reply before processing', async () => {
      await handleSlashCommand(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
    });

    it('should get guild member stats', async () => {
      await handleSlashCommand(mockInteraction);

      expect(getGuildMemberStats).toHaveBeenCalledWith(mockGuild);
    });

    it('should reply with embed containing server information', async () => {
      await handleSlashCommand(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              author: expect.objectContaining({
                name: mockGuild.name,
              }),
              fields: expect.any(Array),
              footer: expect.objectContaining({
                text: 'Aszai Bot • Server Info',
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('Embed Content', () => {
    it('should include owner field', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const ownerField = embed.fields.find((f) => f.name === '👑 Owner');

      expect(ownerField).toBeDefined();
      expect(ownerField.value).toContain(mockGuild.ownerId);
    });

    it('should include creation date', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const createdField = embed.fields.find((f) => f.name === '📅 Created');

      expect(createdField).toBeDefined();
    });

    it('should include server ID', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const idField = embed.fields.find((f) => f.name === '🆔 Server ID');

      expect(idField).toBeDefined();
      expect(idField.value).toContain(mockGuild.id);
    });

    it('should include member statistics', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const memberField = embed.fields.find((f) => f.name.includes('Members'));

      expect(memberField).toBeDefined();
    });

    it('should include channel statistics', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const channelField = embed.fields.find((f) => f.name.includes('Channels'));

      expect(channelField).toBeDefined();
    });

    it('should include boost status', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const boostField = embed.fields.find((f) => f.name.includes('Boost'));

      expect(boostField).toBeDefined();
    });
  });

  describe('No Guild (DM) Handling', () => {
    it('should handle missing guild', async () => {
      const dmInteraction = {
        ...mockInteraction,
        guild: null,
      };

      await handleSlashCommand(dmInteraction);

      expect(dmInteraction.editReply).toHaveBeenCalledWith(
        'This command can only be used in a server.'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle member stats failure gracefully', async () => {
      getGuildMemberStats.mockRejectedValueOnce(new Error('Stats error'));

      await handleSlashCommand(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});

describe('ServerInfo Embed Builder', () => {
  const {
    buildServerInfoEmbed,
    getVerificationLevel,
    getContentFilter,
    getBoostTier,
    getBoostEmoji,
    getChannelCounts,
    getRoleStats,
    getEmojiStats,
    getStickerStats,
    getTimeAgo,
  } = require('../../../src/commands/embeds/serverinfo-embed');

  describe('getVerificationLevel', () => {
    it('should return None for level 0', () => {
      expect(getVerificationLevel(0)).toBe('None');
    });

    it('should return Low for level 1', () => {
      expect(getVerificationLevel(1)).toBe('Low');
    });

    it('should return Medium for level 2', () => {
      expect(getVerificationLevel(2)).toBe('Medium');
    });

    it('should return High for level 3', () => {
      expect(getVerificationLevel(3)).toBe('High');
    });

    it('should return Very High for level 4', () => {
      expect(getVerificationLevel(4)).toBe('Very High');
    });

    it('should return Unknown for invalid level', () => {
      expect(getVerificationLevel(99)).toBe('Unknown');
    });
  });

  describe('getContentFilter', () => {
    it('should return Disabled for level 0', () => {
      expect(getContentFilter(0)).toBe('Disabled');
    });

    it('should return Members without roles for level 1', () => {
      expect(getContentFilter(1)).toBe('Members without roles');
    });

    it('should return All members for level 2', () => {
      expect(getContentFilter(2)).toBe('All members');
    });

    it('should return Unknown for invalid level', () => {
      expect(getContentFilter(99)).toBe('Unknown');
    });
  });

  describe('getBoostTier', () => {
    it('should return No Level for tier 0', () => {
      expect(getBoostTier(0)).toBe('No Level');
    });

    it('should return Level 1 for tier 1', () => {
      expect(getBoostTier(1)).toBe('Level 1');
    });

    it('should return Level 2 for tier 2', () => {
      expect(getBoostTier(2)).toBe('Level 2');
    });

    it('should return Level 3 for tier 3', () => {
      expect(getBoostTier(3)).toBe('Level 3');
    });

    it('should return Unknown for invalid tier', () => {
      expect(getBoostTier(99)).toBe('Unknown');
    });
  });

  describe('getBoostEmoji', () => {
    it('should return black square for tier 0', () => {
      expect(getBoostEmoji(0)).toBe('⬛');
    });

    it('should return purple square for tier 1', () => {
      expect(getBoostEmoji(1)).toBe('🟪');
    });

    it('should return purple heart for tier 2', () => {
      expect(getBoostEmoji(2)).toBe('💜');
    });

    it('should return gem for tier 3', () => {
      expect(getBoostEmoji(3)).toBe('💎');
    });

    it('should return black square for invalid tier', () => {
      expect(getBoostEmoji(99)).toBe('⬛');
    });
  });

  describe('getChannelCounts', () => {
    const mockGuild = {
      channels: {
        cache: {
          filter: jest.fn().mockImplementation((callback) => {
            const channels = [
              { type: 0 }, // Text
              { type: 0 },
              { type: 2 }, // Voice
              { type: 4 }, // Category
              { type: 13 }, // Stage
              { type: 15 }, // Forum
              { type: 5 }, // Announcement
              { type: 11 }, // Thread
            ];
            return { size: channels.filter(callback).length };
          }),
          size: 8,
        },
      },
    };

    it('should count text channels', () => {
      const counts = getChannelCounts(mockGuild);
      expect(counts.text).toBe(2);
    });

    it('should count voice channels', () => {
      const counts = getChannelCounts(mockGuild);
      expect(counts.voice).toBe(1);
    });

    it('should count categories', () => {
      const counts = getChannelCounts(mockGuild);
      expect(counts.category).toBe(1);
    });

    it('should return total count', () => {
      const counts = getChannelCounts(mockGuild);
      expect(counts.total).toBe(8);
    });
  });

  describe('getRoleStats', () => {
    const mockGuild = {
      roles: {
        cache: {
          filter: jest.fn().mockImplementation((callback) => {
            const roles = [
              { managed: false, hoist: true },
              { managed: true, hoist: false },
              { managed: false, hoist: true },
            ];
            return { size: roles.filter(callback).length };
          }),
          size: 5,
        },
      },
    };

    it('should return total roles minus @everyone', () => {
      const stats = getRoleStats(mockGuild);
      expect(stats.total).toBe(4);
    });

    it('should count managed roles', () => {
      const stats = getRoleStats(mockGuild);
      expect(stats.managed).toBe(1);
    });

    it('should count hoisted roles', () => {
      const stats = getRoleStats(mockGuild);
      expect(stats.hoisted).toBe(2);
    });
  });

  describe('getEmojiStats', () => {
    const mockGuild = {
      emojis: {
        cache: {
          filter: jest.fn().mockImplementation((callback) => {
            const emojis = [
              { animated: false },
              { animated: true },
              { animated: false },
            ];
            return { size: emojis.filter(callback).length };
          }),
          size: 3,
        },
      },
    };

    it('should count total emojis', () => {
      const stats = getEmojiStats(mockGuild);
      expect(stats.total).toBe(3);
    });

    it('should count animated emojis', () => {
      const stats = getEmojiStats(mockGuild);
      expect(stats.animated).toBe(1);
    });

    it('should count static emojis', () => {
      const stats = getEmojiStats(mockGuild);
      expect(stats.static).toBe(2);
    });
  });

  describe('getStickerStats', () => {
    it('should count total stickers', () => {
      const mockGuild = {
        stickers: {
          cache: {
            size: 10,
          },
        },
      };
      const stats = getStickerStats(mockGuild);
      expect(stats.total).toBe(10);
    });
  });

  describe('getTimeAgo', () => {
    it('should format years correctly', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      expect(getTimeAgo(twoYearsAgo)).toBe('2 years ago');
    });

    it('should format single year correctly', () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      expect(getTimeAgo(oneYearAgo)).toBe('1 year ago');
    });

    it('should format months correctly', () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      expect(getTimeAgo(threeMonthsAgo)).toBe('3 months ago');
    });
  });

  describe('buildServerInfoEmbed', () => {
    const mockGuild = {
      id: 'guild-123',
      name: 'Test Server',
      description: 'A test server',
      ownerId: 'owner-123',
      memberCount: 100,
      premiumTier: 2,
      premiumSubscriptionCount: 10,
      verificationLevel: 2,
      explicitContentFilter: 1,
      createdAt: new Date('2020-01-01'),
      iconURL: jest.fn().mockReturnValue('https://example.com/icon.png'),
      bannerURL: jest.fn().mockReturnValue(null),
      features: ['COMMUNITY'],
      channels: {
        cache: {
          filter: jest.fn().mockReturnValue({ size: 10 }),
          size: 50,
        },
      },
      roles: {
        cache: {
          filter: jest.fn().mockReturnValue({ size: 5 }),
          size: 15,
        },
      },
      emojis: {
        cache: {
          filter: jest.fn().mockReturnValue({ size: 5 }),
          size: 25,
        },
      },
      stickers: {
        cache: {
          size: 5,
        },
      },
    };

    it('should create embed with required fields', () => {
      const embed = buildServerInfoEmbed(mockGuild, {});

      expect(embed).toHaveProperty('color');
      expect(embed).toHaveProperty('author');
      expect(embed).toHaveProperty('fields');
      expect(embed).toHaveProperty('footer');
    });

    it('should include server description when available', () => {
      const embed = buildServerInfoEmbed(mockGuild, {});

      expect(embed.description).toContain('A test server');
    });

    it('should include member stats when provided', () => {
      const embed = buildServerInfoEmbed(mockGuild, {
        memberStats: { onlineCount: 50, botCount: 10, humanMembers: 90 },
      });

      const memberField = embed.fields.find((f) => f.name.includes('Members'));
      expect(memberField).toBeDefined();
    });

    it('should show features when present', () => {
      const embed = buildServerInfoEmbed(mockGuild, {});
      const featuresField = embed.fields.find((f) => f.name === '✨ Features');

      expect(featuresField).toBeDefined();
      expect(featuresField.value).toContain('Community');
    });

    it('should use default color', () => {
      const embed = buildServerInfoEmbed(mockGuild, {});

      expect(embed.color).toBe(0x5865f2);
    });
  });
});
