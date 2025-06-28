# Usage Guide

This guide explains how to interact with Aszune AI Bot and get the most out of its features.

## Basic Interaction

Aszune AI Bot can be interacted with in two ways:

1. **Traditional Commands** - Commands that start with `!`
2. **Slash Commands** - Commands that start with `/`

## Available Commands

| Command                | Description                                              |
|------------------------|----------------------------------------------------------|
| `!help` / `/help`      | Shows a list of available commands and usage             |
| `!clearhistory` / `/clearhistory` | Clears your conversation history              |
| `!summary` / `/summary`| Summarises your current conversation in UK English       |
| `!summarise <text>`    | Summarises any provided text in UK English               |
| `!stats` / `/stats`    | Shows your usage stats (messages sent, summaries requested) |

## Asking Questions

To ask the bot a question about gaming lore, game logic, guides, or advice:

1. **Direct mention**: Mention the bot followed by your question
   ```
   @AszuneBot What's the best build for a mage in Elden Ring?
   ```

2. **Reply to the bot**: Reply to one of the bot's messages with your follow-up question

## Conversation Context

The bot maintains a conversation history for each user, allowing it to remember context from previous messages. This enables more coherent and contextual responses over time.

### Managing Your History

If you want to start a new conversation or clear your history:

```
!clearhistory
```

or

```
/clearhistory
```

## Summarizing Conversations

You can ask the bot to summarize your current conversation:

```
!summary
```

or

```
/summary
```

## Summarizing External Text

You can also ask the bot to summarize any text:

```
!summarise <your text here>
```

The bot will generate a concise summary in UK English.

## Viewing Your Stats

To see how many messages you've sent to the bot and how many summaries you've requested:

```
!stats
```

or

```
/stats
```

## Emoji Reactions

The bot will automatically add emoji reactions to your messages based on keywords it detects. For example:
- "hello" might get a 👋 reaction
- "funny" might get a 😄 reaction
- "love" might get a ❤️ reaction

These reactions are just for fun and help make interactions more engaging.

## Rate Limiting

To prevent spam, the bot enforces a short cooldown period between messages. If you try to send too many messages too quickly, the bot will remind you to wait.

## Best Practices

- Ask clear, specific questions for better results
- Provide context when necessary
- Use the summary feature to keep track of long conversations
- Clear your history when starting a completely new topic
