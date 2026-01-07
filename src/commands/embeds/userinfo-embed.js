/**
 * User Info embed builder
 * Generates Discord embed for /userinfo command
 */

const { EmbedBuilder } = require('discord.js');

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
 * Format time ago string
 * @param {Date} date - Date to format
 * @returns {string} Formatted time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  } else if (diffMonths > 0) {
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
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
 * Calculate join position in guild
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Guild member
 * @returns {Promise<number>} Join position
 */
async function getJoinPosition(guild, member) {
  try {
    const members = await guild.members.fetch();
    const sortedMembers = [...members.values()].sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
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
  const { joinPosition, presence } = options;

  // Calculate account age
  const accountCreated = user.createdAt;
  const accountAge = getTimeAgo(accountCreated);

  // Calculate server join info
  const joinedAt = member?.joinedAt;
  const joinAge = joinedAt ? getTimeAgo(joinedAt) : 'Not in server';

  // Get roles (excluding @everyone)
  let rolesDisplay = 'No roles';
  if (member) {
    const roles = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => `<@&${role.id}>`)
      .slice(0, 10);

    if (roles.length > 0) {
      rolesDisplay =
        roles.join(', ') + (member.roles.cache.size > 11 ? ` +${member.roles.cache.size - 11} more` : '');
    }
  }

  // Get key permissions
  const keyPermissions = member ? getKeyPermissions(member) : [];

  // Get user badges
  const badges = getUserBadges(user.flags);

  // Get status and activity
  const status = getStatusEmoji(presence?.status);
  const activity = presence?.activities?.[0];

  // Build embed fields
  const fields = [
    {
      name: '👤 User',
      value: `${user}\n\`${user.id}\``,
      inline: true,
    },
    {
      name: `${status} Status`,
      value: presence?.status ? capitalise(presence.status) : 'Offline',
      inline: true,
    },
    {
      name: '🤖 Bot',
      value: user.bot ? 'Yes' : 'No',
      inline: true,
    },
    {
      name: '📅 Account Created',
      value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:F>\n(${accountAge})`,
      inline: true,
    },
    {
      name: '📥 Joined Server',
      value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:F>\n(${joinAge})` : 'Not in server',
      inline: true,
    },
    {
      name: '🏅 Join Position',
      value: joinPosition ? `#${joinPosition}` : 'N/A',
      inline: true,
    },
  ];

  // Add nickname if different
  if (member?.nickname) {
    fields.push({
      name: '📝 Nickname',
      value: member.nickname,
      inline: true,
    });
  }

  // Add activity if present
  if (activity) {
    fields.push({
      name: '🎮 Activity',
      value: formatActivity(activity),
      inline: true,
    });
  }

  // Add badges if any
  if (badges.length > 0) {
    fields.push({
      name: '🎖️ Badges',
      value: badges.join('\n'),
      inline: false,
    });
  }

  // Add roles
  fields.push({
    name: `🎭 Roles [${member ? member.roles.cache.size - 1 : 0}]`,
    value: rolesDisplay,
    inline: false,
  });

  // Add key permissions if any
  if (keyPermissions.length > 0) {
    fields.push({
      name: '🔑 Key Permissions',
      value: keyPermissions.map((p) => `\`${p}\``).join(', '),
      inline: false,
    });
  }

  return {
    color: member?.displayColor || 0x5865f2,
    author: {
      name: user.tag,
      icon_url: user.displayAvatarURL({ dynamic: true }),
    },
    thumbnail: {
      url: user.displayAvatarURL({ dynamic: true, size: 256 }),
    },
    fields,
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
