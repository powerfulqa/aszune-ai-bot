# GitHub Copilot Instructions for Aszune AI Bot

## 🎯 Project Overview

**Aszune AI Bot** (v1.7.0) is a production Discord bot combining Perplexity AI with comprehensive
analytics, reminder scheduling, and performance monitoring. Built for Raspberry Pi deployment with
current local test status: 1,231 tests (1,228 passing) – 72.6% statements / 67.1% branches; CI
historical target 82%+ (restoration in progress) and strict qlty quality standards.

**Key Capabilities:**
- AI chat powered by Perplexity API with conversation history
- Natural language reminder system with SQLite persistence
- Discord analytics dashboard (`/analytics`, `/dashboard`, `/resources`)
- Multi-layered cache architecture for performance
- Raspberry Pi optimizations for low-resource environments

## 🏗️ Architecture Patterns

### Service Layer Hierarchy (CRITICAL)

```
Discord Commands
    ↓
index.js (bot orchestration)
    ↓
services/chat.js (message handling)
    ↓
services/perplexity-secure.js (AI API)
    ├── ApiClient (HTTP)
    ├── CacheManager (caching)
    ├── ResponseProcessor (formatting)
    └── ThrottlingService (rate limiting)
```

**NEVER bypass service layers** - always delegate through proper channels. Direct component access
breaks error handling and testing.

### Component-Based Services

**PerplexityService** uses composition pattern:

```javascript
class PerplexityService {
  constructor() {
    this.apiClient = new ApiClient();
    this.cacheManager = new CacheManager(); // NOT this.cache!
    this.responseProcessor = new ResponseProcessor();
    this.throttlingService = new ThrottlingService();
  }

  getCacheStats() {
    return this.cacheManager.getStats(); // Always delegate
  }
}
```

### Database Integration (v1.7.0)

**SQLite-backed persistence** with graceful degradation:

- **DatabaseService** provides mock implementations when SQLite unavailable
- Database errors **MUST NOT** break conversation flow
- Foreign key constraints enforced (use `ensureUserExists()` before inserts)
- Dual storage: `user_messages` (legacy) + `conversation_history` (enhanced)

## 🚨 Error Handling Contracts (NEVER VIOLATE)

### Critical Rules - Breaking These Fails 536+ Tests

1. **Services THROW errors**, never return error strings
2. **Tests expect THROWN exceptions**, not return values
3. **User errors sent as Discord embeds**, never plain text
4. **Database errors logged and isolated**, never break conversation flow

```javascript
// ❌ DEADLY MISTAKE - Will fail all error tests
catch (error) {
  return "Error: " + error.message;  // Tests expect throws!
}

// ✅ CORRECT - Service contract
catch (error) {
  throw error;  // Re-throw to maintain contract
}

// ✅ CORRECT - User-facing error handling
catch (error) {
  const errorResponse = ErrorHandler.handleError(error, 'context');
  await message.reply({
    embeds: [{
      color: '#5865F2',
      description: errorResponse.message,
      footer: { text: 'Aszai Bot' }
    }]
  });
}

// ✅ CRITICAL - Database error isolation (v1.7.0)
try {
  databaseService.addUserMessage(userId, content);
} catch (dbError) {
  logger.warn('Database error:', dbError);
  // NEVER re-throw - continue conversation flow!
}
```

## 🧪 Testing Patterns (1,231 Tests – 1,228 Passing Local)

### Mock Structure - MUST Follow Exactly

```javascript
// ✅ CORRECT - Discord.js mock (always first)
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
    GatewayIntentBits: { /* ... */ },
    REST: jest.fn(() => ({ /* ... */ })),
  };
});

// ✅ CRITICAL - Database service mock for non-DB tests
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
}));
```

### Test Assertions - Use EXACT Values

```javascript
// ✅ CORRECT - Test with exact values
expect(message.reply).toHaveBeenCalledWith({
  embeds: [{
    color: '#5865F2', // Exact hex - no expect.any()
    description: 'An unexpected error occurred. Please try again later.',
    footer: { text: 'Aszai Bot' },
  }],
});

// ❌ WRONG - Matchers will fail
expect(message.reply).toHaveBeenCalledWith({
  embeds: [expect.objectContaining({ /* ... */ })], // DON'T USE
});
```

### Error Testing Pattern

```javascript
// ✅ CORRECT - Expect thrown errors
await expect(service.method()).rejects.toThrow('Expected message');

// ❌ WRONG - Expect returned strings
const result = await service.method();
expect(result).toContain('error');
```

## 🔧 Critical Development Patterns

### Config Access (PREVENTS CIRCULAR DEPENDENCIES)

```javascript
// ❌ DEADLY - Module-level config access
const config = require('../config/config');
const value = config.FEATURES?.LICENSE_VALIDATION;  // CIRCULAR DEPENDENCY!

// ✅ ALWAYS access inside functions
function someFunction() {
  const config = require('../config/config');
  if (!config.FEATURES) {
    config.FEATURES = { LICENSE_VALIDATION: false };
  }
  return config.FEATURES.LICENSE_VALIDATION;
}
```

### Module Exports (BACKWARD COMPATIBILITY)

```javascript
// ✅ CORRECT - Maintains all export patterns
module.exports = handleChatMessage;
module.exports.handleChatMessage = handleChatMessage;
module.exports.default = handleChatMessage;

// ❌ WRONG - Breaking change
module.exports = { handleChatMessage };
```

### Cache Service Properties (v1.6.5 Critical Fix)

```javascript
// ✅ CORRECT - Descriptive property names
class PerplexityService {
  constructor() {
    this.cacheManager = new CacheManager(); // NOT this.cache
  }

  getCacheStats() {
    return this.cacheManager.getStats(); // Always delegate
  }
}
```

### Database Error Isolation (v1.7.0)

```javascript
// ✅ CORRECT - Database errors never break chat flow
try {
  databaseService.addUserMessage(userId, content);
} catch (dbError) {
  logger.warn('Database error:', dbError);
  // Continue processing - database is enhancement, not requirement
}
```

### Reminder Service Integration (v1.7.0)

```javascript
// ✅ CORRECT - EventEmitter pattern
class ReminderService extends EventEmitter {
  constructor() {
    super(); // MUST call super()
    this.activeTimers = new Map();
  }
}

// Bot integration
reminderService.on('reminderDue', async (reminder) => {
  await channel.send({ embeds: [/* ... */] });
});
```

## 🛡️ Security & Quality (qlty Standards)

### Mandatory Practices

- **Zero tolerance** for hardcoded secrets
- Pre-commit: `npm run security:secrets`
- Security audit: `npm run security:all`

### Quality Thresholds

- **File Complexity**: Max 15
- **Function Complexity**: Max 10
- **Code Duplication**: Max 50 lines
- **Test Coverage**: 72.6% statements / 67.1% branches local (historical CI target 82%+)

### Commands

```bash
npm run quality:check        # Quality check
npm run quality:fix          # Auto-fix
npm run security:all         # Security audit
```

## ⚠️ Feature Flag System

### License System Feature Flags

The license validation and enforcement system is implemented but **disabled by default** for safe
deployment:

```javascript
// config/config.js - Feature flag configuration
FEATURES: {
  LICENSE_VALIDATION: process.env.ENABLE_LICENSE_VALIDATION === 'true' || false,
  LICENSE_SERVER: process.env.ENABLE_LICENSE_SERVER === 'true' || false,
  LICENSE_ENFORCEMENT: process.env.ENABLE_LICENSE_ENFORCEMENT === 'true' || false,
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

## 🚨 CRITICAL WARNINGS FOR AI AGENTS

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

### 3. Discord API Timeouts (v1.6.1 Fix)

```javascript
// ✅ CORRECT - Always use timeout protection
async function getDiscordData(guild) {
  const fetchPromise = guild.members.fetch({ limit: 1000 });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  );

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    // Provide fallback estimates
    return { activeUsers: Math.floor(guild.memberCount * 0.2) };
  }
}
```

### 4. Perplexity Model Changes (v1.6.3)

```javascript
// ✅ CURRENT - Simplified model names
API: {
  PERPLEXITY: {
    DEFAULT_MODEL: 'sonar',  // Current working model
  }
}

// ❌ DEPRECATED - Old descriptive format
DEFAULT_MODEL: 'llama-3.1-sonar-small-128k-chat'  // No longer works
```

### 5. Database Error Isolation (v1.7.0)

```javascript
// ✅ CRITICAL - Never break conversation flow
try {
  databaseService.addUserMessage(userId, content);
} catch (dbError) {
  logger.warn('Database error:', dbError);
  // Continue processing - database is enhancement only
}
```

### 6. Cache Service Integration Points (v1.6.5 Critical Fixes)

**CacheManager Service Requirements:**

```javascript
// ✅ REQUIRED - All cache services must implement these methods
class CacheManager {
  getStats() {
    return {
      hits, misses, hitRate, sets, deletes, evictions,
      memoryUsageFormatted, maxMemoryFormatted, entryCount,
      maxSize, evictionStrategy, uptimeFormatted,
    };
  }

  getDetailedInfo() { /* Must return stats + entries array */ }
  invalidateByTag(tag) { /* Must support tag-based invalidation */ }
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

### 7. Discord API Patterns (CRITICAL)

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
- **Foreign Key Handling**: Use ensureUserExists() before adding messages to prevent constraint violations
- **Role-Based Storage**: conversation_history table requires proper role separation (user/assistant)
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

## 📋 Quick Reference

### Essential Commands

```bash
# Testing
npm test                     # Run all tests
npm run test:coverage        # Coverage report
npm run test:critical        # Critical path tests

# Quality & Security
npm run quality:check        # Quality check
npm run quality:fix          # Auto-fix
npm run security:all         # Security audit

# Development
npm run dev                  # Development mode
npm start                    # Production mode
```

### Key Files

- `src/index.js` - Bot orchestration, shutdown handling
- `src/services/chat.js` - Message handling, reminder detection
- `src/services/perplexity-secure.js` - AI API with caching
- `src/services/database.js` - SQLite persistence (v1.7.0)
- `src/services/reminder-service.js` - Reminder scheduling (v1.7.0)
- `src/config/config.js` - Configuration (function-level access only!)
- `src/utils/error-handler.js` - Centralized error handling

### Success Metrics

- ✅ 1,231 tests defined / 1,228 passing locally
- ✅ 72.6% statements / 67.1% branches (target 82%+ restoration)
- ✅ No circular dependencies
- ✅ Error contracts maintained
- ✅ Quality thresholds met
- ✅ Security scans clean

---

**Remember**: This codebase has 1,231 tests (1,228 passing) with 72.6% statement / 67.1% branch
coverage (historical target 82%+). Breaking patterns WILL fail tests. When
in doubt, check existing tests for expected behavior.