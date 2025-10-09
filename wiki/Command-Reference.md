# Command Reference

This page provides detailed documentation for all commands available in the Aszune AI Bot.

## Command Types

Aszune AI Bot supp### Reminder Commands (NEW in v1.7.0)

| Command                                    | Description                                       |
| ------------------------------------------ | ------------------------------------------------- | -------------------------- |
| `!remind <time> <message>` / `/remind`     | Set a reminder with natural language time parsing |
| `!reminders` / `/reminders`                | List all your active reminders                    |
| `!cancelreminder <id>` / `/cancelreminder` | Cancel a specific reminder by ID                  | rts two types of commands: |

- **Traditional commands** starting with `!`
- **Slash commands** starting with `/`

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
- **Optimization Tips**: AI-powered performance recommendations

**Technical Details:**

- Synchronized with `/analytics` command for consistent member counts
- Uses same Discord API integration with timeout protection
- Combines real server data with system performance metrics

---

### Resources Command

**Usage:**

- `!resources`
- `/resources`

**Description:** Displays resource optimization status and recommendations for system performance
improvements.

**Example:**

```
/resources
```

**Output:** Shows resource monitoring with:

- Memory usage analysis
- Performance status
- Optimization recommendations
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

### v1.6.0 - Analytics Integration (Current)

- **Discord Analytics Commands**: Three new commands (`/analytics`, `/dashboard`, `/resources`)
  provide comprehensive system monitoring directly in Discord
- **Real-time Performance Monitoring**: Live system status, resource utilization, and performance
  metrics
- **Server Insights**: Discord server analytics with user engagement and command usage patterns
- **Resource Optimization**: Automated recommendations for system performance improvements
- **Integrated Reporting**: All analytics features accessible without leaving Discord
- **Discord Table Formatting**: Automatic conversion of markdown tables to Discord-friendly bullet
  points
- **Complete Test Coverage**: All 1000 tests passing with full analytics integration coverage

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
- **Comprehensive Testing**: 380+ tests with 82%+ coverage ensuring reliability
- **Class-based Architecture**: ConversationManager and other core components use modern class-based
  architecture
- **Memory Management**: Advanced memory monitoring and optimization
