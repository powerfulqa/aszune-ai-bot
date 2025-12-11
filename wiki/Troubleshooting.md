# Troubleshooting

Quick solutions for common Aszune AI Bot issues.

## Quick Fixes

| Issue | Solution |
|-------|----------|
| Bot offline | Check `.env` token, restart with `pm2 restart aszune-ai` |
| No command response | Enable Message Content Intent in Discord Developer Portal |
| API errors | Verify `PERPLEXITY_API_KEY` in `.env` |
| Missing permissions | Re-invite bot with required permissions |

## Connection Issues

### Bot Not Coming Online

1. **Check token** - Verify `DISCORD_BOT_TOKEN` in `.env` (no extra spaces)
2. **Network** - Ensure outbound connections to Discord aren't blocked
3. **Discord status** - Check https://discordstatus.com/

### Bot Doesn't Respond to Commands

1. **Enable Message Content Intent** in Discord Developer Portal → Bot → Privileged Gateway Intents
2. **Check permissions** - Bot needs Read/Send Messages in the channel
3. **Use slash commands** - Try `/help` instead of `!help`

## API Issues

### Perplexity API Errors

1. **Verify API key** in `.env`
2. **Check quota** - May have reached usage limits
3. **Network** - Ensure server can reach Perplexity API

## Performance Issues

### Slow Responses

1. **Check resources** - Use `/resources` command
2. **Restart** - `pm2 restart aszune-ai`
3. **Pi users** - Enable Pi optimizations

### Memory Issues

- Restart periodically with PM2: `pm2 restart aszune-ai`
- Check conversation history size

## Common Errors

| Error | Fix |
|-------|-----|
| `Cannot find module` | Run `npm install` |
| `Disallowed intents` | Enable intents in Developer Portal |
| `Missing Permissions` | Re-invite bot with correct permissions |

## Debugging

```bash
# View logs
pm2 logs aszune-ai

# Enable debug mode (add to .env)
DEBUG=true
```

## Getting Help

1. Check [GitHub Issues](https://github.com/powerfulqa/aszune-ai-bot/issues)
2. Include: error message, steps to reproduce, Node.js version, OS
