# Command Reference

This page provides detailed documentation for all commands available in the Aszune AI Bot.

## Command Types

Aszune AI Bot supports two types of commands:

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

**Description:** Displays comprehensive Discord server analytics including user engagement statistics, command usage patterns, and system performance metrics.

**Example:**

```
/analytics
```

**Output:**
Shows real-time Discord server analytics with:
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

**Description:** Displays a comprehensive performance dashboard with real-time system status, resource utilization, and operational health metrics.

**Example:**

```
/dashboard
```

**Output:**
Shows synchronized performance dashboard with:
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

**Description:** Displays resource optimization status and recommendations for system performance improvements.

**Example:**

```
/resources
```

**Output:**
Shows resource monitoring with:
- Memory usage analysis
- Performance status
- Optimization recommendations
- System health warnings
- Resource utilization tips

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

### v1.6.0 - Analytics Integration (Current)

- **Discord Analytics Commands**: Three new commands (`/analytics`, `/dashboard`, `/resources`) provide comprehensive system monitoring directly in Discord
- **Real-time Performance Monitoring**: Live system status, resource utilization, and performance metrics
- **Server Insights**: Discord server analytics with user engagement and command usage patterns
- **Resource Optimization**: Automated recommendations for system performance improvements
- **Integrated Reporting**: All analytics features accessible without leaving Discord
- **Discord Table Formatting**: Automatic conversion of markdown tables to Discord-friendly bullet points
- **Complete Test Coverage**: All 1000 tests passing with full analytics integration coverage

### v1.5.0 - qlty Code Quality Integration

- **Complete qlty Integration**: Unified code quality tooling with 8 security and quality plugins
- **Enhanced Security Scanning**: Gitleaks, Trivy, and Semgrep integration for comprehensive security
- **Professional Documentation**: Added SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md
- **Quality Automation**: 7 new npm scripts for streamlined quality workflow
- **Code Standards**: Complexity limits (≤15 file, ≤10 function), duplication detection, zero secrets

### v1.4.1 - Code Quality Excellence & Architecture Refinement

- **Code Quality Excellence**: 94.8% reduction in ESLint issues (861 → 45)
- **Service Architecture Refactoring**: Split PerplexityService into focused classes
- **Production Code Cleanup**: Eliminated all console statements, replaced with proper logger calls
- **Code Duplication Elimination**: Systematic removal of duplicate patterns across services

### v1.4.0 - Comprehensive Testing & Coverage Enhancement

- **Unified Command Handler**: All commands now use a single, centralized handler (`commands/index.js`)
- **Comprehensive Input Validation**: All user inputs are validated and sanitized before processing
- **Enhanced Error Handling**: Robust error handling with user-friendly error messages
- **Comprehensive Testing**: 380+ tests with 82%+ coverage ensuring reliability
- **Class-based Architecture**: ConversationManager and other core components use modern class-based architecture
- **Memory Management**: Advanced memory monitoring and optimization
