# Technical Documentation

This page provides technical details about the architecture, code structure, and implementation of
the Aszune AI Bot.

## Architecture Overview

Aszune AI Bot is built using Node.js and the Discord.js library, with the Perplexity API serving as
the AI backend. The bot uses a modular architecture to separate concerns and make the codebase more
maintainable.

### Core Components

1. **Discord Interface** - Handles interactions with Discord's API
2. **Command Handler** - Processes and routes commands (both text and slash commands)
3. **Service-Oriented Perplexity API** - Modular service architecture with focused classes:
   - **ApiClient** - HTTP requests and API communication
   - **CacheManager** - Response caching and cleanup management
   - **ResponseProcessor** - API response processing and formatting
   - **ThrottlingService** - Rate limiting and connection throttling
4. **Conversation Manager** - Tracks and stores user conversations with class-based architecture
5. **Rate Limiter** - Prevents spam and excessive API usage
6. **Emoji Manager** - Handles emoji reactions based on keywords
7. **Enhanced Message Chunker** - Intelligently splits long messages into multiple chunks while
   preserving content and formatting with advanced boundary detection
8. **Response Caching System** - Securely stores and retrieves responses to save API calls for
   repeated questions
9. **Error Handler** - Comprehensive error handling and recovery system
10. **Input Validator** - Enhanced input sanitization and validation system with common helpers
11. **Memory Monitor** - Advanced memory usage tracking and garbage collection
12. **Performance Monitor** - Real-time performance tracking and optimization
13. **Storage Service** - Data persistence and management
14. **Graceful Shutdown** - Manages clean shutdown on process termination signals or errors
15. **Logging Infrastructure** - Comprehensive logging system replacing all console statements
16. **Pi Optimisation System** - Detects Raspberry Pi hardware and applies performance
    optimisations. For full optimisations, start the bot using the `start-pi-optimized.sh` shell
    script, which sets environment variables and applies system-level tweaks before launching
    Node.js. For production deployments, use PM2 with the shell script as the entry point:

```bash
pm2 start start-pi-optimized.sh --name aszune-bot --interpreter bash
```

This ensures all optimisations are applied. Running `pm2 start src/index.js` will NOT enable Pi
optimisations.

## Project Structure

```
aszune-ai-bot/
├── src/
│   ├── index.js                    # Main entry point
│   ├── commands/                   # Command handlers
│   │   └── index.js               # Unified command handler
│   ├── config/                     # Configuration settings
│   │   └── config.js              # Global configuration
│   ├── services/                   # API and core services
│   │   ├── chat.js                # Chat message handler
│   │   ├── perplexity-secure.js   # Perplexity API service with caching
│   │   └── storage.js             # Data storage service
│   └── utils/                      # Utility functions and helpers
│       ├── conversation.js         # Conversation management (class-based)
│       ├── error-handler.js        # Error handling utilities
│       ├── input-validator.js      # Input validation and sanitization
│       ├── logger.js               # Logging utilities
│       ├── memory-monitor.js       # Memory monitoring and GC
│       ├── message-chunker.js      # Basic message chunking
│       ├── message-chunking/       # Enhanced chunking system
│       │   ├── index.js           # Main chunking coordinator
│       │   ├── chunk-boundary-handler.js
│       │   ├── source-reference-processor.js
│       │   └── url-formatter.js
│       ├── pi-detector.js          # Raspberry Pi detection
│       ├── performance-monitor.js  # Performance tracking
│       ├── cache-pruner.js         # Cache management
│       ├── connection-throttler.js # Connection limiting
│       ├── debouncer.js            # Message debouncing
│       ├── lazy-loader.js          # Lazy loading utilities
│       └── [other utilities]       # Additional utility modules
├── data/                           # Persistent data storage
│   ├── question_cache.json        # Response cache
│   └── user_stats.json            # User statistics
├── scripts/                        # Development and utility scripts
│   ├── test-chunking.js           # Test script for message chunking
│   ├── test-chunking.bat          # Windows batch file to run chunking test
│   └── test-chunking.sh           # Unix shell script to run chunking test
├── docs/                          # Documentation and version-specific release notes
│   ├── README.md                  # Index of available release notes
│   ├── v1.3.0.md                 # Version 1.3.0 release notes
│   ├── v1.3.1.md                 # Version 1.3.1 release notes
│   ├── v1.3.2.md                 # Version 1.3.2 release notes
│   └── v1.4.0.md                 # Version 1.4.0 release notes
├── wiki/                          # Comprehensive documentation
├── __tests__/                     # Test suites
│   ├── integration/               # Integration tests
│   ├── unit/                      # Unit tests
│   └── utils/                     # Test utilities
├── __mocks__/                     # Test mocks
├── coverage/                      # Code coverage reports
├── package.json                   # Project metadata
├── package-lock.json              # Dependency lock file
├── ecosystem.config.js            # PM2 deployment config
├── jest.config.js                 # Jest test configuration
├── jest.setup.js                  # Jest setup file
├── RELEASE-NOTES.md               # Master release notes
└── .env                           # Environment secrets (not committed)
```

## Response Caching System

Aszune AI Bot implements a secure file-based caching system to improve performance and reduce API
calls.

### How Caching Works

1. **Cache Storage**: Responses from the Perplexity API are stored in `data/question_cache.json`
2. **Secure File Permissions**: Cache files use strict permissions (0o644 for files, 0o755 for
   directories)
3. **Cache Keying**: Questions are hashed using MD5 to create unique cache keys
4. **Cache Hit Behavior**: When a question matches a cached entry, the response is served
   immediately without calling the API
5. **Cache Pruning**: The cache is automatically pruned to maintain performance
   - Limits entries to the configured maximum (default 100)
   - Older entries are removed first
   - Weekly cleanup removes entries older than 7 days

### Caching Configuration

Caching behavior can be controlled through the Pi optimization settings:

| Setting                              | Description                     | Default |
| ------------------------------------ | ------------------------------- | ------- |
| `PI_OPTIMIZATIONS.CACHE_ENABLED`     | Enable/disable response caching | `true`  |
| `PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES` | Maximum cache entries           | `100`   |

Individual API calls can also override the cache behavior by setting `caching: false` in the
options.

### Cache Security

All cache files are created with secure permissions:

- Files: 0o644 (Owner can read/write, others can only read)
- Directories: 0o755 (Owner can read/write/execute, others can read/execute)

This ensures that only the bot process can modify cached data while still allowing the files to be
read by monitoring tools.

## Enhanced Architecture (v1.4.0+)

### New Utility Modules

The bot now includes a comprehensive set of utility modules for enhanced functionality:

#### Error Handling System

- **`error-handler.js`**: Centralized error handling with context-aware error messages
- Comprehensive error recovery mechanisms
- Structured error logging and reporting
- Graceful degradation for API failures

#### Input Validation System

- **`input-validator.js`**: Input sanitization and validation
- Prevents malicious input and ensures data integrity
- Configurable validation rules for different input types
- Comprehensive error reporting for invalid inputs

#### Memory Management

- **`memory-monitor.js`**: Advanced memory usage tracking
- Automatic garbage collection triggers
- Memory limit monitoring and alerts
- Resource usage optimization

#### Performance Monitoring

- **`performance-monitor.js`**: Real-time performance tracking
- API response time monitoring
- Resource utilization metrics
- Performance optimization recommendations

#### Enhanced Caching System

- **`cache-pruner.js`**: Intelligent cache management
- **`enhanced-cache.js`**: Advanced caching with TTL and size limits
- Automatic cache cleanup and optimization
- Memory-efficient cache storage

#### Connection Management

- **`connection-throttler.js`**: Network connection limiting
- **`debouncer.js`**: Message debouncing to prevent spam
- Adaptive throttling based on system load
- Resource-constrained device optimization

#### Lazy Loading System

- **`lazy-loader.js`**: On-demand module loading
- Reduces initial memory footprint
- Improves startup performance
- Dynamic dependency management

## Core Modules

### 1. Discord Interface (index.js)

The main entry point initializes the Discord client, sets up event handlers, and connects the bot to
Discord's API.

```javascript
// Simplified example
const { Client, IntentsBitField } = require('discord.js');
const commandHandler = require('./commands');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.on('ready', () => {
  console.log('Discord bot is online!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Handle command or send to conversation handler
  if (message.content.startsWith('!')) {
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
  help: require('./commands/help'),
  clearhistory: require('./commands/clearHistory'),
  summary: require('./commands/summary'),
  summarise: require('./commands/summarise'),
  stats: require('./commands/stats'),
};

function handleCommand(message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (commands[command]) {
    commands[command].execute(message, args);
  } else {
    message.reply('Unknown command. Use !help to see available commands.');
  }
}
```

### 3. Perplexity API Client

Manages communication with the Perplexity AI API.

```javascript
// Simplified example
const axios = require('axios');

async function sendChatCompletion(messages) {
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar',
        messages: messages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
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

### 6. Message Chunker

Handles the splitting of long messages into multiple smaller chunks to work around Discord's message
character limits while preserving content integrity and formatting.

```javascript
// Simplified example from message-chunker.js
function chunkMessage(message, maxLength = 2000) {
  // If message is already within limits, return as single chunk
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks = [];
  let currentChunk = '';

  // Account for chunk numbering prefix (e.g., "[1/2] ") in max length
  const prefixBuffer = 7; // "[xx/xx] "
  const effectiveMaxLength = maxLength - prefixBuffer;

  // Split by paragraphs first
  const paragraphs = message.split('\n\n');

  for (const paragraph of paragraphs) {
    // If paragraph would exceed limit, split into smaller chunks
    if ((currentChunk + paragraph).length + 2 > effectiveMaxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    // Process paragraph content
    if (paragraph.length > effectiveMaxLength) {
      // Split long paragraphs by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      // Process sentences...
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }

  // Check for word breaks at chunk boundaries to prevent words from merging
  for (let i = 0; i < chunks.length - 1; i++) {
    const currentChunk = chunks[i];
    const nextChunk = chunks[i + 1];

    // If current chunk ends with a word and next chunk starts with a word
    // Add a space to prevent words from merging (e.g., "an" + "officer" → "anofficer")
    if (/\w$/.test(currentChunk) && /^\w/.test(nextChunk)) {
      chunks[i] = currentChunk + ' ';
    }
  }

  // Add numbering prefix to each chunk
  return chunks.map((chunk, index) => `[${index + 1}/${chunks.length}] ${chunk}`);
}
```

### 7. Pi Optimization System

Detects Raspberry Pi hardware and applies appropriate optimizations based on the model and available
resources.

```javascript
// Simplified example from pi-detector.js
async function detectPiModel() {
  try {
    // Default values if detection fails
    let result = {
      isPi: false,
      model: 'unknown',
      ram: os.totalmem() / (1024 * 1024 * 1024), // RAM in GB
      cores: os.cpus().length,
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
const { addEmojiReactions } = require('../src/utils/emojiUtils');

describe('Emoji Utilities', () => {
  test('should add correct emoji for keyword "hello"', async () => {
    const message = {
      content: 'Hello everyone!',
      react: jest.fn().mockResolvedValue(true),
    };

    await addEmojiReactions(message);
    expect(message.react).toHaveBeenCalledWith('👋');
  });
});
```

> For comprehensive information about testing, see the [Testing Guide](Testing-Guide) and
> [CI/CD Pipeline](CI-CD-Pipeline) pages.

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

## v1.4.1 Code Quality Excellence & Architecture Refinement (2025-09-28)

### Service Architecture Refactoring

- **PerplexityService Decomposition**: Split monolithic service into focused, single-responsibility
  classes:
  - **ApiClient** (`src/services/api-client.js`): Handles HTTP requests, headers, and payload
    building
  - **CacheManager** (`src/services/cache-manager.js`): Manages response caching, cleanup, and
    configuration
  - **ResponseProcessor** (`src/services/response-processor.js`): Processes and formats API
    responses
  - **ThrottlingService** (`src/services/throttling-service.js`): Manages rate limiting and
    connection throttling
- **Modular Design**: Enhanced separation of concerns for better maintainability and testing
- **Service Composition**: PerplexityService now composes these focused services internally

### Code Quality Excellence

- **ESLint Issue Reduction**: Massive improvement from 861 to 45 issues (94.8% reduction)
- **Console Statement Elimination**: Replaced ALL console statements with proper logger calls in
  production code
  - `src/services/chat.js`: `console.log` → `logger.debug`
  - `src/utils/message-chunking/*`: `console.warn/error` → `logger.warn/error`
  - `src/utils/emoji.js`: `console.error` → `logger.error`
- **Unused Variable Cleanup**: Comprehensive cleanup across test files with `_` prefix convention
- **qlty Philosophy Adherence**: Following modern code quality principles throughout codebase

### Input Validation Enhancement

- **Code Duplication Elimination**: Removed duplicate validation logic in `input-validator.js`
- **Common Validation Helpers**: Implemented reusable helper methods:
  - `_validateRequired()`: Common required field validation
  - `_validateStringType()`: String type validation
  - `_validateArrayType()`: Array type validation
  - `_validateStringLength()`: String length validation
  - `_validateNotEmpty()`: Empty string validation
- **Sanitization Bug Fixes**: Fixed critical issues where sanitization return values were discarded
- **Consistent Validation Patterns**: Standardized validation approaches across all methods

### Logging Infrastructure Enhancement

- **Production Code Cleanup**: Complete elimination of console statements from production code
- **Logger Integration**: Added appropriate logger imports to all modules requiring logging
- **Consistent Logging Levels**: Standardized logging levels across the application
- **Enhanced Debugging**: Improved debugging capabilities with proper logging infrastructure

### Technical Improvements

- **Method Organization**: Better encapsulation and organization of methods within classes
- **Parameter Validation**: Simplified validation logic using proper JavaScript methods like
  `Number.isInteger()`
- **Error Handling**: Enhanced error handling with proper context and information
- **Resource Management**: Improved resource management through service separation

## v1.4.0 Comprehensive Testing & Coverage Enhancement (2025-01-22)

### Major Testing Infrastructure Improvements

- **Test Coverage Expansion**: Increased overall test coverage from 77.79% to 82%+
- **New Test Modules**: Added comprehensive test suites for previously untested modules
- **Test Count Growth**: Expanded from 371 to 536 passing tests
- **Production Readiness**: All critical modules now have extensive test coverage

### New Test Suites Added

- **Memory Monitor Tests** (`__tests__/unit/memory-monitor.test.js`): Complete test coverage for
  memory monitoring, garbage collection, and resource management
- **Message Chunking Tests** (`__tests__/unit/message-chunking/index.test.js`): Comprehensive
  testing of enhanced message chunking functionality
- **Chunk Boundary Handler Tests**
  (`__tests__/unit/message-chunking/chunk-boundary-handler.test.js`): Full test coverage for
  intelligent chunk boundary detection and fixing
- **Enhanced Commands Tests**: Expanded test coverage for all command handling scenarios

### Technical Improvements

- **Error Handling**: Enhanced error handling and recovery mechanisms across all modules
- **Input Validation**: Comprehensive testing of input validation and sanitization
- **API Reliability**: Improved API interaction reliability with extensive error scenario testing
- **Resource Management**: Better memory and resource management with complete test coverage

### Quality Assurance

- **Code Quality**: All modules now have robust error handling and input validation
- **Stability**: Extensive testing ensures production stability and reliability
- **Maintainability**: Well-tested code is easier to maintain and extend
- **Debugging**: Enhanced error reporting and logging for better troubleshooting

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
