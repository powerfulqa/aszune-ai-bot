# Release Notes v1.11.0

**Release Date:** January 7, 2026

## 🎯 Overview

Version 1.11.0 introduces enhanced utility commands for user and server information display. These
commands provide detailed Discord metadata in beautifully formatted embeds, complementing the bot's
AI-focused capabilities.

## ✨ New Features

### `/userinfo` Command

Display comprehensive information about any Discord user:

- **User Details**: Username, ID, account creation date
- **Server Presence**: Join date, join position, nickname
- **Status & Activity**: Current status, playing/streaming activity
- **Roles**: All roles with role count (limited display for readability)
- **Badges**: Discord badges (HypeSquad, Early Supporter, etc.)
- **Key Permissions**: Admin, Mod, and management permissions highlighted
- **Avatar**: High-resolution user avatar display

**Usage:**

```
/userinfo [user]
```

**Example Output:**

```
👤 User: @Username#1234
   Status: 🟢 Online
   Account Created: January 1, 2020 (5 years ago)
   Joined Server: March 15, 2021 (#42)
   Roles [5]: @Admin, @Member, +3 more
   Activity: Playing Valorant
```

### `/serverinfo` Command

Display detailed information about the current Discord server:

- **Server Overview**: Name, ID, owner, creation date
- **Member Statistics**: Total, humans, bots, online estimate
- **Channel Breakdown**: Text, voice, categories, forums, stage channels
- **Role Information**: Total roles, hoisted, managed (bot) roles
- **Boost Status**: Tier level, boost count, unlocked features
- **Emoji & Sticker Stats**: Static, animated, and sticker counts
- **Security Settings**: Verification level, content filter
- **Server Features**: Community, Verified, Partnered badges

**Usage:**

```
/serverinfo
```

**Example Output:**

```
👑 Owner: @ServerOwner
📅 Created: March 2020 (5 years ago)
👥 Members [1,234]: 1,200 Humans, 34 Bots
💬 Channels [50]: 30 Text, 10 Voice, 5 Categories
💎 Boost Status: Level 2 (15 Boosts)
```

## 📁 New Files

| File                                                                               | Description                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| [src/commands/embeds/userinfo-embed.js](src/commands/embeds/userinfo-embed.js)     | User info embed builder with badge detection       |
| [src/commands/embeds/serverinfo-embed.js](src/commands/embeds/serverinfo-embed.js) | Server info embed builder with comprehensive stats |

## 🔧 Technical Details

### Embed Architecture

Both commands follow the established embed builder pattern:

```javascript
// Embed builders are separated from command logic
const { buildUserInfoEmbed, buildServerInfoEmbed } = require('./embeds');

// Commands delegate to embed builders
const embed = buildUserInfoEmbed(user, member, { joinPosition, presence });
```

### Helper Functions

**userinfo-embed.js exports:**

- `buildUserInfoEmbed()` - Main embed builder
- `getJoinPosition()` - Calculate member join position
- `getStatusEmoji()` - Status to emoji mapping
- `getTimeAgo()` - Human-readable time formatting
- `getUserBadges()` - Discord badge flag parsing
- `getKeyPermissions()` - Important permission extraction
- `formatActivity()` - Activity type formatting

**serverinfo-embed.js exports:**

- `buildServerInfoEmbed()` - Main embed builder
- `getVerificationLevel()` - Verification level display
- `getContentFilter()` - Content filter level display
- `getBoostTier()` - Boost tier formatting
- `getChannelCounts()` - Channel type breakdown
- `getRoleStats()` - Role statistics
- `getEmojiStats()` - Emoji statistics

### Error Handling

Both commands implement proper error handling following project conventions:

```javascript
try {
  await interaction.deferReply();
  // ... command logic
} catch (error) {
  logger.error('Error fetching user info:', error);
  const errorResponse = ErrorHandler.handleError(error, 'userinfo_command');
  return interaction.editReply({ content: errorResponse.message });
}
```

## 📊 Updated Help Command

The `/help` command now includes the new utility commands:

```
/userinfo [user] - Show detailed user information
/serverinfo - Show detailed server information
```

## 🧪 Testing

New test files should be created for:

- `__tests__/unit/commands/userinfo.test.js`
- `__tests__/unit/commands/serverinfo.test.js`
- `__tests__/unit/embeds/userinfo-embed.test.js`
- `__tests__/unit/embeds/serverinfo-embed.test.js`

## 📝 Migration Notes

- No breaking changes
- Slash commands auto-register on bot restart
- Legacy text commands (`!userinfo`, `!serverinfo`) also supported

## 🎮 Why These Commands?

Based on competitive analysis of popular Discord bots, user and server info commands are standard
utility features that users expect. While Aszune AI Bot's primary focus is AI-powered conversations,
these utility commands provide:

1. **Quick Reference**: Users can quickly look up member details
2. **Server Overview**: Admins get a snapshot of server statistics
3. **Feature Completeness**: Standard bot features users expect
4. **Complement Mee6**: Works alongside Mee6 for moderation without overlap

## 🔜 What's Next

Future enhancements may include:

- `/avatar` command for quick avatar display
- `/roleinfo` command for role details
- Enhanced AI integration with user context
