# Troubleshooting

This guide covers common issues you might encounter while setting up and running the Aszune AI Bot, along with their solutions.

## Connection Issues

### Bot Not Coming Online

**Symptoms:**

- Bot appears offline in Discord
- No "Discord bot is online!" message in console

**Possible Causes and Solutions:**

1. **Invalid Discord Token**
   - Double-check that your Discord bot token in the `.env` file or environment variables is correct
   - Ensure there are no extra spaces or quotation marks around the token
   - Verify the token is for the correct bot in the Discord Developer Portal

2. **Network Connectivity**
   - Check your server's internet connection
   - Ensure outbound connections to Discord API endpoints are not blocked by firewalls

3. **Discord API Issues**
   - Check Discord's status page: https://discordstatus.com/
   - Wait for Discord to resolve any ongoing API issues

4. **Incorrect Permissions**
   - Ensure your bot has been invited to the server with the correct permissions
   - Re-invite the bot using the method described in the [Getting Started](Getting-Started) guide

### Bot Connects but Doesn't Respond to Commands

**Symptoms:**

- Bot shows online, but doesn't respond to commands

**Possible Causes and Solutions:**

1. **Missing Intents**
   - Ensure the bot has the required intents enabled in the Discord Developer Portal
   - Message Content intent is required and must be specifically enabled

2. **Missing Channel Permissions**
   - Check if the bot has permission to read and send messages in the channel
   - Try using commands in a different channel

3. **Command Prefix Issue**
   - Make sure you're using the correct prefix (default is `!`)
   - Try with both capitalizations (e.g., `!Help` and `!help`)

## API Issues

### Perplexity API Errors

**Symptoms:**

- Messages like "Error communicating with Perplexity API" in the console
- Bot replies with error messages instead of AI responses

**Possible Causes and Solutions:**

1. **Invalid API Key**
   - Verify your Perplexity API key in the `.env` file
   - Make sure it's correctly formatted with no extra spaces

2. **API Usage Limits**
   - Check if you've reached your API usage limits
   - Consider upgrading your Perplexity API plan if necessary

3. **Rate Limiting**
   - If you're seeing rate limit errors, implement a delay between requests
   - Adjust the rate limiter settings in the bot configuration

4. **Network Issues**
   - Ensure your server can connect to Perplexity's API endpoints
   - Check for any proxy or firewall settings that might block connections

## Performance Issues

### Bot Responds Slowly

**Possible Causes and Solutions:**

1. **Server Resources**
   - Check if your server has sufficient CPU and memory
   - Consider upgrading your server if it's consistently at high utilization

2. **High Traffic**
   - If many users are using the bot simultaneously, consider:
     - Increasing rate limits
     - Optimizing code for performance
     - Scaling horizontally with multiple bot instances

3. **API Latency**
   - Monitor the response time from Perplexity's API
   - Consider caching responses for common queries

### Memory Leaks

**Symptoms:**

- Bot memory usage grows over time
- Bot becomes unresponsive after running for a while

**Solutions:**

- Restart the bot regularly using a cron job or PM2's restart feature
- Check the conversation history size and consider reducing the maximum history length
- Look for memory leaks in the code, especially with event listeners or timers

## Common Error Messages

### "Cannot find module 'xyz'"

```bash
Error: Cannot find module 'xyz'
```

**Solution:**

- Run `npm install` to install all dependencies
- If targeting a specific missing module: `npm install xyz`

### "Error: Disallowed intents specified"

```bash
Error [DisallowedIntents]: Privileged intent provided is not enabled or whitelisted.
```

**Solution:**

- Go to the [Discord Developer Portal](https://discord.com/developers/applications)
- Select your application
- Go to "Bot" section
- Enable the "Message Content Intent" under "Privileged Gateway Intents"

### "DiscordAPIError: Missing Permissions"

```bash
DiscordAPIError: Missing Permissions
```

**Solution:**

- Ensure the bot has proper permissions in the channel
- Re-invite the bot with the correct permissions

## Logging and Debugging

For more detailed troubleshooting:

1. **Enable Debug Mode**

   Add to your `.env` file: ```env
   DEBUG=true

   ```

   ```

2. **Check Logs**

   If using PM2:

   ```bash
   pm2 logs aszune-ai
   ```

3. **Increase Log Verbosity**

   Modify your logging level in the code or configuration.

## Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/chrishaycock/aszune-ai-bot/issues) for similar problems
2. Search the [Discord.js Guide](https://discordjs.guide/) for common Discord bot issues
3. Post a new GitHub issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Error messages/logs
   - Environment information (Node.js version, OS, etc.)
   - Any relevant code snippets
