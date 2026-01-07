/**
 * User Info embed builder
 * Generates Discord embed for /userinfo command
 */

const { getTimeAgo } = require('../../utils/time-ago');

/**
 * Discord user badge flag mappings
 */
const USER_BADGES = {
  Staff: '<:staff:1234567890> Discord Staff',
  Partner: '<:partner:1234567890> Partner',
  Hypesquad: '🎉 HypeSquad Events',
  BugHunterLevel1: '🐛 Bug Hunter',
  BugHunterLevel2: '🐛 Bug Hunter Gold',
  HypeSquadOnlineHouse1: '🏠 HypeSquad Bravery',
  HypeSquadOnlineHouse2: '🏠 HypeSquad Brilliance',
  HypeSquadOnlineHouse3: '🏠 HypeSquad Balance',
  PremiumEarlySupporter: '👑 Early Supporter',
  VerifiedDeveloper: '✅ Verified Bot Developer',
  CertifiedModerator: '🛡️ Certified Moderator',
  ActiveDeveloper: '💻 Active Developer',
};

/**
 * Get status emoji for presence status
 * @param {string} status - User status
 * @returns {string} Status emoji
 */
function getStatusEmoji(status) {
  const statusMap = {
    online: '🟢',
    idle: '🟡',
    dnd: '🔴',
    offline: '⚫',
    invisible: '⚫',
  };
  return statusMap[status] || '⚫';
}

/**
 * Capitalise first letter
 * @param {string} str - String to capitalise
 * @returns {string} Capitalised string
 */
function capitalise(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get user badges from flags
 * @param {UserFlags} flags - User flags
 * @returns {string[]} Array of badge strings
 */
function getUserBadges(flags) {
  if (!flags) return [];

  const badges = [];
  const flagBits = flags.toArray ? flags.toArray() : [];

  for (const flag of flagBits) {
    if (USER_BADGES[flag]) {
      badges.push(USER_BADGES[flag]);
    }
  }

  return badges;
}

/**
 * Get key permissions for a member
 * @param {GuildMember} member - Guild member
 * @returns {string[]} Array of key permission names
 */
function getKeyPermissions(member) {
  if (!member?.permissions) return [];

  const keyPerms = [
    'Administrator',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'ManageMessages',
    'KickMembers',
    'BanMembers',
    'MentionEveryone',
    'ModerateMembers',
  ];

  const perms = member.permissions.toArray();
  return keyPerms.filter((perm) => perms.includes(perm));
}

/**
 * Format activity for display
 * @param {Activity} activity - Discord activity
 * @returns {string} Formatted activity string
 */
function formatActivity(activity) {
  if (!activity) return 'None';

  const typeMap = {
    0: 'Playing',
    1: 'Streaming',
    2: 'Listening to',
    3: 'Watching',
    4: 'Custom Status',
    5: 'Competing in',
  };

  const activityType = typeMap[activity.type] || 'Playing';

  if (activity.type === 4) {
    // Custom status
    return activity.state || 'Custom Status';
  }

  return `${activityType} **${activity.name}**`;
}

/**
 * Get roles display string for a member
 * @param {GuildMember|null} member - Guild member
 * @returns {string} Formatted roles string
 */
function getRolesDisplay(member) {
  if (!member) return 'No roles';

  const roles = member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map((role) => `<@&${role.id}>`)
    .slice(0, 10);

  if (roles.length === 0) return 'No roles';

  const extraCount = member.roles.cache.size - 11;
  return roles.join(', ') + (extraCount > 0 ? ` +${extraCount} more` : '');
}

/**
 * Build core fields for user info embed
 * @param {User} user - Discord user
 * @param {GuildMember|null} member - Guild member
 * @param {Object} options - Additional options
 * @returns {Array} Array of embed fields
 */
function buildCoreFields(user, member, options) {
  const { joinPosition, presence } = options;
  const accountCreated = user.createdAt;
  const joinedAt = member?.joinedAt;
  const status = getStatusEmoji(presence?.status);

  return [
    { name: '👤 User', value: `${user}\n\`${user.id}\``, inline: true },
    {
      name: `${status} Status`,
      value: presence?.status ? capitalise(presence.status) : 'Offline',
      inline: true,
    },
    { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
    {
      name: '📅 Account Created',
      value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:F>\n(${getTimeAgo(accountCreated)})`,
      inline: true,
    },
    {
      name: '📥 Joined Server',
      value: joinedAt
        ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:F>\n(${getTimeAgo(joinedAt)})`
        : 'Not in server',
      inline: true,
    },
    { name: '🏅 Join Position', value: joinPosition ? `#${joinPosition}` : 'N/A', inline: true },
  ];
}

/**
 * Build optional fields for user info embed
 * @param {User} user - Discord user
 * @param {GuildMember|null} member - Guild member
 * @param {Object} options - Additional options
 * @returns {Array} Array of optional embed fields
 */
function buildOptionalFields(user, member, options) {
  const fields = [];
  const { presence } = options;
  const activity = presence?.activities?.[0];
  const badges = getUserBadges(user.flags);
  const keyPermissions = member ? getKeyPermissions(member) : [];

  if (member?.nickname) {
    fields.push({ name: '📝 Nickname', value: member.nickname, inline: true });
  }
  if (activity) {
    fields.push({ name: '🎮 Activity', value: formatActivity(activity), inline: true });
  }
  if (badges.length > 0) {
    fields.push({ name: '🎖️ Badges', value: badges.join('\n'), inline: false });
  }
  fields.push({
    name: `🎭 Roles [${member ? member.roles.cache.size - 1 : 0}]`,
    value: getRolesDisplay(member),
    inline: false,
  });
  if (keyPermissions.length > 0) {
    fields.push({
      name: '🔑 Key Permissions',
      value: keyPermissions.map((p) => `\`${p}\``).join(', '),
      inline: false,
    });
  }

  return fields;
}

/**
 * Calculate join position in guild
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Guild member
 * @returns {Promise<number>} Join position
 */
async function getJoinPosition(guild, member) {
  try {
    const members = await guild.members.fetch();
    const sortedMembers = [...members.values()].sort(
      (a, b) => a.joinedTimestamp - b.joinedTimestamp
    );
    return sortedMembers.findIndex((m) => m.id === member.id) + 1;
  } catch {
    return null;
  }
}

/**
 * Build the user info embed
 * @param {User} user - Discord user
 * @param {GuildMember|null} member - Guild member (if in server)
 * @param {Object} options - Additional options
 * @returns {Object} Discord embed object
 */
function buildUserInfoEmbed(user, member, options = {}) {
  const coreFields = buildCoreFields(user, member, options);
  const optionalFields = buildOptionalFields(user, member, options);

  return {
    color: member?.displayColor || 0x5865f2,
    author: { name: user.tag, icon_url: user.displayAvatarURL({ dynamic: true }) },
    thumbnail: { url: user.displayAvatarURL({ dynamic: true, size: 256 }) },
    fields: [...coreFields, ...optionalFields],
    footer: { text: 'Aszai Bot • User Info' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  buildUserInfoEmbed,
  getJoinPosition,
  getStatusEmoji,
  getTimeAgo,
  capitalise,
  getUserBadges,
  getKeyPermissions,
  formatActivity,
};
