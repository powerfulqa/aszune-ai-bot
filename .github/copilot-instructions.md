# GitHub Copilot Instructions for Aszune AI Bot

## 🎯 Project Overview

This is the Aszune AI Bot codebase - a Discord bot with AI capabilities and comprehensive analytics
integration that follows strict quality standards using qlty tooling. The project includes analytics
features (internally referenced as Phase B+C) accessible through Discord commands (`/analytics`,
`/dashboard`, `/resources`). When working on this codebase, please follow these comprehensive
guidelines for architecture patterns, testing approaches, and best practices.

## 📁 Architecture & Structure

### Core Structure

```
src/
├── commands/          # Command handlers (slash + text commands)
├── config/           # Configuration management
├── services/         # External API clients and services
└── utils/            # Utility functions and helpers
    ├── message-chunking/  # Advanced message splitting
    └── [various utilities]
```

### Key Components

- **Discord Interface**: Handles Discord API interactions
- **Command Handler**: Processes both slash commands and text commands (includes analytics commands)
- **Perplexity API Client**: Manages AI API communication with secure caching
- **Conversation Manager**: Class-based conversation tracking
- **Error Handler**: Comprehensive error handling system
- **Message Chunker**: Intelligent message splitting with boundary detection
- **Input Validator**: Content sanitization and validation
- **Analytics System**: Discord analytics, performance dashboard, and resource monitoring
  (`/analytics`, `/dashboard`, `/resources`)
- **Performance Monitoring**: Real-time system metrics and optimization recommendations
- **License Validation System**: Built-in proprietary license validation with automated enforcement
  and reporting (feature-flagged)
- **License Server**: Express.js-based licensing management system with web dashboard and violation
  tracking (feature-flagged)
- **Database Service**: SQLite integration for persistent conversation history and user analytics
  (`src/services/database.js`) with automatic table creation and graceful fallback
- **Reminder System**: AI-powered reminder scheduling with natural language processing (`!remind`,
  `!reminders`, `!cancelreminder`) and conversational reminder detection

## 🚨 Critical Error Handling Requirements

### MUST FOLLOW: Error Handling Contracts

- Services should **THROW** errors, not return error strings
- Tests expect **THROWN** exceptions, not returned error messages
- Error messages to users should be sent as **Discord embeds**, not plain text

### ❌ Wrong Pattern

```javascript
catch (error) {
  return "Error occurred: " + error.message;
}
```

### ✅ Correct Pattern

```javascript
catch (error) {
  throw error;
}
```

### Error Handler Usage

```javascript
const errorResponse = ErrorHandler.handleError(error, 'context', additionalData);
// errorResponse.message contains user-friendly message
// errorResponse.type contains error category
```

## ⚠️ CRITICAL: Service Method Contracts

### Key Service Behaviors - DO NOT BREAK

**PerplexityService.generateChatResponse():**

- MUST throw errors, never return error strings
- Takes (history, options = {}) parameters
- Tests expect: `await expect(service.generateChatResponse(messages)).rejects.toThrow('message')`
- Returns string content on success

**Chat Service Error Handling:**

- All errors caught in handleChatMessage() are sent as Discord embeds
- Error messages use ErrorHandler.handleError() for consistent user-friendly messages
- No plain text error responses - always embed format

**Cache Service Architecture (CRITICAL - v1.6.5 Lessons):**

- **Property Consistency**: Use descriptive service names (`this.cacheManager` not `this.cache`)
- **Method Delegation**: Services MUST delegate to their components, never bypass
- **Complete Field Coverage**: All expected Discord command fields must be provided
- **Fallback Completeness**: Error scenarios must return complete objects with all expected fields

```javascript
// ❌ DEADLY MISTAKE - Calling undefined property
getCacheStats() {
  return this.cache.getStats(); // this.cache doesn't exist!
}

// ✅ CORRECT - Proper service delegation
getCacheStats() {
  return this.cacheManager.getStats(); // Uses initialized service
}
```

**Cache Command Field Requirements (v1.6.5):** All cache statistics must include these exact fields
or Discord will show "undefined":

- Performance: `hitRate`, `hits`, `misses`
- Operations: `sets`, `deletes`, `evictions`
- Memory: `memoryUsageFormatted`, `maxMemoryFormatted`, `entryCount`, `maxSize`
- Configuration: `evictionStrategy`, `uptimeFormatted`

**Database Service Architecture (CRITICAL - v1.7.0 Integration):**

- **Graceful Fallback**: DatabaseService MUST provide mock implementations when SQLite unavailable
- **Error Handling**: Database errors should be logged and NOT cause conversation flow to fail
- **Method Contracts**: All database methods return expected data structures or defaults
- **Resource Management**: Single database connection per service instance with proper cleanup

```javascript
// ✅ CORRECT - Proper database service integration
try {
  databaseService.addUserMessage(userId, messageContent);
  databaseService.updateUserStats(userId, {
    message_count: 1,
    last_active: new Date().toISOString(),
  });
} catch (dbError) {
  logger.warn('Database operation failed:', dbError.message);
  // CRITICAL: Continue processing even if database fails
}

// ✅ CORRECT - Database service mock for tests
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
}));

// ❌ WRONG - Breaking conversation flow on database errors
try {
  databaseService.addUserMessage(userId, messageContent);
} catch (dbError) {
  throw dbError; // This breaks the entire conversation!
}
```

**Module Export Contracts:**

```javascript
// REQUIRED: All services must export in this exact pattern
module.exports = handleChatMessage;
module.exports.handleChatMessage = handleChatMessage;
module.exports.default = handleChatMessage;
```

## 🧪 Testing Patterns

### Mock Structure Requirements

Always follow these exact mocking patterns:

#### Discord.js Mocking

```javascript
jest.mock('discord.js', () => {
  const mockClient = {
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockImplementation((event, handler) => {
      if (event === 'ready') handler();
      return mockClient;
    }),
    login: jest.fn().mockResolvedValue('Logged in'),
  };

  return {
    Client: jest.fn(() => mockClient),
    GatewayIntentBits: {
      /* ... */
    },
    REST: jest.fn(() => ({
      /* ... */
    })),
  };
});
```

#### Discord Guild & Member Mocking (Analytics Commands)

```javascript
// ✅ CORRECT - Mock guild structure for analytics tests
const mockGuild = {
  memberCount: 150,
  members: {
    cache: {
      filter: jest.fn((filterFn) => {
        // Mock member collection with realistic data
        const mockMembers = new Map([
          ['user1', { user: { bot: false }, presence: { status: 'online' } }],
          ['user2', { user: { bot: false }, presence: { status: 'idle' } }],
          ['bot1', { user: { bot: true }, presence: { status: 'online' } }],
        ]);

        const filtered = new Map();
        mockMembers.forEach((member, id) => {
          if (filterFn(member)) filtered.set(id, member);
        });
        return { size: filtered.size };
      }),
    },
    fetch: jest.fn().mockResolvedValue(mockMemberCollection),
  },
};

// Mock Discord Collection behavior for member filtering
const mockMemberCollection = {
  filter: jest.fn(() => ({ size: 102 })), // Realistic active user count
  size: 150,
};
```

### Test Assertions - Use Exact Values (CRITICAL)

```javascript
// ✅ CORRECT - Test embed structure with EXACT values
expect(message.reply).toHaveBeenCalledWith({
  embeds: [
    {
      color: '#5865F2', // Exact color hex - don't use expect.any()
      description: 'An unexpected error occurred. Please try again later.', // Exact ErrorHandler message
      footer: { text: 'Aszai Bot' }, // Exact footer text
    },
  ],
});

// ❌ WRONG - Using matchers (WILL FAIL)
expect(message.reply).toHaveBeenCalledWith({
  embeds: [
    expect.objectContaining({
      // DON'T USE expect.objectContaining
      description: expect.stringContaining('error'), // DON'T USE expect.stringContaining
    }),
  ],
});
```

**CRITICAL EMBED REQUIREMENTS:**

- All user errors sent as embeds, never plain text
- Use exact ErrorHandler messages: "An unexpected error occurred. Please try again later."
- Color: "#5865F2" (config.COLORS.PRIMARY)
- Footer: { text: 'Aszai Bot' }

### Error Testing Pattern

```javascript
// ✅ CORRECT - Test for thrown errors
await expect(service.method()).rejects.toThrow('Expected error message');

// ❌ WRONG - Test for returned error strings
const result = await service.method();
expect(result).toContain('error message');
```

### Database Service Testing (v1.7.0)

```javascript
// ✅ CORRECT - Database service testing with actual SQLite
const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService', () => {
  let dbService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbService = new DatabaseService();
  });

  afterEach(() => {
    if (dbService.db && !dbService.isDisabled) {
      try {
        dbService.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });
});

// ✅ CORRECT - Database mock for chat service tests
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
}));
```

## 🛡️ Security & Quality Requirements (qlty Standards)

### Mandatory Security Practices

- **Zero tolerance** for hardcoded secrets, tokens, or API keys
- All sensitive data must use environment variables
- Pre-commit verification: `npm run security:secrets`
- Security audits: `npm run security:dependencies`

### Code Quality Thresholds

- **File Complexity**: Maximum 15 per file
- **Function Complexity**: Maximum 10 per function
- **Code Duplication**: Maximum 50 identical lines
- **Test Coverage**: Maintain 82%+ overall coverage

### Quality Commands

```bash
npm run quality:check        # Sample quality analysis
npm run quality:fix          # Auto-fix formatting issues
npm run security:all         # Complete security audit
```

## � Feature Flag System

### License System Feature Flags

The license validation and enforcement system is implemented but **disabled by default** for safe
deployment:

```javascript
// config/config.js - Feature flag configuration
FEATURES: {
  // License System Features (disabled by default for safe deployment)
  LICENSE_VALIDATION: process.env.ENABLE_LICENSE_VALIDATION === 'true' || false,
  LICENSE_SERVER: process.env.ENABLE_LICENSE_SERVER === 'true' || false,
  LICENSE_ENFORCEMENT: process.env.ENABLE_LICENSE_ENFORCEMENT === 'true' || false,

  // Development mode detection (enables all features for testing)
  DEVELOPMENT_MODE: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true',
},
```

### Usage Patterns (CRITICAL - Follow Exactly)

```javascript
// ✅ CORRECT - Check feature flags inside methods to avoid circular dependencies
function validateLicense() {
  const config = require('../config/config');

  // ALWAYS check if FEATURES exists for backward compatibility
  if (!config.FEATURES) {
    return {
      isValid: true,
      message: 'License validation disabled (no FEATURES config)',
      skipValidation: true,
    };
  }

  if (!config.FEATURES.LICENSE_VALIDATION && !config.FEATURES.DEVELOPMENT_MODE) {
    return {
      isValid: true,
      message: 'License validation disabled via feature flag',
      skipValidation: true,
    };
  }

  // License validation logic...
}

// ❌ DEADLY MISTAKE - Module-level feature checks (causes circular dependencies)
const config = require('../config/config');
if (config.FEATURES.LICENSE_VALIDATION) {
  // This WILL break the entire application!
}
```

### Safe Config Access Pattern (MANDATORY)

```javascript
// Helper function pattern for all config access
function getConfig() {
  const config = require('./config/config');

  // Ensure FEATURES property exists (for backward compatibility and tests)
  if (!config.FEATURES) {
    config.FEATURES = {
      LICENSE_VALIDATION: false,
      LICENSE_SERVER: false,
      LICENSE_ENFORCEMENT: false,
      DEVELOPMENT_MODE: false,
    };
  }

  return config;
}
```

### Feature Flag Testing Requirements

- **Mock Configuration**: Always include FEATURES in test mocks
- **Graceful Fallback**: Handle missing FEATURES property
- **No Breaking Changes**: Features disabled by default must not affect existing functionality
- **Test All States**: Test with features enabled/disabled/missing

### Development Workflow

```bash
# Default: All license features disabled (safe for main branch)
npm start

# Development: Enable all features
NODE_ENV=development npm start

# Individual feature testing
ENABLE_LICENSE_VALIDATION=true npm start
ENABLE_LICENSE_SERVER=true npm start
ENABLE_LICENSE_ENFORCEMENT=true npm start
```

## �🔧 Module Export Requirements

### Maintain Backward Compatibility

```javascript
// ✅ CORRECT - Maintains all export patterns
module.exports = handleChatMessage;
module.exports.handleChatMessage = handleChatMessage;
module.exports.default = handleChatMessage;

// ❌ WRONG - Breaking change
module.exports = {
  handleChatMessage,
  default: handleChatMessage,
};
```

## 📝 Command Handling Patterns

### Dual Command Support

Support both slash commands and text commands:

```javascript
// Text command handling
const mockInteraction = {
  user: message.author,
  channel: message.channel,
  content: message.content,
  reply: (content) => message.reply(content),
  deferReply: async () => message.channel.sendTyping(),
  editReply: (content) => message.reply(content),
};
```

## � CRITICAL WARNINGS FOR AI AGENTS

### 1. Configuration Access Patterns (CRITICAL)

**DANGER:** Config access at module level causes circular dependencies!

```javascript
// ❌ DEADLY MISTAKE - Will break entire app
const config = require('../config/config');
const someValue = config.SOME_VALUE; // Module level access = circular dependency
const licenseEnabled = config.FEATURES?.LICENSE_VALIDATION; // Also breaks app!

// ✅ ALWAYS ACCESS CONFIG INSIDE FUNCTIONS
function someFunction() {
  const config = require('../config/config');

  // Always check FEATURES exists for backward compatibility
  if (!config.FEATURES) {
    config.FEATURES = { LICENSE_VALIDATION: false }; // Safe fallback
  }

  return config.SOME_VALUE;
}
```

### 2. Test Error Contract Violations (BREAKS 536+ TESTS)

```javascript
// ❌ WRONG - Will fail tests expecting thrown errors
catch (error) {
  return "Error: " + error.message; // Tests expect throws, not returns
}

// ✅ CORRECT - Tests expect thrown exceptions
catch (error) {
  throw error; // Re-throw to maintain contract
}
```

## �🛠️ Common Issues & Solutions

### 3. Circular Dependency Prevention

Move config access inside functions, not at module level:

```javascript
// ❌ WRONG - Module level
const config = require('../config/config');
const someValue = config.SOME_VALUE;

// ✅ CORRECT - Function level
function someFunction() {
  const config = require('../config/config');
  return config.SOME_VALUE;
}
```

### 4. Memory Management

```javascript
// Always clean up in tests
afterEach(() => {
  conversationManager.clearAll();
  jest.clearAllMocks();
});
```

### 4b. Test Fixing Patterns (v1.7.0 Lessons)

**Mock Completeness Issues**: When tests fail with "method not called", check for missing mocks:

```javascript
// ❌ COMMON MISTAKE - Incomplete service mocks
const mockEmojiManager = {
  addEmojis: jest.fn(), // Only partial implementation
};

// ✅ CORRECT - Complete service mocks matching actual usage
const mockEmojiManager = {
  addEmojis: jest.fn(),
  addEmojisToResponse: jest.fn().mockImplementation((text) => text),
  addReactionsToMessage: jest.fn().mockResolvedValue(),
};
```

**Service Method Alignment**: Ensure mocks match actual service calls:

```javascript
// ❌ WRONG - Mock doesn't match actual service usage
mockMessageFormatter.createCompactEmbed.mockReturnValue({});

// ✅ CORRECT - Mock includes all methods actually called
mockMessageFormatter.formatResponse.mockImplementation((text) => text);
```

**Database Mock Strategy**: Always mock database service for non-database tests:

```javascript
// ✅ REQUIRED - Database service mock for chat tests
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
}));
```

### 5. Service Component Architecture (DO NOT MODIFY)

**PerplexityService uses component-based architecture:**

- `ApiClient` - HTTP requests
- `CacheManager` - Cache operations
- `ResponseProcessor` - Response handling
- `ThrottlingService` - Rate limiting

**CRITICAL:** Do not bypass these components or create direct API calls!

### 6. Cache Service Integration Points (v1.6.5 Critical Fixes)

**CacheManager Service Requirements:**

```javascript
// ✅ REQUIRED - All cache services must implement these methods
class CacheManager {
  getStats() {
    // Must return all fields expected by Discord commands
    return {
      hits,
      misses,
      hitRate,
      sets,
      deletes,
      evictions,
      memoryUsageFormatted,
      maxMemoryFormatted,
      entryCount,
      maxSize,
      evictionStrategy,
      uptimeFormatted,
    };
  }

  getDetailedInfo() {
    // Must return stats + entries array
  }

  invalidateByTag(tag) {
    // Must support tag-based invalidation
  }
}
```

**Service Property Architecture (CRITICAL):**

```javascript
// ✅ CORRECT - Consistent service delegation pattern
class PerplexityService {
  constructor() {
    this.cacheManager = new CacheManager(); // Descriptive property name
  }

  getCacheStats() {
    return this.cacheManager.getStats(); // Always delegate through service
  }
}

// ❌ WRONG - Direct component access bypasses service layer
getCacheStats() {
  return this.cache.getStats(); // Property doesn't exist!
}
```

### 6. Discord API Patterns (CRITICAL)

**Based on v1.6.1 analytics fixes - Discord API can be unreliable!**

```javascript
// ✅ CORRECT - Always use timeout protection for Discord API calls
async function getDiscordData(guild) {
  try {
    const fetchPromise = guild.members.fetch({ limit: 1000 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Discord API timeout')), 5000)
    );

    const members = await Promise.race([fetchPromise, timeoutPromise]);

    // Filter for real data processing
    const activeMembers = members.filter(
      (member) =>
        !member.user.bot &&
        member.presence?.status &&
        ['online', 'idle', 'dnd'].includes(member.presence.status)
    );

    return { activeUsers: activeMembers.size, totalMembers: guild.memberCount };
  } catch (error) {
    // ALWAYS provide fallback estimates
    return {
      activeUsers: Math.floor(guild.memberCount * 0.2), // 20% active estimate
      totalMembers: guild.memberCount,
      fallbackUsed: true,
    };
  }
}

// ❌ WRONG - Direct Discord API calls without timeout protection
const members = await guild.members.fetch(); // Will hang in large servers!
```

**CRITICAL Discord API Requirements:**

- **Timeout Protection**: Use Promise.race() with 5-second timeouts
- **Fallback Data**: Always provide realistic estimates when API fails
- **Member Limits**: Restrict to 1000 members max for performance
- **Permission Checks**: Verify "View Server Members" permission
- **Intent Requirements**: "Server Members Intent" and "Presence Intent" must be enabled

### 7. Error Handler Usage Patterns

```javascript
// ✅ CORRECT - Use ErrorHandler for all errors
const errorResponse = ErrorHandler.handleError(error, 'context', additionalData);
// errorResponse.message = user-friendly message
// errorResponse.type = error category

// ❌ WRONG - Don't create custom error messages
const customMessage = 'Something went wrong: ' + error.message;
```

### 8. Perplexity API Model Evolution (CRITICAL - v1.6.3)

**DANGER**: Perplexity frequently changes model names without warning!

```javascript
// ✅ CURRENT (v1.6.3) - Use simplified model names
API: {
  PERPLEXITY: {
    DEFAULT_MODEL: 'sonar', // Current working model
  }
}

// ❌ DEPRECATED (v1.6.2) - Old descriptive format
DEFAULT_MODEL: 'llama-3.1-sonar-small-128k-chat', // No longer works

// ❌ VERY OLD (v1.6.0-1.6.1) - Various failed attempts
DEFAULT_MODEL: 'llama-3.1-sonar-large-128k-online', // Never worked
```

**Model Evolution History:**

- **v1.6.0-1.6.1**: API integration struggles with various model attempts
- **v1.6.2**: Temporary fix with `llama-3.1-sonar-small-128k-chat`
- **v1.6.3**: ✅ Current working solution with `sonar`

**Perplexity Model Categories (as of v1.6.3):**

- `sonar` - Basic search (current default)
- `sonar-pro` - Advanced search
- `sonar-reasoning` - Reasoning tasks
- `sonar-reasoning-pro` - Advanced reasoning
- `sonar-deep-research` - Research tasks

**CRITICAL API Monitoring:**

- Watch for "Invalid model" API 400 errors
- Test summarise commands (`!summerise`, `!summarise`) after deployments
- Monitor Perplexity documentation for model changes
- Always provide fallback error handling for API model issues

### 9. Database Service Integration (CRITICAL - v1.7.0)

**DANGER**: Database errors must NEVER break conversation flow!

```javascript
// ✅ CORRECT - Database errors don't break conversations
try {
  databaseService.addUserMessage(userId, messageContent);
  databaseService.updateUserStats(userId, {
    message_count: 1,
    last_active: new Date().toISOString(),
  });
} catch (dbError) {
  logger.warn('Database operation failed:', dbError.message);
  // CRITICAL: Continue processing even if database fails
}

// ❌ DEADLY MISTAKE - Breaking conversation flow on database errors
try {
  databaseService.addUserMessage(userId, messageContent);
} catch (dbError) {
  throw dbError; // This breaks the entire conversation!
}
```

**Database Service Requirements:**

- **Graceful Fallback**: Must provide mock implementations when SQLite unavailable
- **Error Isolation**: Database errors logged but don't propagate to conversation flow
- **Single Connection**: One database connection per service instance
- **Proper Cleanup**: Always close connections in afterEach for tests
- **Mock All Methods**: Non-database tests must mock all DatabaseService methods
- **Foreign Key Handling**: Use ensureUserExists() before adding messages to prevent constraint
  violations
- **Role-Based Storage**: conversation_history table requires proper role separation
  (user/assistant)
- **Data Integrity**: Foreign key constraints ensure conversation records are linked to valid users

**Database Schema Design (Production Ready - v1.7.0):**

```javascript
// ✅ CORRECT - Proper conversation history usage
const history = databaseService.getConversationHistory(userId, 10);
// Returns: [{role: 'user', message: '...', timestamp: '...'}, {role: 'assistant', ...}]

// ✅ CORRECT - Automatic user management
databaseService.addUserMessage(userId, message); // Calls ensureUserExists() internally
databaseService.addBotResponse(userId, response); // Handles foreign keys automatically

// ✅ CORRECT - Dual storage for backward compatibility
// Both user_messages (legacy) and conversation_history (enhanced) tables are populated

// ❌ WRONG - Direct conversation_history inserts without user existence check
db.prepare('INSERT INTO conversation_history ...').run(...); // May fail on foreign key constraint
```

**Remember**: 1000+ tests, 82%+ coverage, qlty quality standards - all must pass. When in doubt,
