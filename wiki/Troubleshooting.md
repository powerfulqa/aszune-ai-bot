# Troubleshooting

Quick solutions for common Aszune AI Bot issues.

## Quick Fixes

| Issue                 | Solution                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| Bot offline           | Check `.env` token, restart with `pm2 restart aszune-ai`                              |
| No command response   | Enable Message Content Intent in Discord Developer Portal                             |
| API errors            | Verify `PERPLEXITY_API_KEY` in `.env`                                                 |
| Missing permissions   | Re-invite bot with required permissions                                               |
| `.env` change ignored | PM2 kept the old value, see [Settings not taking effect](#settings-not-taking-effect) |
| `/diag` not listed    | Reload Discord (Ctrl+R) so it fetches the new command list                            |

## Connection Issues

### Bot Not Coming Online

1. **Check token** - Verify `DISCORD_BOT_TOKEN` in `.env` (no extra spaces)
2. **Network** - Ensure outbound connections to Discord aren't blocked
3. **Discord status** - Check https://discordstatus.com/

### Bot Doesn't Respond to Commands

1. **Enable Message Content Intent** in Discord Developer Portal → Bot → Privileged Gateway Intents
2. **Check permissions** - Bot needs Read/Send Messages in the channel
3. **Use slash commands** - Try `/help` instead of `!help`

## Dashboard Port Conflicts

The dashboard normally listens on `127.0.0.1:3000`. If binding fails because the port is busy or
times out, it tries up to three times before binding to an OS-assigned port on the same configured
host. It never stops the process already using the preferred port.

Check `pm2 logs aszune-ai` for `Using alternative port` or `Web dashboard started on` to find the
actual port. Update your SSH tunnel or reverse proxy to use that port, or resolve the conflict and
restart the bot to return to port 3000. The alternative port can change after a restart; dashboard
authentication requirements remain unchanged. Other bind errors, such as permission failures, are
reported without retrying or switching ports.

## API Issues

### Perplexity API Errors

1. **Verify API key** in `.env`
2. **Check quota** - May have reached usage limits
3. **Network** - Ensure server can reach Perplexity API
4. **Run `/diag live:true`** (owners only) - sends a tiny real request and shows the last call's
   latency, model, tokens, cost or the exact error

User-facing messages:

- "The AI took too long to answer": the request passed the 120-second timeout
  (`RATE_LIMITS.API_TIMEOUT_MS`); agent runs that search and read pages are usually 5-60 seconds
- "The AI could not finish an answer": the agent returned no text (step or token budget used up);
  try again or rephrase

### Settings Not Taking Effect

PM2 stores the environment from when the bot was first started, and `dotenv` never overrides a
variable that already exists, so an edited `.env` can be ignored. `/diag` shows this under **Config
source**. Fix it with `VAR=value pm2 restart aszune-ai --update-env` followed by `pm2 save`.

### `/diag` Missing or Refused

- The bot registers commands globally at start-up; if `/diag` is not offered, reload Discord
  (Ctrl+R, or restart the mobile app) and check Server Settings → Integrations for command
  overrides.
- "owner-only": add the Discord user ID from that reply to `BOT_OWNER_IDS` and restart as above.

## Performance Issues

### Slow Responses

1. **Check resources** - Use `/resources` command
2. **Restart** - `pm2 restart aszune-ai`
3. **Pi users** - Enable Pi optimisations

### Memory Issues

- Restart periodically with PM2: `pm2 restart aszune-ai`
- Check conversation history size

## Common Errors

| Error                 | Fix                                    |
| --------------------- | -------------------------------------- |
| `Cannot find module`  | Run `npm install`                      |
| `Disallowed intents`  | Enable intents in Developer Portal     |
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
