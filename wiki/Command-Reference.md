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

### Rate Limiting

To prevent spam, the bot enforces a short cooldown period (typically a few seconds) between messages
from the same user. If you send messages too quickly, the bot will remind you to wait before
responding further.

## v1.4.0 Updates

### Enhanced Command System

- **Unified Command Handler**: All commands now use a single, centralized handler
  (`commands/index.js`)
- **Comprehensive Input Validation**: All user inputs are validated and sanitized before processing
- **Enhanced Error Handling**: Robust error handling with user-friendly error messages
- **Improved Testing**: Complete test coverage for all command scenarios

### New Features

- **Input Sanitization**: Automatic cleaning of user inputs to prevent errors
- **Enhanced Validation**: Comprehensive validation for all command parameters
- **Better Error Messages**: Clear, actionable error messages for users
- **Performance Optimization**: Optimized command processing for better responsiveness

### Technical Improvements

- **Class-based Architecture**: ConversationManager and other core components use modern class-based
  architecture
- **Modular Design**: Enhanced modularity for better maintainability
- **Comprehensive Testing**: 380+ tests with 82%+ coverage ensuring reliability
- **Memory Management**: Advanced memory monitoring and optimization
