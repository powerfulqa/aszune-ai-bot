/**
 * Server Info embed builder
 * Generates Discord embed for /serverinfo command
 */

/**
 * Get verification level display string
 * @param {GuildVerificationLevel} level - Verification level
 * @returns {string} Human-readable verification level
 */
function getVerificationLevel(level) {
  const levels = {
    0: 'None',
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Very High',
  };
  return levels[level] || 'Unknown';
}

/**
 * Get content filter level display string
 * @param {GuildExplicitContentFilter} level - Content filter level
 * @returns {string} Human-readable content filter level
 */
function getContentFilter(level) {
  const filters = {
    0: 'Disabled',
    1: 'Members without roles',
    2: 'All members',
  };
  return filters[level] || 'Unknown';
}

/**
 * Get boost tier display
 * @param {GuildPremiumTier} tier - Premium tier
 * @returns {string} Boost tier display string
 */
function getBoostTier(tier) {
  const tiers = {
    0: 'No Level',
    1: 'Level 1',
    2: 'Level 2',
    3: 'Level 3',
  };
  return tiers[tier] || 'Unknown';
}

/**
 * Get boost tier emoji
 * @param {GuildPremiumTier} tier - Premium tier
 * @returns {string} Boost tier emoji
 */
function getBoostEmoji(tier) {
  const emojis = {
    0: '⬛',
    1: '🟪',
    2: '💜',
    3: '💎',
  };
  return emojis[tier] || '⬛';
}

/**
 * Format channel counts by type
 * @param {Guild} guild - Discord guild
 * @returns {Object} Channel counts
 */
function getChannelCounts(guild) {
  const channels = guild.channels.cache;

  return {
    text: channels.filter((c) => c.type === 0).size,
    voice: channels.filter((c) => c.type === 2).size,
    category: channels.filter((c) => c.type === 4).size,
    stage: channels.filter((c) => c.type === 13).size,
    forum: channels.filter((c) => c.type === 15).size,
    announcement: channels.filter((c) => c.type === 5).size,
    thread: channels.filter((c) => [11, 12].includes(c.type)).size,
    total: channels.size,
  };
}

/**
 * Get role statistics
 * @param {Guild} guild - Discord guild
 * @returns {Object} Role stats
 */
function getRoleStats(guild) {
  const roles = guild.roles.cache;
  const managedRoles = roles.filter((r) => r.managed).size;
  const hoistedRoles = roles.filter((r) => r.hoist).size;

  return {
    total: roles.size - 1, // Exclude @everyone
    managed: managedRoles,
    hoisted: hoistedRoles,
  };
}

/**
 * Get emoji statistics
 * @param {Guild} guild - Discord guild
 * @returns {Object} Emoji stats
 */
function getEmojiStats(guild) {
  const emojis = guild.emojis.cache;

  return {
    total: emojis.size,
    animated: emojis.filter((e) => e.animated).size,
    static: emojis.filter((e) => !e.animated).size,
  };
}

/**
 * Get sticker statistics
 * @param {Guild} guild - Discord guild
 * @returns {Object} Sticker stats
 */
function getStickerStats(guild) {
  const stickers = guild.stickers.cache;

  return {
    total: stickers.size,
  };
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
 * Build core server info fields
 * @param {Guild} guild - Discord guild
 * @param {Object} memberStats - Member statistics
 * @returns {Array} Array of embed fields
 */
function buildCoreFields(guild, memberStats) {
  const createdAt = guild.createdAt;
  const totalMembers = guild.memberCount || 0;
  const onlineMembers = memberStats.onlineCount || Math.floor(totalMembers * 0.2);
  const botCount = memberStats.botCount || 0;
  const humanCount = memberStats.humanMembers || totalMembers - botCount;

  return [
    { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
    { name: '📅 Created', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:D>\n(${getTimeAgo(createdAt)})`, inline: true },
    { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
    { name: `👥 Members [${totalMembers}]`, value: `👤 Humans: ${humanCount}\n🤖 Bots: ${botCount}\n🟢 Online: ~${onlineMembers}`, inline: true },
  ];
}

/**
 * Build channel and role fields
 * @param {Guild} guild - Discord guild
 * @returns {Array} Array of embed fields
 */
function buildChannelRoleFields(guild) {
  const channelCounts = getChannelCounts(guild);
  const roleStats = getRoleStats(guild);

  let channelValue = `📝 Text: ${channelCounts.text}\n🔊 Voice: ${channelCounts.voice}\n📂 Categories: ${channelCounts.category}`;
  if (channelCounts.forum > 0) channelValue += `\n💬 Forums: ${channelCounts.forum}`;
  if (channelCounts.stage > 0) channelValue += `\n🎭 Stage: ${channelCounts.stage}`;

  return [
    { name: `💬 Channels [${channelCounts.total}]`, value: channelValue, inline: true },
    { name: `🎭 Roles [${roleStats.total}]`, value: `📌 Hoisted: ${roleStats.hoisted}\n🔗 Managed: ${roleStats.managed}`, inline: true },
  ];
}

/**
 * Build boost and emoji fields
 * @param {Guild} guild - Discord guild
 * @returns {Array} Array of embed fields
 */
function buildBoostEmojiFields(guild) {
  const boostTier = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount || 0;
  const emojiStats = getEmojiStats(guild);
  const stickerStats = getStickerStats(guild);

  let boostValue = `Tier: ${getBoostTier(boostTier)}\nBoosts: ${boostCount}`;
  if (boostTier >= 2) boostValue += '\n✅ Animated Icon';
  if (boostTier >= 3) boostValue += '\n✅ Vanity URL';

  let emojiValue = `Static: ${emojiStats.static}\nAnimated: ${emojiStats.animated}`;
  if (stickerStats.total > 0) emojiValue += `\n🏷️ Stickers: ${stickerStats.total}`;

  return [
    { name: `${getBoostEmoji(boostTier)} Boost Status`, value: boostValue, inline: true },
    { name: `😀 Emojis [${emojiStats.total}]`, value: emojiValue, inline: true },
    { name: '🔒 Security', value: `Verification: ${getVerificationLevel(guild.verificationLevel)}\nContent Filter: ${getContentFilter(guild.explicitContentFilter)}`, inline: true },
  ];
}

/**
 * Get notable features field if any
 * @param {Guild} guild - Discord guild
 * @returns {Object|null} Features field or null
 */
function getFeaturesField(guild) {
  const featureMap = {
    COMMUNITY: '🏘️ Community', VERIFIED: '✅ Verified', PARTNERED: '🤝 Partnered',
    DISCOVERABLE: '🔍 Discoverable', WELCOME_SCREEN_ENABLED: '👋 Welcome Screen',
    VANITY_URL: '🔗 Vanity URL', ANIMATED_ICON: '🎞️ Animated Icon', BANNER: '🖼️ Banner',
  };
  const notable = guild.features.filter((f) => featureMap[f]).map((f) => featureMap[f]);
  return notable.length > 0 ? { name: '✨ Features', value: notable.join(' • '), inline: false } : null;
}

/**
 * Build the server info embed
 * @param {Guild} guild - Discord guild
 * @param {Object} options - Additional options
 * @returns {Object} Discord embed object
 */
function buildServerInfoEmbed(guild, options = {}) {
  const { memberStats = {} } = options;

  const fields = [
    ...buildCoreFields(guild, memberStats),
    ...buildChannelRoleFields(guild),
    ...buildBoostEmojiFields(guild),
  ];

  const featuresField = getFeaturesField(guild);
  if (featuresField) fields.push(featuresField);

  return {
    color: 0x5865f2,
    author: { name: guild.name, icon_url: guild.iconURL({ dynamic: true }) },
    thumbnail: { url: guild.iconURL({ dynamic: true, size: 256 }) },
    description: guild.description ? `*${guild.description}*\n\n` : undefined,
    image: guild.bannerURL({ size: 512 }) ? { url: guild.bannerURL({ size: 512 }) } : undefined,
    fields,
    footer: { text: 'Aszai Bot • Server Info' },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
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
};
