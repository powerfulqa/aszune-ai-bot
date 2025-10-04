# Copilot Instructions

You are working on the Aszune AI Bot codebase. Follow these critical patterns:

## 🚨 CRITICAL DANGER ZONES (WILL BREAK 853+ TESTS)

- **Config Access**: NEVER at module level - causes circular dependencies! Always inside functions.
- **Error Contract**: Services THROW errors, never return strings. Tests expect `.rejects.toThrow()`
- **Module Exports**: Must maintain ALL THREE patterns for backward compatibility
- **Test Assertions**: Use EXACT values, never `expect.objectContaining()` or
  `expect.stringContaining()`

## Error Handling Contract (CRITICAL)

- Services MUST throw errors, never return error strings
- Tests expect thrown exceptions: `await expect(service.method()).rejects.toThrow('message')`
- User error messages MUST be Discord embeds with exact ErrorHandler messages
- Use ErrorHandler.handleError() for consistent error responses

## Testing Requirements

- Use EXACT values: `color: "#5865F2"`,
  `description: "An unexpected error occurred. Please try again later."`
- Mock discord.js early in test files with complete method signatures
- Always clean up: `afterEach(() => { conversationManager.clearAll(); jest.clearAllMocks(); })`
- Test all error scenarios extensively - expect embeds, never plain text

## Module Exports (Backward Compatibility)

```javascript
// Required pattern - maintain all three:
module.exports = handleFunction;
module.exports.handleFunction = handleFunction;
module.exports.default = handleFunction;
```

## Code Quality Standards

- File complexity ≤15, function complexity ≤10
- No hardcoded secrets (use environment variables)
- Maintain 82%+ test coverage
- Run `npm run quality:check` before commits
- No circular dependencies (move config access inside functions)

## Command Support

Support both slash commands and text commands with proper interaction mocking.

## Key Commands

- `npm test` - Run all tests
- `npm run quality:check` - Quality analysis
- `npm run security:all` - Security audit
- `npm run quality:fix` - Auto-fix issues

Critical files: `src/services/perplexity-secure.js`, `src/services/chat.js`,
`src/utils/error-handler.js`

## Component Architecture (DO NOT BYPASS)

PerplexityService uses: ApiClient → CacheManager → ResponseProcessor → ThrottlingService

**DEADLY MISTAKES TO AVOID:**

- Module-level config access (circular deps)
- Returning error strings (breaks test contracts)
- Plain text responses (must be embeds)
- Using test matchers (use exact values)

Follow established patterns exactly - this codebase has 853+ tests and strict quality requirements.
