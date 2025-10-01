# GitHub Copilot Instructions for Aszune AI Bot

## 🎯 Project Overview

This is the Aszune AI Bot codebase - a Discord bot with AI capabilities and comprehensive analytics integration that follows strict quality standards using qlty tooling. The project includes Phase B+C analytics features accessible through Discord commands (`/analytics`, `/dashboard`, `/resources`). When working on this codebase, please follow these comprehensive guidelines for architecture patterns, testing approaches, and best practices.

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
- **Analytics System**: Discord analytics, performance dashboard, and resource monitoring (`/analytics`, `/dashboard`, `/resources`)
- **Performance Monitoring**: Real-time system metrics and optimization recommendations

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
    GatewayIntentBits: { /* ... */ },
    REST: jest.fn(() => ({ /* ... */ })),
  };
});
```

### Test Assertions - Use Exact Values (CRITICAL)
```javascript
// ✅ CORRECT - Test embed structure with EXACT values
expect(message.reply).toHaveBeenCalledWith({
  embeds: [{
    color: "#5865F2", // Exact color hex - don't use expect.any()
    description: "An unexpected error occurred. Please try again later.", // Exact ErrorHandler message
    footer: { text: 'Aszai Bot' } // Exact footer text
  }]
});

// ❌ WRONG - Using matchers (WILL FAIL)
expect(message.reply).toHaveBeenCalledWith({
  embeds: [expect.objectContaining({ // DON'T USE expect.objectContaining
    description: expect.stringContaining('error') // DON'T USE expect.stringContaining
  })]
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

## 🔧 Module Export Requirements

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

// ✅ ALWAYS ACCESS CONFIG INSIDE FUNCTIONS
function someFunction() {
  const config = require('../config/config');
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

### 5. Service Component Architecture (DO NOT MODIFY)
**PerplexityService uses component-based architecture:**
- `ApiClient` - HTTP requests
- `CacheManager` - Cache operations  
- `ResponseProcessor` - Response handling
- `ThrottlingService` - Rate limiting

**CRITICAL:** Do not bypass these components or create direct API calls!

### 6. Error Handler Usage Patterns
```javascript
// ✅ CORRECT - Use ErrorHandler for all errors
const errorResponse = ErrorHandler.handleError(error, 'context', additionalData);
// errorResponse.message = user-friendly message
// errorResponse.type = error category

// ❌ WRONG - Don't create custom error messages
const customMessage = "Something went wrong: " + error.message;
```

## 📋 Pre-Commit Checklist

Before committing changes, ensure:
- [ ] All tests pass (`npm test`)
- [ ] qlty quality checks pass (`npm run quality:check`)
- [ ] No security issues (`npm run security:all`)
- [ ] Code complexity within limits (file ≤15, function ≤10)
- [ ] No code duplication introduced
- [ ] Error handling follows contracts (throw, don't return)
- [ ] Module exports maintain backward compatibility
- [ ] Error messages sent as embeds, not plain text
- [ ] No circular dependencies
- [ ] Proper test cleanup implemented
- [ ] No secrets committed (gitleaks verified)

## 🎯 Key Files to Understand

### Critical Files
- `src/services/perplexity-secure.js` - Main AI service
- `src/services/chat.js` - Chat message handling  
- `src/commands/index.js` - Command processing
- `src/utils/error-handler.js` - Error handling system
- `src/config/config.js` - Configuration management

### Important Test Files
- `__tests__/unit/services/perplexity-secure-*.test.js` - Service tests
- `__tests__/unit/chat-service-advanced.test.js` - Chat service tests
- `__tests__/integration/error.test.js` - Error handling tests

## 🔥 DANGER ZONES - READ BEFORE CODING

### Test Environment Gotchas
1. **process.exit() Mocking**: Tests mock process.exit - don't assume it works normally
2. **Lazy Loading**: Services use lazy loading patterns - don't break them
3. **File Permissions**: Uses specific file permissions (0o644 files, 0o755 dirs) - don't remove
4. **Pi Optimizations**: Code has Raspberry Pi detection - don't break config.PI_OPTIMIZATIONS

### Service Integration Points
```javascript
// CRITICAL: Services are integrated, don't create standalone calls
const response = await perplexityService.generateChatResponse(history); // ✅
const response = await directApiCall(history); // ❌ Bypasses caching/throttling
```

## ⚡ Development Commands

### Testing
```bash
npm test                                    # Run all 536+ tests
npm run test:coverage                      # Must maintain 82%+ coverage
npm test __tests__/unit/specific-test.test.js # Run specific test
```

### Quality & Security
```bash
npm run quality:check      # Quality sample analysis
npm run quality:fix        # Auto-fix issues
npm run security:all       # Complete security audit
npm run lint              # ESLint check
npm run format            # Prettier format
```

## 🎯 Success Metrics

A successful implementation should achieve:
- ✅ All 991+ tests passing (current standard)
- ✅ 82%+ code coverage maintained
- ✅ qlty quality checks passing
- ✅ No security vulnerabilities
- ✅ Code complexity within limits
- ✅ No code duplication
- ✅ No secrets in code
- ✅ No circular dependencies
- ✅ Proper error handling contracts
- ✅ Backward compatibility maintained
- ✅ Analytics commands functional (`/analytics`, `/dashboard`, `/resources`)
- ✅ Phase B+C integration complete

## 📚 Additional Resources

### Quality Documentation
- `docs/QLTY_INTEGRATION.md` - qlty usage guide
- `docs/QLTY_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `SECURITY.md` - Security policy
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community guidelines

### Configuration Files
- `.qlty/qlty.toml` - Main qlty configuration
- `.qlty/configs/` - Tool-specific configurations

---

## 🎯 CRITICAL SUCCESS FACTORS

**This codebase has 536+ tests and strict contracts. Breaking any of these will cause cascading failures:**

### Absolutely Required:
1. **Error Handling Contract**: Services THROW errors, tests expect .rejects.toThrow()
2. **Module Exports**: Must maintain all three export patterns for backward compatibility
3. **Config Access**: NEVER at module level - always inside functions
4. **Embed Responses**: All user errors as embeds with exact ErrorHandler messages
5. **Test Assertions**: Use exact values, never expect.objectContaining() or expect.stringContaining()
6. **Service Architecture**: Don't bypass ApiClient, CacheManager, ResponseProcessor, ThrottlingService

### Common Breaking Changes to AVOID:
- Returning error strings instead of throwing
- Module-level config access
- Plain text error responses
- Using test matchers instead of exact values
- Modifying service component architecture
- Breaking module export patterns

**WARNING**: This codebase has been debugged extensively. These patterns exist because alternatives failed. Follow them exactly or expect test failures and runtime errors.

**Remember**: 991+ tests, 82%+ coverage, qlty quality standards - all must pass. When in doubt, follow existing patterns exactly.