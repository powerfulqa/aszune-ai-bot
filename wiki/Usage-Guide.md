# Usage Guide

This guide explains how to interact with Aszune AI Bot and get the most out of its features.

## What's New in v1.6.0

Version 1.6.0 introduces **Analytics Integration** - comprehensive system monitoring directly in
Discord:

### New Analytics Commands

- **`/analytics`** - Complete Discord server analytics with user engagement statistics, command
  usage patterns, and performance insights
- **`/dashboard`** - Real-time performance dashboard showing system status, resource utilization,
  and operational health
- **`/resources`** - Resource optimization monitoring with automated recommendations for performance
  improvements

### Key Features

- **Discord-Native Access**: All analytics accessible directly in Discord without external tools
- **Real-time Monitoring**: Live system metrics and performance data
- **Automated Insights**: AI-powered recommendations for optimization
- **Complete Integration**: Seamless integration with existing bot functionality
- **Discord Table Formatting**: Automatic conversion of markdown tables to readable Discord format
- **Full Test Coverage**: All 1000 tests passing with comprehensive analytics coverage

This update eliminates the need to access your Raspberry Pi directly for system monitoring -
everything is now available through Discord commands!

## Basic Interaction

Aszune AI Bot can be interacted with in two ways:

1. **Traditional Commands** - Commands that start with `!`
2. **Slash Commands** - Commands that start with `/`

## Available Commands

### Core Commands

| Command                                   | Description                                                 |
| ----------------------------------------- | ----------------------------------------------------------- |
| `!help` / `/help`                         | Shows a list of available commands and usage                |
| `!clearhistory` / `/clearhistory`         | Clears your conversation history                            |
| `!summary` / `/summary`                   | Summarises your current conversation in UK English          |
| `!summarise <text>` / `!summerise <text>` | Summarises any provided text in UK English                  |
| `!stats` / `/stats`                       | Shows your usage stats (messages sent, summaries requested) |

### Analytics Commands (NEW)

| Command                     | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `!analytics` / `/analytics` | Show Discord server analytics and performance insights          |
| `!dashboard` / `/dashboard` | Display comprehensive performance dashboard with real-time data |
| `!resources` / `/resources` | View resource optimization status and recommendations           |

## Asking Questions

To ask the bot a question about gaming lore, game logic, guides, or advice:

1. **Direct mention**: Mention the bot followed by your question

   ```text
   @AszuneBot What's the best build for a mage in Elden Ring?
   ```

2. **Reply to the bot**: Reply to one of the bot's messages with your follow-up question

## Long Responses

When the bot needs to provide a lengthy response, it will automatically split the message into
multiple parts to work within Discord's message character limits. Each part will be numbered like
`[1/3]`, `[2/3]`, `[3/3]` to indicate the sequence.

Example:

```
[1/2] This is the first part of a long response that has been automatically split by the bot's message chunking system. The chunking is done intelligently to preserve paragraph structure and sentence integrity...

[2/2] ...and this is the continuation of the response. The message chunking system ensures that words at the boundary between chunks are properly separated with spaces.
```

## Table Formatting

The bot automatically detects and formats tables in AI responses to make them more readable in
Discord. When the AI generates a response containing markdown tables, the bot converts them into
organized bullet-point lists for better Discord compatibility.

Example transformation:

```
Original table:
| Feature | Status |
|---------|--------|
| Analytics | ✅ Active |
| Monitoring | ✅ Active |

Becomes:
• Feature: Analytics, Status: ✅ Active
• Feature: Monitoring, Status: ✅ Active
```

## Conversation Context

The bot maintains a conversation history for each user, allowing it to remember context from
previous messages. This enables more coherent and contextual responses over time.

### Managing Your History

If you want to start a new conversation or clear your history:

```text
!clearhistory
```

or

```text
/clearhistory
```

## Summarizing Conversations

You can ask the bot to summarize your current conversation:

```text
!summary
```

or

```text
/summary
```

## Summarizing External Text

You can also ask the bot to summarize any text:

```text
!summarise <your text here>
```

or

```text
!summerise <your text here>
```

The bot will generate a concise summary in UK English.

## Viewing Your Stats

To see how many messages you've sent to the bot and how many summaries you've requested:

```text
!stats
```

or

```
/stats
```

## Using Analytics Features

### Server Analytics

Get comprehensive Discord server analytics and insights:

```text
/analytics
```

This shows:

- Daily activity summary
- Command usage statistics
- User engagement metrics
- Performance trends

### Performance Dashboard

View real-time system performance and health:

```text
/dashboard
```

This displays:

- System status overview
- Memory and CPU usage
- Response time metrics
- Error rates and alerts
- Performance recommendations

### Resource Monitoring

Monitor system resources and get optimization tips:

```text
/resources
```

This provides:

- Memory usage analysis
- Performance status
- Optimization recommendations
- System health warnings

## Emoji Reactions

The bot will automatically add emoji reactions to your messages based on keywords it detects. For
example:

- "hello" might get a 👋 reaction
- "funny" might get a 😄 reaction
- "love" might get a ❤️ reaction

These reactions are just for fun and help make interactions more engaging.

## Rate Limiting

To prevent spam, the bot enforces a short cooldown period between messages. If you try to send too
many messages too quickly, the bot will remind you to wait.

## Best Practices

- Ask clear, specific questions for better results
- Provide context when necessary
- Use the summary feature to keep track of long conversations
- Clear your history when starting a completely new topic
