/**
 * UserInfo Command Tests
 * Tests the Discord userinfo command functionality
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

const { handleSlashCommand } = require('../../../src/commands/index');

const mockMember = {
  id: 'target-user-123',
  displayColor: 0x5865f2,
  displayHexColor: '#5865F2',
  nickname: 'TestNick',
  joinedAt: new Date('2022-06-15'),
  joinedTimestamp: new Date('2022-06-15').getTime(),
  roles: {
    cache: {
      filter: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          map: jest.fn().mockReturnValue(['<@&role1>', '<@&role2>']),
          slice: jest.fn().mockReturnValue(['<@&role1>', '<@&role2>']),
        }),
      }),
      size: 3,
    },
  },
  permissions: {
    toArray: jest.fn().mockReturnValue(['Administrator', 'ManageGuild']),
  },
  presence: {
    status: 'online',
    activities: [
      {
        type: 0,
        name: 'Valorant',
      },
    ],
  },
  guild: {
    id: 'test-guild-123',
  },
};

const mockUser = {
  id: 'target-user-123',
  tag: 'TestUser#1234',
  username: 'TestUser',
  bot: false,
  toString: () => '<@target-user-123>',
  createdAt: new Date('2020-01-15'),
  displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discord.com/avatar.png'),
  flags: {
    toArray: jest.fn().mockReturnValue(['HypeSquadOnlineHouse1', 'ActiveDeveloper']),
  },
};

const mockInteraction = {
  commandName: 'userinfo',
  reply: jest.fn(),
  deferReply: jest.fn().mockResolvedValue(),
  editReply: jest.fn().mockResolvedValue(),
  user: {
    id: 'test-user-123',
    tag: 'RequestingUser#5678',
    username: 'RequestingUser',
    bot: false,
    createdAt: new Date('2019-03-20'),
    displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discord.com/avatar2.png'),
    flags: {
      toArray: jest.fn().mockReturnValue([]),
    },
  },
  options: {
    getUser: jest.fn().mockReturnValue(mockUser),
  },
  guild: {
    id: 'test-guild-123',
    members: {
      fetch: jest.fn().mockResolvedValue(mockMember),
      cache: {
        values: jest.fn().mockReturnValue([mockMember]),
      },
    },
  },
};

describe('UserInfo Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should defer reply before processing', async () => {
      await handleSlashCommand(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
    });

    it('should get user from options if provided', async () => {
      await handleSlashCommand(mockInteraction);

      expect(mockInteraction.options.getUser).toHaveBeenCalledWith('user');
    });

    it('should default to interaction user when no user option provided', async () => {
      const noUserInteraction = {
        ...mockInteraction,
        options: {
          getUser: jest.fn().mockReturnValue(null),
        },
      };

      await handleSlashCommand(noUserInteraction);

      expect(noUserInteraction.options.getUser).toHaveBeenCalledWith('user');
    });

    it('should fetch member data from guild', async () => {
      await handleSlashCommand(mockInteraction);

      expect(mockInteraction.guild.members.fetch).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reply with embed containing user information', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });
      // fetch(id) returns the member; fetch() returns the whole guild for the join position.
      const members = new Map([
        ['older-member', { id: 'older-member', joinedTimestamp: 1 }],
        [mockMember.id, mockMember],
      ]);
      const interaction = {
        ...mockInteraction,
        guild: {
          id: 'test-guild-123',
          members: { fetch: jest.fn(async (id) => (id ? mockMember : members)) },
        },
      };

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledTimes(1);
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          {
            color: 0x5865f2,
            author: { name: 'TestUser#1234', icon_url: 'https://cdn.discord.com/avatar.png' },
            thumbnail: { url: 'https://cdn.discord.com/avatar.png' },
            fields: [
              { name: '👤 User', value: '<@target-user-123>\n`target-user-123`', inline: true },
              { name: '🟢 Status', value: 'Online', inline: true },
              { name: '🤖 Bot', value: 'No', inline: true },
              {
                name: '📅 Account Created',
                value: '<t:1579046400:F>\n(6 years ago)',
                inline: true,
              },
              { name: '📥 Joined Server', value: '<t:1655251200:F>\n(4 years ago)', inline: true },
              { name: '🏅 Join Position', value: '#2', inline: true },
              { name: '📝 Nickname', value: 'TestNick', inline: true },
              { name: '🎮 Activity', value: 'Playing **Valorant**', inline: true },
              {
                name: '🎖️ Badges',
                value: '🏠 HypeSquad Bravery\n💻 Active Developer',
                inline: false,
              },
              { name: '🎭 Roles [2]', value: '<@&role1>, <@&role2>', inline: false },
              {
                name: '🔑 Key Permissions',
                value: '`Administrator`, `ManageGuild`',
                inline: false,
              },
            ],
            footer: { text: 'Aszai Bot • User Info' },
            timestamp: '2026-11-16T12:00:00.000Z',
          },
        ],
      });
    });
  });

  describe('Embed Content', () => {
    it('should include user ID in embed', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const userField = embed.fields.find((f) => f.name === '👤 User');

      expect(userField).toBeDefined();
      expect(userField.value).toContain(mockUser.id);
    });

    it('should include status field', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const statusField = embed.fields.find((f) => f.name.includes('Status'));

      expect(statusField).toBeDefined();
    });

    it('should include account creation date', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const createdField = embed.fields.find((f) => f.name === '📅 Account Created');

      expect(createdField).toBeDefined();
    });

    it('should include join date field', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const joinField = embed.fields.find((f) => f.name === '📥 Joined Server');

      expect(joinField).toBeDefined();
    });

    it('should include bot status field', async () => {
      await handleSlashCommand(mockInteraction);

      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const botField = embed.fields.find((f) => f.name === '🤖 Bot');

      expect(botField).toBeDefined();
      expect(botField.value).toBe('No');
    });
  });

  describe('Error Handling', () => {
    it('should handle member fetch failure gracefully', async () => {
      const errorInteraction = {
        ...mockInteraction,
        guild: {
          ...mockInteraction.guild,
          members: {
            fetch: jest.fn().mockRejectedValue(new Error('Member not found')),
          },
        },
      };

      await handleSlashCommand(errorInteraction);

      // Should still complete without throwing
      expect(errorInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle missing guild gracefully', async () => {
      const dmInteraction = {
        ...mockInteraction,
        guild: null,
      };

      await expect(handleSlashCommand(dmInteraction)).resolves.not.toThrow();
    });
  });

  describe('User Not In Server', () => {
    it('should handle user not being in the server', async () => {
      const notInServerInteraction = {
        ...mockInteraction,
        guild: {
          ...mockInteraction.guild,
          members: {
            fetch: jest.fn().mockRejectedValue(new Error('Unknown Member')),
          },
        },
      };

      await handleSlashCommand(notInServerInteraction);

      expect(notInServerInteraction.editReply).toHaveBeenCalled();
    });
  });
});

describe('UserInfo Embed Builder', () => {
  const {
    getStatusEmoji,
    getTimeAgo,
    capitalise,
    getUserBadges,
    getKeyPermissions,
  } = require('../../../src/commands/embeds/userinfo-embed');

  describe('getStatusEmoji', () => {
    it('should return green circle for online', () => {
      expect(getStatusEmoji('online')).toBe('🟢');
    });

    it('should return yellow circle for idle', () => {
      expect(getStatusEmoji('idle')).toBe('🟡');
    });

    it('should return red circle for dnd', () => {
      expect(getStatusEmoji('dnd')).toBe('🔴');
    });

    it('should return black circle for offline', () => {
      expect(getStatusEmoji('offline')).toBe('⚫');
    });

    it('should return black circle for unknown status', () => {
      expect(getStatusEmoji('unknown')).toBe('⚫');
    });

    it('should return black circle for undefined', () => {
      expect(getStatusEmoji(undefined)).toBe('⚫');
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

    it('should format days correctly', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      expect(getTimeAgo(fiveDaysAgo)).toBe('5 days ago');
    });

    it('should format hours correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(getTimeAgo(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should format minutes correctly', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(getTimeAgo(tenMinutesAgo)).toBe('10 minutes ago');
    });
  });

  describe('capitalise', () => {
    it('should capitalise first letter', () => {
      expect(capitalise('online')).toBe('Online');
    });

    it('should handle empty string', () => {
      expect(capitalise('')).toBe('');
    });

    it('should handle null', () => {
      expect(capitalise(null)).toBe(null);
    });

    it('should handle undefined', () => {
      expect(capitalise(undefined)).toBe(undefined);
    });
  });

  describe('getUserBadges', () => {
    it('should return empty array for null flags', () => {
      expect(getUserBadges(null)).toEqual([]);
    });

    it('should return empty array for undefined flags', () => {
      expect(getUserBadges(undefined)).toEqual([]);
    });

    it('should parse HypeSquad badge', () => {
      const mockFlags = {
        toArray: () => ['HypeSquadOnlineHouse1'],
      };
      const badges = getUserBadges(mockFlags);
      expect(badges).toContain('🏠 HypeSquad Bravery');
    });

    it('should parse multiple badges', () => {
      const mockFlags = {
        toArray: () => ['ActiveDeveloper', 'PremiumEarlySupporter'],
      };
      const badges = getUserBadges(mockFlags);
      expect(badges).toContain('💻 Active Developer');
      expect(badges).toContain('👑 Early Supporter');
    });
  });

  describe('getKeyPermissions', () => {
    it('should return empty array for null member', () => {
      expect(getKeyPermissions(null)).toEqual([]);
    });

    it('should return empty array for member without permissions', () => {
      expect(getKeyPermissions({ permissions: null })).toEqual([]);
    });

    it('should identify Administrator permission', () => {
      const mockMember = {
        permissions: {
          toArray: () => ['Administrator', 'SendMessages'],
        },
      };
      const perms = getKeyPermissions(mockMember);
      expect(perms).toContain('Administrator');
      expect(perms).not.toContain('SendMessages');
    });

    it('should identify multiple key permissions', () => {
      const mockMember = {
        permissions: {
          toArray: () => ['ManageGuild', 'BanMembers', 'KickMembers'],
        },
      };
      const perms = getKeyPermissions(mockMember);
      expect(perms).toContain('ManageGuild');
      expect(perms).toContain('BanMembers');
      expect(perms).toContain('KickMembers');
    });
  });
});

// Split into separate describe block to reduce arrow function line count
describe('UserInfo Embed Builder - Advanced', () => {
  const {
    formatActivity,
    buildUserInfoEmbed,
  } = require('../../../src/commands/embeds/userinfo-embed');

  describe('formatActivity', () => {
    it('should return None for null activity', () => {
      expect(formatActivity(null)).toBe('None');
    });

    it('should format Playing activity', () => {
      const activity = { type: 0, name: 'Valorant' };
      expect(formatActivity(activity)).toBe('Playing **Valorant**');
    });

    it('should format Streaming activity', () => {
      const activity = { type: 1, name: 'Live Stream' };
      expect(formatActivity(activity)).toBe('Streaming **Live Stream**');
    });

    it('should format Listening activity', () => {
      const activity = { type: 2, name: 'Spotify' };
      expect(formatActivity(activity)).toBe('Listening to **Spotify**');
    });

    it('should format Watching activity', () => {
      const activity = { type: 3, name: 'YouTube' };
      expect(formatActivity(activity)).toBe('Watching **YouTube**');
    });

    it('should format Custom Status', () => {
      const activity = { type: 4, state: 'Coding all night' };
      expect(formatActivity(activity)).toBe('Coding all night');
    });

    it('should handle Custom Status without state', () => {
      const activity = { type: 4 };
      expect(formatActivity(activity)).toBe('Custom Status');
    });

    it('should format Competing activity', () => {
      const activity = { type: 5, name: 'Tournament' };
      expect(formatActivity(activity)).toBe('Competing in **Tournament**');
    });
  });

  describe('buildUserInfoEmbed', () => {
    const mockUser = {
      id: 'user-123',
      tag: 'TestUser#1234',
      bot: false,
      createdAt: new Date('2020-01-01'),
      displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
      flags: { toArray: () => [] },
    };

    const mockMember = {
      displayColor: 0x5865f2,
      nickname: 'Testy',
      joinedAt: new Date('2021-06-15'),
      roles: {
        cache: {
          filter: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              map: jest.fn().mockReturnValue([]),
              slice: jest.fn().mockReturnValue([]),
            }),
          }),
          size: 1,
        },
      },
      permissions: { toArray: () => [] },
      guild: { id: 'guild-123' },
    };

    it('should create embed with required fields', () => {
      const embed = buildUserInfoEmbed(mockUser, mockMember, {});

      expect(embed).toHaveProperty('color');
      expect(embed).toHaveProperty('author');
      expect(embed).toHaveProperty('thumbnail');
      expect(embed).toHaveProperty('fields');
      expect(embed).toHaveProperty('footer');
    });

    it('should use member display color', () => {
      const embed = buildUserInfoEmbed(mockUser, mockMember, {});

      expect(embed.color).toBe(0x5865f2);
    });

    it('should fallback to default color when no member', () => {
      const embed = buildUserInfoEmbed(mockUser, null, {});

      expect(embed.color).toBe(0x5865f2);
    });

    it('should include join position when provided', () => {
      const embed = buildUserInfoEmbed(mockUser, mockMember, { joinPosition: 42 });
      const joinField = embed.fields.find((f) => f.name === '🏅 Join Position');

      expect(joinField).toBeDefined();
      expect(joinField.value).toBe('#42');
    });

    it('should show N/A for join position when not provided', () => {
      const embed = buildUserInfoEmbed(mockUser, mockMember, {});
      const joinField = embed.fields.find((f) => f.name === '🏅 Join Position');

      expect(joinField).toBeDefined();
      expect(joinField.value).toBe('N/A');
    });
  });
});
