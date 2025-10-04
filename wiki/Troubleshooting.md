# Troubleshooting

This guide covers common issues you might encounter while setting up and running the Aszune AI Bot,
along with their solutions.

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

   Add to your `.env` file: ```env DEBUG=true

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

1. Check the [GitHub Issues](https://github.com/chrishaycock/aszune-ai-bot/issues) for similar
   problems
2. Search the [Discord.js Guide](https://discordjs.guide/) for common Discord bot issues
3. Post a new GitHub issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Error messages/logs
   - Environment information (Node.js version, OS, etc.)
   - Any relevant code snippets

## Analytics Commands Issues

### Analytics/Dashboard Commands Show "Aszune-AI is thinking..." Indefinitely

**Symptoms:**

- `/analytics` or `/dashboard` commands hang with "thinking" status
- Commands eventually timeout without response

**Cause:** Discord API member fetching can be slow or timeout in large servers (1000+ members)

**Solutions:**

1. **Wait for Timeout**: Commands have built-in 5-second timeout with fallback estimates
2. **Check Server Size**: Large servers may experience slower member data fetching
3. **Verify Bot Permissions**: Ensure bot has "View Server Members" permission
4. **Network Issues**: Check Discord API status at https://discordstatus.com/

### Analytics Showing "Active Users: 0" Despite Server Activity

**Symptoms:**

- Analytics commands report 0 active users
- Visible members are online in the server

**Cause:** Discord member presence data not properly accessible or cached

**Solutions:**

1. **Check Bot Permissions**:
   - Ensure bot has "View Server Members" permission
   - Verify "Server Members Intent" is enabled in Discord Developer Portal
2. **Member Cache**: Bot may need time to populate member cache after restart
3. **Presence Intent**: Ensure "Presence Intent" is enabled for accurate online status
4. **Fallback Mode**: Commands use estimated data when real data unavailable

### Performance Issues with Analytics Commands

**Symptoms:**

- Slow response times from analytics commands
- High memory usage during analytics execution

**Solutions:**

1. **Raspberry Pi Optimization**: Enable Pi optimizations in config if running on limited hardware
2. **Member Limit**: Analytics commands limit to 1000 members to prevent performance issues
3. **Cache Management**: Clear member cache periodically: `guild.members.cache.clear()`
4. **Resource Monitoring**: Use `/resources` command to monitor system performance

### Summarise Command Issues (Fixed in v1.6.3)

**Symptoms:**

- `!summarise <text>` or `!summerise <text>` commands failing
- Error messages: "Invalid model 'llama-3.1-sonar-small-128k-chat'"
- API request failed with status 400 errors
- "The service is temporarily unavailable. Please try again later."

**Cause:** Perplexity changed their API model naming scheme from descriptive format to simplified
names

**Resolution History:**

- **v1.6.0-v1.6.1**: Initial API integration issues
- **v1.6.2**: First model fix attempt (`llama-3.1-sonar-small-128k-chat`)
- ✅ **v1.6.3**: Current fix using simplified model name (`sonar`)

**Current Status:** ✅ **Fixed in v1.6.3**: Updated to Perplexity's current `sonar` model naming
scheme

**If Still Experiencing Issues:**

1. **Update Required**: Ensure you're running v1.6.3 or later (`git pull origin main`)
2. **Restart Bot**: Restart your bot process (`pm2 restart aszune-ai`)
3. **Check API Key**: Verify Perplexity API key is valid and has sufficient quota
4. **Test Command**: Try `!summerise foundation` as a test
5. **Command Format**: Ensure proper format: `!summarise your text here`

**For Raspberry Pi Users:**

```bash
cd ~/aszune-ai-bot
git pull origin main
pm2 restart aszune-ai
pm2 list  # Verify version shows 1.6.3
```
