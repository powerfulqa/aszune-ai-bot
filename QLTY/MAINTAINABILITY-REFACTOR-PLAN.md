# Aszune AI Bot - Maintainability Improvement Plan

## Current Status: Dashboard-F, Quality-C

### Issues Identified

- **web-dashboard.js**: 402 cyclomatic complexity (target: <100)
- **perplexity-secure.js**: 150 complexity (target: <80)
- **index.js**: 49 complexity (target: <30)
- **database.js**: High duplication with 18+ similar error handling blocks
- **dashboard.js** (frontend): 117 complexity in single class

## Refactoring Strategy

### Phase 1: Web Dashboard Service Refactoring (Priority: Critical)

**Current**: 402 complexity, 3365 lines **Target**: 100 complexity across multiple modules

#### Breakdown Plan:

1. **SocketHandlers.js** (150 lines, 40 complexity)
   - `setupSocketConnection()`
   - `handleAnalyticsRequest()`
   - `handleMetricsRequest()`
   - `handleStatusRequest()`
   - `handleServiceStatusRequest()`

2. **ConfigHandlers.js** (180 lines, 50 complexity)
   - `setupConfigHandlers()`
   - `handleSaveConfig()`
   - `handleDeleteConfig()`
   - `handleBackupConfig()`
   - `validateConfigFile()`

3. **ServiceHandlers.js** (200 lines, 55 complexity)
   - `handleServiceAction()`
   - `handleQuickServiceAction()`
   - `setupServiceStatusRoutes()`
   - `setupControlRoutes()`

4. **DatabaseHandlers.js** (150 lines, 35 complexity)
   - `setupDatabaseRoutes()`
   - `getDatabaseTableContents()`
   - `getDatabaseStats()`
   - `setupDatabaseHandlers()`

5. **NetworkHandlers.js** (140 lines, 40 complexity)
   - `handleNetworkStatus()`
   - `handleNetworkTest()`
   - `getNetworkInterfaces()`
   - `getIPAddresses()`

6. **ReminderHandlers.js** (100 lines, 25 complexity)
   - `setupReminderHandlers()`
   - `handleEditReminder()`
   - `handleDeleteReminder()`

7. **LogsHandlers.js** (80 lines, 20 complexity)
   - `setupLogsHandlers()`
   - `getSystemLogs()`

### Phase 2: Frontend Dashboard Refactoring

**Current**: 117 complexity in single class **Target**: <50 with modular components

#### Components:

- `MetricsDisplayManager` - Handle chart updates and metrics
- `SocketManager` - WebSocket connection and event handling
- `UIStateManager` - DOM updates and UI state
- `DataProcessor` - Response formatting and data transformation

### Phase 3: Perplexity Service Refactoring

**Current**: 150 complexity **Target**: <80

#### Extract Into:

1. **APIClient.js** - HTTP request handling (extract from perplexity-secure.js)
2. **MessageProcessor.js** - Message formatting and validation
3. **CacheHandler.js** - Cache-specific logic
4. **ErrorProcessor.js** - Error handling and categorization

### Phase 4: Code Duplication Elimination

#### Duplicate Cache Stats Pattern (22 lines, 5 locations)

- Create `CacheStatsHelper.js` with `getCacheStatsErrorResponse()`

#### Duplicate Error Response Pattern (18+ locations)

- Create `ErrorResponseHelper.js` with standardized patterns

#### Database Query Duplication (18+ similar blocks)

- Create `DatabaseQueryHelper.js` with `executeQuery()`, `executeQueryWithDefaults()`

## Testing Strategy

After each refactoring phase:

1. Run full test suite: `npm test`
2. Check complexity: `npm run quality:check`
3. Verify coverage thresholds met
4. Run linting: `npm run lint` (if configured)

## Expected Outcomes

### Before Refactoring:

- Maintainability: F (122 code smells)
- Coverage: 75.4%
- High technical debt

### After Refactoring:

- Maintainability: A (target <20 code smells)
- Coverage: >80% (with additional tests)
- Reduced cyclomatic complexity across all modules
- Improved testability and modularity
- Easier to maintain and extend

## Implementation Timeline

1. **Phase 1** (web-dashboard refactoring): High priority, highest impact
2. **Phase 2** (frontend refactoring): Medium priority
3. **Phase 3** (perplexity optimization): High priority
4. **Phase 4** (deduplication): Ongoing, medium priority

## Metrics to Track

- Cyclomatic complexity per file
- Number of code smells
- Test coverage percentage
- Lines of code (goal: reduce while maintaining functionality)
- Number of functions per file (goal: <20 per file)
