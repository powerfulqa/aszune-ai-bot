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

Aszune AI Bot primarily uses **slash commands** (start with `/`). A limited set of legacy `!`
commands is still recognised for backward compatibility.

## Available Commands

### Core Commands

| Command                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| `/help`                       | Shows a list of available commands and usage                |
| `/clearhistory`               | Clears your conversation history                            |
| `/summary`                    | Summarises your current conversation in UK English          |
| `/summarise <text>`           | Summarises any provided text in UK English                  |
| `/stats`                      | Shows your usage stats (messages sent, summaries requested) |
| Legacy: `!help`, `!clearhistory`, `!summary`, `!summarise`, `!stats` | Limited support         |

### Analytics Commands (NEW)

| Command        | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `/analytics`   | Show Discord server analytics and performance insights          |
| `/dashboard`   | Display comprehensive performance dashboard with real-time data |
| `/resources`   | View resource optimization status and recommendations           |
| Legacy: `!analytics`, `!dashboard`, `!resources` | Limited support               |

### Reminder Commands (NEW)

| Command                     | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `/remind <time> <message>`  | Set a reminder for a specific time with custom message |
| `/reminders`                | List all your active reminders                         |
| `/cancelreminder <index>`   | Cancel a specific reminder by index number             |
| Legacy: `!remind`, `!reminders`, `!cancelreminder` | Limited support             |

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
/clearhistory
```

## Summarizing Conversations

You can ask the bot to summarize your current conversation:

```text
/summary
```

## Summarizing External Text

You can also ask the bot to summarize any text:

```text
/summarise <your text here>
```

or

```text
!summerise <your text here>
```

The bot will generate a concise summary in UK English.

## Viewing Your Stats

To see how many messages you've sent to the bot and how many summaries you've requested:

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

## Using Reminder Features

### Setting Reminders

You can set reminders in two ways:

#### Explicit Commands

Use the `/remind` command with natural language time expressions:

```text
/remind in 5 minutes Check the oven
/remind tomorrow at 3pm Team meeting
/remind next friday Release day!
```

#### Natural Language

Simply chat with the bot about wanting to be reminded about something:

```text
"Remind me when Grim Dawn 2 comes out"
"Can you remind me about the next Elder Scrolls game?"
"Set a reminder for when Cyberpunk 2077's Phantom Liberty releases"
```

The bot will automatically research the information, find relevant dates, and set reminders for you.

### Managing Reminders

#### Viewing Your Reminders

```text
/reminders
```

This shows all your active reminders in chronological order.

#### Cancelling Reminders

```text
/reminders  # First see the list with index numbers
/cancelreminder 1  # Cancel the first reminder
```

### Reminder Features

- **Natural Language Time**: Supports expressions like "in 2 hours", "tomorrow", "next week"
- **Timezone Aware**: Uses your local timezone for scheduling
- **Persistent**: Reminders survive bot restarts
- **Smart Research**: Bot looks up event information automatically
- **Multiple Dates**: Can set reminders for multiple dates found in research
- **User Notifications**: Bot will ping you when reminders trigger

### Time Limits

- **Minimum**: 1 minute from now
- **Maximum**: 1 year in the future
- **Precision**: Supports minutes, hours, days, weeks, months, years

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

## Version Updates

### v1.8.0 – Dashboard & Coverage Policy (Current)

- **Web Dashboard**: Optional Express + Socket.io dashboard at `http://localhost:3000` showing
  live metrics and actual outputs for `/stats`, `/analytics`, `/cache`, `/dashboard`, `/resources`,
  and `/reminders`, plus a read‑only database viewer and recommendations.
- **Coverage Policy**: Dual thresholds—≥80% for critical runtime files and ≥65% global baseline,
  with a roadmap toward 82%+.
- **Complexity Reduction**: Refactors across chat, cache, and error handling to align with ≤10
  function complexity targets.

### v1.6.0 – Analytics Integration

- **Discord Analytics Commands**: `/analytics`, `/dashboard`, and `/resources` provide comprehensive
  server monitoring directly in Discord.
- **Real‑time Performance Monitoring**: Live system status, resource utilisation, and performance
  metrics.
- **Resource Optimization**: Automated recommendations for performance improvements.
