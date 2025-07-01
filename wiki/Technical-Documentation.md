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
7. **Smart Answer Cache** - Caches frequent questions and answers to reduce API usage

## Project Structure

```
aszune-ai-bot/
├── src/
│   ├── index.js           # Main entry point
│   ├── commands/          # Command handlers
│   ├── config/            # Configuration settings
│   ├── services/          # API and core services
│   │   ├── cache.js       # Smart answer cache service
│   │   ├── chat.js        # Chat message handling
│   │   ├── fallback.js    # Fallback service for error handling
│   │   ├── perplexity.js  # Perplexity API client
│   │   └── storage.js     # User stats storage
│   └── utils/             # Utility functions and helpers
│       ├── conversation.js # Conversation management
│       ├── emoji.js        # Emoji reaction handling
│       ├── errors.js       # Custom error types
│       └── logger.js       # Logging utility
├── data/
│   ├── user_stats.json    # User statistics data
│   └── question_cache.json # Smart answer cache data
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

### 6. Smart Answer Cache

The cache system is designed to store and retrieve frequent questions and answers to reduce API token usage.

```javascript
// Simplified example
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.cache = {};
    this.initialized = false;
  }
  
  // Initialize cache from disk storage
  init() {
    if (this.initialized) return;
    
    try {
      // Load cache from disk or create new
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
        this.cache = JSON.parse(cacheData);
      } else {
        this.saveCache();
      }
      this.initialized = true;
    } catch (error) {
      // Handle errors
      this.cache = {};
      this.saveCache();
    }
  }
  
  // Find a cached response for a question
  findInCache(question) {
    // Try direct hash lookup first
    const hash = this.generateHash(question);
    if (this.cache[hash]) {
      // Update access metrics
      const entry = this.cache[hash];
      entry.accessCount += 1;
      entry.lastAccessed = Date.now();
      
      // Check if entry is stale
      if (this.isStale(entry)) {
        return { ...entry, needsRefresh: true };
      }
      return entry;
    }
    
    // If no direct hit, try similarity matching
    for (const key of Object.keys(this.cache)) {
      const entry = this.cache[key];
      const similarity = this.calculateSimilarity(question, entry.question);
      
      if (similarity > SIMILARITY_THRESHOLD) {
        // Update access metrics
        entry.accessCount += 1;
        entry.lastAccessed = Date.now();
        
        // Check if entry is stale
        if (this.isStale(entry)) {
          return { ...entry, needsRefresh: true, similarity };
        }
        return { ...entry, similarity };
      }
    }
    
    // No match found
    return null;
  }
  
  // Add a new entry to the cache
  addToCache(question, answer, gameContext = null) {
    const hash = this.generateHash(question);
    const now = Date.now();
    
    this.cache[hash] = {
      questionHash: hash,
      question,
      answer,
      gameContext,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    };
    
    this.saveCache();
  }
}
```

#### Cache Integration with Chat Flow

The cache is integrated into the chat message handling process:

```javascript
async function handleChatMessage(message) {
  // ... existing message handling ...
  
  try {
    // Extract the user's question
    const userQuestion = message.content;
    let reply;
    let fromCache = false;
    
    try {
      // Try to find the question in the cache first with robust error handling
      const cacheResult = cacheService.findInCache(userQuestion);
      
      if (cacheResult) {
        // Cache hit!
        reply = cacheResult.answer;
        fromCache = true;
        
        // If the entry needs a refresh (is stale), update it in the background
        if (cacheResult.needsRefresh) {
          // Don't await this to avoid delaying the response
          refreshCacheEntry(userQuestion, userId);
        }
      } else {
        // Cache miss - call the API
        const history = conversationManager.getHistory(userId);
        reply = await perplexityService.generateChatResponse(history);
        
        // Add the new Q&A pair to the cache with validation checks
        if (reply) {
          const added = cacheService.addToCache(userQuestion, reply);
          if (!added) {
            logger.debug('Failed to add entry to cache');
          }
        }
      }
    } catch (cacheError) {
      // Handle cache specific errors gracefully
      logger.warn(`Cache error: ${cacheError.message}`);
      // Fall back to API call if cache operation fails
      const history = conversationManager.getHistory(userId);
      reply = await perplexityService.generateChatResponse(history);
    }
    
    // ... continue with response formatting and sending ...
  } catch (error) {
    // ... general error handling ...
  }
}
```

#### Key Features of the Cache System:

1. **Hash-based Storage**: Questions are hashed for efficient lookup
2. **Robust Input Validation**: Comprehensive validation for empty, null, or invalid inputs
3. **Question Normalization**: Questions are normalized (lowercase, whitespace normalization, punctuation removal) before hashing to improve hit rate
4. **Similarity Matching**: Can find similar questions using word overlap algorithm with Jaccard similarity
5. **Access Metrics**: Tracks usage patterns (frequency, last accessed)
6. **Automatic Refreshing**: Stale entries get refreshed in the background
7. **Pruning Capability**: Rarely accessed and old entries can be removed with LRU (Least Recently Used) eviction
8. **Persistent Storage**: Cache is saved to disk for use across bot restarts
9. **Performance First**: Cache hits are served immediately with background refreshing
10. **Error Resilience**: Robust error handling for all edge cases including file system errors

This caching system significantly reduces API token usage for frequently asked questions while maintaining response freshness through background updates of stale entries.

#### Enhanced Hash Generation and Normalization

The cache system uses an enhanced question normalization and hash generation approach to improve cache hit rates and handle edge cases:

```javascript
/**
 * Generate a hash for a question to use as a cache key
 * @param {string} question - The question text
 * @returns {string} - A hash of the question
 * @throws {Error} - If question is invalid
 */
generateHash(question) {
  // Input validation - explicitly check all edge cases including empty strings
  if (question === null || question === undefined) {
    throw new Error('Question cannot be null or undefined');
  }
  
  if (typeof question !== 'string') {
    throw new Error(`Question must be a string, got ${typeof question}`);
  }
  
  // Check for empty strings or strings with only whitespace
  if (question === '' || question.trim() === '') {
    throw new Error('Question cannot be an empty string');
  }
  
  // Normalize the question: lowercase, trim whitespace, normalize spaces, remove specific punctuation
  const normalizedQuestion = question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // normalize multiple spaces to single space
    .replace(/[.,!?;:]/g, '') // only remove sentence punctuation, keep meaningful chars
    .replace(/["'`]/g, ''); // remove quote marks
    
  // Use SHA-256 for better collision resistance
  return crypto.createHash('sha256').update(normalizedQuestion).digest('hex');
}
```

This normalization process ensures that similar questions (with different capitalization, punctuation, or extra spaces) will hash to the same value, increasing cache hit rates. The explicit error handling for invalid inputs ensures robustness against common edge cases.

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

## Performance Considerations

- Uses JavaScript `Map` for conversation history and rate limiting for efficient lookups
- Implements proper error handling for API calls
- Uses async/await for non-blocking operations

## Security and Error Handling Considerations

- Sensitive information is stored in environment variables, not in code
- API keys and tokens are never exposed in responses
- Rate limiting prevents abuse
- Comprehensive input validation is performed throughout the codebase
- Robust error handling for edge cases:
  - Empty, null, or undefined inputs
  - Non-string inputs
  - Unicode and special characters
  - Extremely long questions
  - File system errors (disk full, permission issues)
  - Cache corruption or invalid data
  - LRU eviction when cache size limits are reached

## CI/CD Integration

The project uses GitHub Actions for Continuous Integration and Continuous Deployment, configured in `.github/workflows/unified-ci.yml`. For detailed deployment information and pipeline configuration, please refer to the [Deployment Guide](Deployment-Guide.md#cicd-pipeline).

### Key CI/CD Features

1. **Automated Testing**: All tests are run automatically on push and pull requests.
2. **Code Coverage**:
   - Coverage reports are generated using Jest
   - Reports are uploaded to Codecov
   - A coverage badge is displayed in the README.md

3. **Test Results Reporting**:
   - Test results are generated in JUnit XML format
   - Results are uploaded to Codecov using the test-results-action
   - Results are available for analysis in the Codecov dashboard

4. **Codecov AI Reviewer**:
   - Automatically reviews code changes in pull requests
   - Identifies potential issues and suggests improvements
   - Provides feedback on test coverage

### GitHub Actions Workflow

```yaml
# Example of the key parts in the workflow
- name: Run tests with coverage
  run: npm test -- --coverage --forceExit --testResultsProcessor=jest-junit
  env:
    JEST_JUNIT_OUTPUT_DIR: ./test-results/
    JEST_JUNIT_OUTPUT_NAME: junit.xml

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    file: coverage/lcov.info
    fail_ci_if_error: false
    
- name: Upload test results to Codecov
  uses: codecov/test-results-action@v1
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
```

## Future Technical Enhancements

- Database integration for persistent conversation storage
- Webhook support for external integrations
- Support for more complex conversation flows
- Enhanced error handling with automatic recovery
