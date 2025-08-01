# Technical Documentation

This page provides technical details about the architecture, code structure, and implementation of the Aszune AI Bot.

## Architecture Overview

Aszune AI Bot is built using Node.js and the Discord.js library, with the Perplexity API serving as the AI backend. The bot uses a modular architecture to separate concerns and make the codebase more maintainable.

### Core Components

1. **Discord Interface** - Handles interactions with Discord's API
2. **Command Handler** - Processes and routes commands
3. **Perplexity API Client** - Manages communication with Perplexity's API
4. **Conversation Manager** - Tracks and stores user conversations
5. **Rate Limiter** - Prevents spam and excessive API usage
6. **Emoji Manager** - Handles emoji reactions based on keywords
7. **Response Caching System** - Securely stores and retrieves responses to save API calls for repeated questions
8. **Graceful Shutdown** - Manages clean shutdown on process termination signals or errors
9. **Pi Optimisation System** - Detects Raspberry Pi hardware and applies performance optimisations. For full optimisations, start the bot using the `start-pi-optimized.sh` shell script, which sets environment variables and applies system-level tweaks before launching Node.js. For production deployments, use PM2 with the shell script as the entry point:

```bash
pm2 start start-pi-optimized.sh --name aszune-bot --interpreter bash
```

This ensures all optimisations are applied. Running `pm2 start src/index.js` will NOT enable Pi optimisations.

## Project Structure

```
aszune-ai-bot/
├── src/
│   ├── index.js           # Main entry point
│   ├── commands/          # Command handlers
│   │   ├── clearHistory.js
│   │   ├── help.js
│   │   ├── stats.js
│   │   ├── summarise.js
│   │   └── summary.js
│   ├── config/            # Configuration settings
│   │   └── config.js      # Global configuration
│   ├── services/          # API and core services
│   │   ├── perplexityService.js
│   │   └── conversationService.js
│   └── utils/             # Utility functions and helpers
│       ├── emojiUtils.js
│       ├── rateLimiter.js
│       └── stringUtils.js
├── package.json           # Project metadata
├── package-lock.json      # Dependency lock file
├── ecosystem.config.js    # PM2 deployment config
├── .env                   # Environment secrets (not committed)
├── .gitignore             # Ignored files
├── __tests__/             # Unit and integration tests
├── __mocks__/             # Test mocks
├── jest.config.js         # Jest test configuration
├── jest.setup.js          # Jest setup file
└── coverage/              # Code coverage output
```

## Response Caching System

Aszune AI Bot implements a secure file-based caching system to improve performance and reduce API calls.

### How Caching Works

1. **Cache Storage**: Responses from the Perplexity API are stored in `data/question_cache.json`
2. **Secure File Permissions**: Cache files use strict permissions (0o644 for files, 0o755 for directories)
3. **Cache Keying**: Questions are hashed using MD5 to create unique cache keys
4. **Cache Hit Behavior**: When a question matches a cached entry, the response is served immediately without calling the API
5. **Cache Pruning**: The cache is automatically pruned to maintain performance
   - Limits entries to the configured maximum (default 100)
   - Older entries are removed first
   - Weekly cleanup removes entries older than 7 days

### Caching Configuration

Caching behavior can be controlled through the Pi optimization settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `PI_OPTIMIZATIONS.CACHE_ENABLED` | Enable/disable response caching | `true` |
| `PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES` | Maximum cache entries | `100` |

Individual API calls can also override the cache behavior by setting `caching: false` in the options.

### Cache Security

All cache files are created with secure permissions:
- Files: 0o644 (Owner can read/write, others can only read)
- Directories: 0o755 (Owner can read/write/execute, others can read/execute)

This ensures that only the bot process can modify cached data while still allowing the files to be read by monitoring tools.

## Core Modules

### 1. Discord Interface (index.js)

The main entry point initializes the Discord client, sets up event handlers, and connects the bot to Discord's API.

```javascript
// Simplified example
const { Client, IntentsBitField } = require("discord.js");
const commandHandler = require("./commands");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.on("ready", () => {
  console.log("Discord bot is online!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle command or send to conversation handler
  if (message.content.startsWith("!")) {
    commandHandler.handleCommand(message);
  } else if (message.mentions.has(client.user)) {
    // Handle mention
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

### 2. Command Handler

Processes user commands and routes them to the appropriate handler function.

```javascript
// Simplified example of command handler
const commands = {
  help: require("./commands/help"),
  clearhistory: require("./commands/clearHistory"),
  summary: require("./commands/summary"),
  summarise: require("./commands/summarise"),
  stats: require("./commands/stats"),
};

function handleCommand(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (commands[command]) {
    commands[command].execute(message, args);
  } else {
    message.reply("Unknown command. Use !help to see available commands.");
  }
}
```

### 3. Perplexity API Client

Manages communication with the Perplexity AI API.

```javascript
// Simplified example
const axios = require("axios");

async function sendChatCompletion(messages) {
  try {
    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar",
        messages: messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling Perplexity API:", error);
    throw error;
  }
}
```

### 4. Conversation Manager

Tracks and manages user conversation history.

```javascript
// Simplified example
const userConversations = new Map();
const MAX_HISTORY_LENGTH = 10;

function addMessageToHistory(userId, role, content) {
  if (!userConversations.has(userId)) {
    userConversations.set(userId, []);
  }

  const history = userConversations.get(userId);
  history.push({ role, content });

  // Trim history if it exceeds maximum length
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
}

function getConversationHistory(userId) {
  return userConversations.get(userId) || [];
}

function clearConversationHistory(userId) {
  userConversations.set(userId, []);
}
```

### 5. Rate Limiter

Prevents spam by enforcing a cooldown between user messages.

```javascript
// Simplified example
const userCooldowns = new Map();
const COOLDOWN_PERIOD = 3000; // 3 seconds

function isRateLimited(userId) {
  const now = Date.now();
  const lastMessageTime = userCooldowns.get(userId) || 0;

  if (now - lastMessageTime < COOLDOWN_PERIOD) {
    return true;
  }

  userCooldowns.set(userId, now);
  return false;
}
```

### 6. Pi Optimization System

Detects Raspberry Pi hardware and applies appropriate optimizations based on the model and available resources.

```javascript
// Simplified example from pi-detector.js
async function detectPiModel() {
  try {
    // Default values if detection fails
    let result = {
      isPi: false,
      model: 'unknown',
      ram: os.totalmem() / (1024 * 1024 * 1024), // RAM in GB
      cores: os.cpus().length
    };

    // Look for Raspberry Pi specific files
    if (os.platform() === 'linux') {
      const cpuInfo = await fs.readFile('/proc/cpuinfo', 'utf8');
      
      // Check if this is a Pi
      if (cpuInfo.includes('Raspberry Pi')) {
        result.isPi = true;
        
        // Extract model information
        if (cpuInfo.includes('BCM2835')) {
          result.model = result.ram < 1 ? 'pi3' : 'pi4';
        } else if (cpuInfo.includes('BCM2711')) {
          result.model = 'pi4';
        } else if (cpuInfo.includes('BCM2712')) {
          result.model = 'pi5';
        }
      }
    }
    
    return result;
  } catch (error) {
    return { isPi: false, model: 'unknown' };
  }
}

// Apply optimizations based on detected model
function generateOptimizedConfig(detectedPi) {
  // Base configuration
  const config = { ENABLED: true, MAX_CONNECTIONS: 2 };
  
  // Model-specific optimizations
  switch (detectedPi.model) {
    case 'pi3':
      // Most conservative settings
      config.LOW_CPU_MODE = true;
      config.MAX_CONNECTIONS = 1;
      break;
    case 'pi4':
      // Balanced settings based on RAM
      if (detectedPi.ram >= 4) {
        config.MAX_CONNECTIONS = 5;
      }
      break;
    case 'pi5':
      // Most performant settings
      config.MAX_CONNECTIONS = detectedPi.ram >= 8 ? 10 : 8;
      break;
  }
  
  return config;
}
```

## Environment Configuration

The bot uses environment variables for configuration, stored in a `.env` file:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

## Testing Framework

The project uses Jest for testing, with separate test files for each module:

```javascript
// Example test for the emoji utility
const { addEmojiReactions } = require("../src/utils/emojiUtils");

describe("Emoji Utilities", () => {
  test('should add correct emoji for keyword "hello"', async () => {
    const message = {
      content: "Hello everyone!",
      react: jest.fn().mockResolvedValue(true),
    };

    await addEmojiReactions(message);
    expect(message.react).toHaveBeenCalledWith("👋");
  });
});
```

> For comprehensive information about testing, see the [Testing Guide](Testing-Guide) and [CI/CD Pipeline](CI-CD-Pipeline) pages.

## Performance Considerations

- Uses JavaScript `Map` for conversation history and rate limiting for efficient lookups
- Implements proper error handling for API calls
- Uses async/await for non-blocking operations

## Graceful Shutdown Implementation

The bot implements a robust shutdown mechanism that:

1. Captures system signals (SIGINT, SIGTERM) for graceful shutdown
2. Handles uncaught exceptions and unhandled promise rejections
3. Prevents multiple simultaneous shutdown attempts with an isShuttingDown flag
4. Performs cleanup operations in the correct order:
   - Saves conversation history and user stats
   - Destroys the Discord client connection
   - Logs any errors that occur during shutdown
5. Uses error counting to return appropriate exit codes
6. Ensures proper resource cleanup

```javascript
// Flag to prevent multiple shutdown executions
let isShuttingDown = false;

// Example of the shutdown handler
async function shutdown(signal) {
  // Prevent multiple simultaneous shutdown attempts
  if (isShuttingDown) {
    logger.info(`Shutdown already in progress. Ignoring additional ${signal} signal.`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Track any errors that occur during shutdown
  const errors = [];
  let shutdownStatus = true;
  
  try {
    // Clean up conversation manager (save stats, clear timers)
    await conversationManager.destroy();
  } catch (error) {
    shutdownStatus = false;
    errors.push(error);
    logger.error('Error shutting down conversation manager', error);
  }
  
  try {
    // Destroy Discord client connection
    await client.destroy();
    logger.info('Discord client destroyed');
  } catch (error) {
    shutdownStatus = false;
    errors.push(error);
    logger.error('Shutdown error', error);
  }
  
  // Log individual errors for easier debugging
  if (errors.length > 0) {
    errors.forEach((err, index) => {
      logger.error(`Shutdown error ${index + 1}/${errors.length}:`, err);
    });
    logger.error(`Shutdown completed with ${errors.length} error(s)`);
    process.exit(1);
  } else {
    logger.info('Shutdown complete.');
    process.exit(0);
  }
}
```

## Security Considerations

- Sensitive information is stored in environment variables, not in code
- API keys and tokens are never exposed in responses
- Rate limiting prevents abuse
- Input validation is performed before processing commands

## Future Technical Enhancements

- Database integration for persistent conversation storage
- Webhook support for external integrations
- Support for more complex conversation flows
- Enhanced error handling with automatic recovery

## v1.3.0 Enhanced Testing & Code Quality (2025-08-01)

- Fixed logger branch coverage testing, improving coverage from 57.89% to 82.45%.
- Resolved "duplicate manual mock found: discord" warning by reorganizing mock files.
- Implemented proper mocking for fs.promises methods with a centralized approach.
- Refactored complex functions into smaller, more maintainable units:
  - Improved the `generateChatResponse` function with better helper methods
  - Refactored `_safeGetHeader` to follow better coding practices
- Consolidated duplicate code between perplexity service implementations.
- Created a unified `perplexity-improved.js` module with better organization.
- Fixed security issues related to permissions and API validation.
- Added ESLint configuration for consistent code style.
- Added new npm scripts for linting and fixing code style issues.

## v1.2.2 Refactor & Reliability Update (2025-07-30)

- ConversationManager is now exported as a class and must be instantiated everywhere.
- All config access is now inside methods, preventing circular dependency issues.
- All code and tests updated to use the new ConversationManager pattern.
- Test suite expectations relaxed and fixed; all tests now pass and CI is reliable.
- Documentation and release notes updated to match codebase and version.
