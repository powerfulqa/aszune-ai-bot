# Command Reference

All commands available in Aszune AI Bot v1.11.0.

## Web Dashboard

Access real-time monitoring at `http://localhost:3000` when the bot is running.

## Command Types

**Slash commands** (`/`) are preferred. Legacy `!` commands work for backward compatibility but are
deprecated.

### Utility Commands (NEW in v1.11.0)

| Command       | Description                                           |
| ------------- | ----------------------------------------------------- |
| `/userinfo`   | Display detailed information about a user             |
| `/serverinfo` | Display detailed information about the current server |

### Reminder Commands (NEW in v1.7.0)

| Command           | Description                                       |
| ----------------- | ------------------------------------------------- |
| `/remind`         | Set a reminder with natural language time parsing |
| `/reminders`      | List all your active reminders                    |
| `/cancelreminder` | Cancel a specific reminder by ID                  |

Legacy forms (`!remind`, `!reminders`, `!cancelreminder`) still work but are discouraged.

## Core Commands

### Help Command

**Usage:**

- `!help`
- `/help`

**Description:** Displays a list of all available commands and their basic usage information.

**Example:**

```
!help
```

**Output:**

```
Available commands:
!help - Show this help message
!clearhistory - Clear your conversation history
!summary - Summarise your current conversation
!summarise <text> or !summerise <text> - Summarise the provided text
!stats - Show your usage statistics
```

---

### Clear History Command

**Usage:**

- `!clearhistory`
- `/clearhistory`

**Description:** Clears your personal conversation history with the bot, starting a fresh
conversation context.

**Example:**

```
!clearhistory
```

**Output:**

```
Your conversation history has been cleared. What would you like to chat about?
```

---

### Summary Command

**Usage:**

- `!summary`
- `/summary`

**Description:** Generates a summary of your current conversation with the bot in UK English.

**Example:**

```
!summary
```

**Output:**

```
[Summary of the conversation in UK English]
```

**Notes:**

- Requires at least one previous message for context
- The summary is generated based on your personal conversation history
- UK English spellings and phrasing are used

---

### Summarise Text Command

**Usage:**

- `!summarise <text>`
- `!summerise <text>`

**Description:** Summarises any provided text in UK English. This command accepts arbitrary text and
generates a concise summary.

**Example:**

```
!summarise The Elder Scrolls V: Skyrim is an open-world action role-playing video game developed by Bethesda Game Studios and published by Bethesda Softworks. It is the fifth main installment in The Elder Scrolls series, following The Elder Scrolls IV: Oblivion, and was released worldwide for Microsoft Windows, PlayStation 3, and Xbox 360 on November 11, 2011. The game's main story revolves around the player's character, the Dragonborn, on their quest to defeat Alduin the World-Eater, a dragon who is prophesied to destroy the world.
```

**Output:**

```
[Concise summary of the provided text in UK English]
```

**Notes:**

- There may be a character limit for the text that can be summarised
- The summary will use UK English spellings and phrasing

---

### Stats Command

**Usage:**

- `!stats`
- `/stats`

**Description:** Displays your personal usage statistics, including the number of messages sent and
summaries requested.

**Example:**

```
!stats
```

**Output:**

```
Your Aszune AI Bot Stats:
Messages sent: 42
Summaries requested: 7
```

---

## Utility Commands

### User Info Command (NEW in v1.11.0)

**Usage:**

- `!userinfo [user]`
- `/userinfo [user]`

**Description:** Displays comprehensive information about a Discord user including account details,
server presence, roles, badges, and activity.

**Parameters:**

- `[user]` (optional): The user to get info about. Defaults to yourself if not specified.

**Example:**

```
/userinfo @Username
```

**Output:** Shows detailed user information embed with:

- **User Details**: Username, user ID, bot status
- **Status**: Current online status with emoji indicator (🟢 Online, 🟡 Idle, 🔴 DND, ⚫ Offline)
- **Account Created**: Account creation date with relative time (e.g., "5 years ago")
- **Joined Server**: Server join date with relative time and join position (#42)
- **Nickname**: Server nickname if different from username
- **Activity**: Current activity (Playing, Streaming, Listening, Watching, Custom Status)
- **Badges**: Discord badges (HypeSquad, Early Supporter, Active Developer, etc.)
- **Roles**: List of roles (up to 10 shown, with count of additional roles)
- **Key Permissions**: Administrative and moderation permissions highlighted

**Technical Details:**

- Uses Discord API `guild.members.fetch()` for member data
- Join position calculated by sorting all members by join date
- Badge detection from Discord user flags
- Presence data requires Presence Intent enabled
- Color matches user's highest role color

---

### Server Info Command (NEW in v1.11.0)

**Usage:**

- `!serverinfo`
- `/serverinfo`

**Description:** Displays comprehensive information about the current Discord server including
member statistics, channels, roles, boost status, and security settings.

**Example:**

```
/serverinfo
```

**Output:** Shows detailed server information embed with:

- **Server Overview**: Server name, ID, owner, creation date
- **Members**: Total count with breakdown (humans, bots, online estimate)
- **Channels**: Count by type (text, voice, category, forum, stage, announcement)
- **Roles**: Total roles with hoisted and managed (bot) role counts
- **Boost Status**: Tier level, boost count, and unlocked features
- **Emojis & Stickers**: Static, animated, and sticker counts
- **Security**: Verification level and content filter settings
- **Features**: Community, Verified, Partnered, Discoverable badges if present
- **Banner**: Server banner image if available

**Technical Details:**

- Uses established guild member stats utility for consistent counts
- Includes timeout protection for large servers
- Shows server description if set
- Displays server icon and banner images
- Color uses default Discord blurple (0x5865F2)

---

## Analytics Commands

### Analytics Command

**Usage:**

- `!analytics`
- `/analytics`

**Description:** Displays comprehensive Discord server analytics including user engagement
statistics, command usage patterns, and system performance metrics.

**Example:**

```
/analytics
```

**Output:** Shows real-time Discord server analytics with:

- **Active Users**: Live count of online/idle/dnd members (e.g., "Active Users: 102")
- **Server Statistics**: Total members, bot count, human member ratio
- **Activity Summary**: Member engagement patterns and presence distribution
- **Performance Metrics**: System resource usage and response times
- **Data Source**: Real Discord server data with 5-second timeout protection

**Technical Details:**

- Uses Discord API `guild.members.fetch()` for live member data
- Filters members by presence (online, idle, dnd vs offline)
- Includes timeout protection with fallback estimates for large servers
- Requires "View Server Members" and "Server Members Intent" permissions

---

### Dashboard Command

**Usage:**

- `!dashboard`
- `/dashboard`

**Description:** Displays a comprehensive performance dashboard with real-time system status,
resource utilization, and operational health metrics.

**Example:**

```
/dashboard
```

**Output:** Shows synchronized performance dashboard with:

- **Activity Section**: Same real Discord data as `/analytics` command
- **System Status**: CPU, memory, and network utilization
- **Performance Metrics**: Response times and system health indicators
- **Resource Usage**: Current system resource consumption
- **Optimisation Tips**: AI-powered performance recommendations

**Technical Details:**

- Synchronized with `/analytics` command for consistent member counts
- Uses same Discord API integration with timeout protection
- Combines real server data with system performance metrics

---

### Resources Command

**Usage:**

- `!resources`
- `/resources`

**Description:** Displays resource optimisation status and recommendations for system performance
improvements.

**Example:**

```
/resources
```

**Output:** Shows resource monitoring with:

- Memory usage analysis
- Performance status
- Optimisation recommendations
- System health warnings
- Resource utilization tips

---

### Cache Command

**Usage:**

- `!cache`
- `/cache`

**Description:** Displays comprehensive cache statistics and performance metrics for the bot's
caching system, including memory usage, hit rates, and operational statistics.

**Example:**

```
/cache
```

**Output:** Shows detailed cache statistics with:

- **Performance Metrics**: Hit rate, cache hits, and miss counts (e.g., "Hit Rate: 85%")
- **Operations Statistics**: Sets, deletes, and evictions tracking
- **Memory Usage**: Current cache memory usage and limits (e.g., "Memory Usage: 0 B / 50 MB")
- **Configuration Details**: Cache strategy and uptime (e.g., "Strategy: hybrid, Uptime: 28s")
- **Cache Entries**: Active cache entries with access counts and details

**Technical Details:**

- **Fixed in v1.6.5**: Resolved undefined values display issue
- **Service Architecture**: Uses enhanced CacheManager with proper method delegation
- **Error Handling**: Comprehensive fallback mechanisms with default values
- **Field Validation**: All fields guaranteed to display proper values (no "undefined")
- **Integration**: Works with enhanced-cache system and PerplexityService

**Before v1.6.5 (Broken):**

```
Memory Usage: undefined / undefined
Configuration: Strategy: undefined, Uptime: undefined
```

**After v1.6.5 (Fixed):**

```
Memory Usage: 0 B / 50 MB
Configuration: Strategy: hybrid, Uptime: 28s

**Field Definitions (post v1.7.0 clarity fixes):**

- **Hit Rate** – Percentage of successful cache lookups `(hits / (hits + misses)) * 100`
- **Memory Usage** – Human-readable used vs max memory (e.g., `12.3 MB / 50 MB`)
- **Evictions** – Entries removed due to memory/size constraints
- **Entry Count** – Current number of live cache entries
- **Strategy** – Active eviction strategy (e.g., `hybrid` combines age & usage)
- **Uptime** – Time since cache manager initialisation (normalised formatting)
```

---

## Reminder Commands

### Set Reminder Command

**Usage:**

- `!remind <time> <message>`
- `/remind <time> <message>`

**Description:** Sets a reminder for a specific time with a custom message. The bot will ping you
when the reminder time arrives.

**Parameters:**

- `<time>`: Natural language time expression (e.g., "in 5 minutes", "tomorrow at 3pm", "next
  friday")
- `<message>`: The reminder message (optional, defaults to "Reminder!")

**Examples:**

```
!remind in 5 minutes Check the oven
/remind tomorrow at 3pm Team meeting
!remind next friday Release day!
```

**Output:**

```
✅ Reminder set for [parsed time] - [message]
```

**Notes:**

- Supports natural language time parsing (e.g., "in 2 hours", "tomorrow", "next week")
- Timezone-aware (uses your local timezone)
- Maximum reminder time: 1 year in the future
- Minimum reminder time: 1 minute from now
- Reminders persist across bot restarts

---

### List Reminders Command

**Usage:**

- `!reminders`
- `/reminders`

**Description:** Lists all your active reminders with their scheduled times and messages.

**Example:**

```
!reminders
```

**Output:**

```
Your active reminders:
• Tomorrow at 15:00 - Team meeting
• Friday at 18:00 - Release day!
• In 2 hours - Check the oven
```

**Notes:**

- Shows reminders in chronological order
- Displays relative time (e.g., "In 2 hours") and absolute time
- Only shows your own reminders

---

### Cancel Reminder Command

**Usage:**

- `!cancelreminder <index>`
- `/cancelreminder <index>`

**Description:** Cancels a specific reminder by its index number from the reminders list.

**Parameters:**

- `<index>`: The number of the reminder to cancel (from `!reminders` list)

**Example:**

```
!reminders
Your active reminders:
• 1. Tomorrow at 15:00 - Team meeting
• 2. Friday at 18:00 - Release day!

!cancelreminder 1
```

**Output:**

```
✅ Reminder cancelled: Team meeting
```

**Notes:**

- Use `!reminders` first to see the index numbers
- Only you can cancel your own reminders
- Cancelled reminders are permanently removed

---

## Natural Language Reminders

The bot can also detect and set reminders from natural conversation. Simply mention wanting to be
reminded about something, and the bot will automatically research the information and set
appropriate reminders.

**Examples:**

```
"Remind me when Grim Dawn 2 comes out"
"Set a reminder for when Cyberpunk 2077's Phantom Liberty releases"
"Can you remind me about the next Elder Scrolls game?"
```

**How it works:**

1. **Detection**: Bot recognizes reminder requests in natural language
2. **Research**: Uses AI to look up event information and find relevant dates
3. **Extraction**: Parses dates from the research results
4. **Setting**: Automatically creates reminders for found dates
5. **Confirmation**: Confirms the reminder was set with the event details

**Notes:**

- Works with game releases, events, and other time-sensitive topics
- Automatically handles multiple dates if found
- Falls back to regular chat if no reminder intent is detected
- All the same time limits and persistence as explicit reminder commands

## Chatting with the Bot

You can chat with the bot in two ways:

1. **Direct mention**:

   ```
   @AszuneBot What's the best build for a mage in Elden Ring?
   ```

2. **Reply to the bot**: Simply reply to one of the bot's messages with your follow-up question or
   comment.

## Advanced Features

### Emoji Reactions

The bot automatically adds emoji reactions to messages based on keywords it detects. Common keywords
include:

- "hello", "hi", "hey" → 👋
- "funny", "lol", "haha" → 😄
- "love", "heart" → ❤️
- "sad", "unhappy" → 😢
- "game", "gaming" → 🎮
- "thanks", "thank you" → 🙏

### Message Features

#### Table Formatting

The bot automatically detects and formats tables in AI responses for better Discord readability:

- **Automatic Detection**: Recognizes markdown table patterns in AI responses
- **Discord Optimization**: Converts tables to organized bullet-point lists
- **Content Preservation**: Maintains all table data while improving display
- **Seamless Integration**: Works automatically without user intervention

**Example:**

```
AI Response with table:
| Command | Description |
|---------|-------------|
| /help   | Show help   |
| /stats  | Show stats  |

Becomes:
• Command: /help, Description: Show help
• Command: /stats, Description: Show stats
```

#### Long Message Chunking

When responses exceed Discord's character limits, the bot intelligently splits them:

- **Smart Boundaries**: Splits at paragraph and sentence boundaries
- **Clear Numbering**: Adds [1/3], [2/3] prefixes for sequence clarity
- **Content Integrity**: Preserves all information across multiple messages
- **URL Protection**: Keeps links intact across chunks

### Rate Limiting

To prevent spam, the bot enforces a short cooldown period (typically a few seconds) between messages
from the same user. If you send messages too quickly, the bot will remind you to wait before
responding further.

## Version Updates

### v1.11.0 - Enhanced Utility Commands (Current)

- **`/userinfo` Command**: Display comprehensive user information including account age, join
  position, roles, badges, activity, and key permissions
- **`/serverinfo` Command**: Display detailed server statistics including member breakdown, channel
  counts, boost status, emoji stats, and security settings
- **Embed Architecture**: New embed builders following established patterns for maintainability
- **Helper Functions**: Reusable utilities for badge detection, time formatting, and stats
  calculation

### v1.7.0 - Reminder System & Natural Language Processing

- **Reminder Commands**: Complete reminder system with `!remind`, `!reminders`, and
  `!cancelreminder`
- **Natural Language Reminders**: AI-powered reminder detection in conversations
- **Time Parsing**: Advanced chrono-node integration for natural language time expressions
- **Database Integration**: SQLite-based reminder persistence with automatic table creation
- **Timezone Support**: User-aware timezone handling for accurate scheduling
- **Smart Research**: Automatic information lookup for event-based reminders
- **Date Extraction**: Intelligent parsing of dates from AI research responses
- **Reminder Notifications**: Discord ping notifications when reminders trigger
- **Comprehensive Testing**: Full test coverage for reminder functionality

### v1.6.0 - Analytics Integration

- **Discord Analytics Commands**: Three new commands (`/analytics`, `/dashboard`, `/resources`)
  provide comprehensive system monitoring directly in Discord
- **Real-time Performance Monitoring**: Live system status, resource utilization, and performance
  metrics
- **Server Insights**: Discord server analytics with user engagement and command usage patterns
- **Resource Optimization**: Automated recommendations for system performance improvements
- **Integrated Reporting**: All analytics features accessible without leaving Discord
- **Discord Table Formatting**: Automatic conversion of markdown tables to Discord-friendly bullet
  points
- **Testing Status**: Analytics integration originally shipped with 1000 passing tests at ~82%
  statement coverage; current local suite: 1,231 tests (1,228 passing) – 72.6% statements / 67.1%
  branches (historical CI target 82%+; restoration in progress)

### v1.5.0 - qlty Code Quality Integration

- **Complete qlty Integration**: Unified code quality tooling with 8 security and quality plugins
- **Enhanced Security Scanning**: Gitleaks, Trivy, and Semgrep integration for comprehensive
  security
- **Professional Documentation**: Added SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md,
  CHANGELOG.md
- **Quality Automation**: 7 new npm scripts for streamlined quality workflow
- **Code Standards**: Complexity limits (≤15 file, ≤10 function), duplication detection, zero
  secrets

### v1.4.1 - Code Quality Excellence & Architecture Refinement

- **Code Quality Excellence**: 94.8% reduction in ESLint issues (861 → 45)
- **Service Architecture Refactoring**: Split PerplexityService into focused classes
- **Production Code Cleanup**: Eliminated all console statements, replaced with proper logger calls
- **Code Duplication Elimination**: Systematic removal of duplicate patterns across services

### v1.4.0 - Comprehensive Testing & Coverage Enhancement

- **Unified Command Handler**: All commands now use a single, centralized handler
  (`commands/index.js`)
- **Comprehensive Input Validation**: All user inputs are validated and sanitized before processing
- **Enhanced Error Handling**: Robust error handling with user-friendly error messages
- **Comprehensive Testing (Historical)**: Release expanded to 380+ tests achieving ~82% statement
  coverage then; current local overall: 1,231 tests (1,228 passing) – 72.6% statements / 67.1%
  branches
- **Class-based Architecture**: ConversationManager and other core components use modern class-based
  architecture
- **Memory Management**: Advanced memory monitoring and optimization
