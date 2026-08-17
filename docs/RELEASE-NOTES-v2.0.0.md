# Release Notes v2.0.0

**Release Date:** April 8, 2026

## Overview

Version 2.0.0 is a major release focused on security hardening, architecture cleanup, and Perplexity
API enhancements. The web dashboard was reduced by 625 lines through handler module extraction, all
synchronous file I/O was replaced with async equivalents, and the Perplexity integration now
supports citations, intelligent model selection, and search filtering.

## Security Fixes

### SQL Injection Fix

- **`getPerformanceMetrics()`** in `database.js` previously interpolated the `hours` parameter
  directly into SQL via template literal, bypassing parameterized query protection
- Now validates `hours` to an integer and passes it as a parameterised `?` parameter to
  `datetime('now', ?)`

## Perplexity API Enhancements

### Intelligent Model Selection

- Automatically upgrades from `sonar` to `sonar-pro` for multi-turn conversations (>2 messages)
- Configurable via `API.PERPLEXITY.MULTI_TURN_MODEL` and `MULTI_TURN_THRESHOLD`
- Single-turn queries continue to use the lightweight `sonar` model

### Citation Support

- Enabled `return_citations: true` on all API requests
- Responses now include a compact source footer: _Sources: wowpedia.fandom.com, wowhead.com_
- Limited to 5 domains, displayed as domain names only to stay within Discord embed limits
- Invalid URLs are silently skipped

### Search Domain Filtering

- New `SEARCH_DOMAIN_FILTER` config field to restrict Perplexity searches to authoritative sources
- Empty by default; populate with gaming-specific domains for improved answer quality
- Can be overridden per-request via options

### Search Recency Filter

- Automatically detects time-sensitive queries by scanning for keywords: `latest`, `recent`, `new`,
  `current`, `today`, `patch`, `update`
- When detected, applies `search_recency_filter: 'month'` to prioritise recent results
- Only checks the last user message in conversation history

### Token Usage Tracking

- Every API response now logs `prompt_tokens`, `completion_tokens`, and `total_tokens`
- Visible in application logs as `API Usage: prompt=X, completion=Y, total=Z`

## Architecture Improvements

### Web Dashboard Decomposition

- Removed 625 lines of duplicate inline socket handler code from `web-dashboard.js`
- Wired up the already-extracted handler modules in `web-dashboard/handlers/` (`configHandlers`,
  `logsHandlers`, `networkHandlers`, `reminderHandlers`, `serviceHandlers`)
- Removed unused imports (`fs`, `getBootEnabledStatus`, `buildServiceObject`,
  `buildNetworkInterfaces`, `processReminderRequest`, `processFilterReminders`,
  `testGatewayConnectivity`)
- File reduced from 3,233 to ~2,600 lines

### Async File I/O

- Replaced all `fs.readFileSync()`, `fs.writeFileSync()`, `fs.existsSync()`, `fs.copyFileSync()`,
  and `fs.statSync()` with `fsPromises` equivalents in `web-dashboard.js` and `configHandlers.js`
- Replaced `execSync('git rev-parse --short HEAD')` with async `execPromise()`
- These were previously blocking the Node.js event loop during socket.io and HTTP requests

### Metrics Broadcast Backpressure

- Replaced `setInterval` with self-scheduling `setTimeout` in `metrics-broadcaster.js`
- Prevents overlapping broadcasts when `_broadcastMetrics()` takes longer than the interval

## Bug Fixes

### Conversation Cleanup Threshold

- `cleanupOldConversations()` was using `CACHE.CLEANUP_INTERVAL_MS` (24 hours) as the inactivity
  threshold instead of `CONVERSATION_INACTIVITY_TIMEOUT_MS` (15 minutes)
- Conversations are now cleaned up based on the correct inactivity timeout

### Time Ago Calendar Math

- `getTimeAgo()` previously calculated months as `Math.floor(diffDays / 30)`, which drifted from
  real calendar months near DST transitions and month boundaries
- Now uses calendar-aware arithmetic via `getFullYear()`/`getMonth()`/`getDate()`
- Removed unused `DAYS_PER_MONTH` and `DAYS_PER_YEAR` constants

### Unbounded userStats Map

- `ConversationManager.userStats` Map now caps entries at `DEFAULT_MAX_ENTRIES` (100) during load
- Prevents unbounded memory growth from historical user data

### Empty Catch Blocks

- Added `logger.debug()` to silent `.catch()` handlers in `web-dashboard.js` for service status
  checks and external IP lookups

### Help Command

- Converted string concatenation to template literal for consistency with codebase style

## Testing

### New Test Coverage

- **32 new tests** across 2 new test files:
  - `api-client-search-features.test.js` (20 tests): model selection, search options, payload
    integration, token usage logging
  - `perplexity-secure-search-features.test.js` (12 tests): citation footer, recency filter
    detection, edge cases

### Test Results

- **1,845 tests passing** across 182 suites
- **0 failures** (previously 3 flaky time-ago tests, now fixed)
- ESLint clean on all modified files

## Files Changed

| File                                                    | Change                                             |
| ------------------------------------------------------- | -------------------------------------------------- |
| `src/services/database.js`                              | SQL injection fix                                  |
| `src/services/web-dashboard.js`                         | -625 lines: handler extraction, async I/O, logging |
| `src/services/web-dashboard/handlers/configHandlers.js` | Async file I/O                                     |
| `src/services/web-dashboard/metrics-broadcaster.js`     | Self-scheduling broadcasts                         |
| `src/utils/conversation.js`                             | Cleanup threshold fix, userStats cap               |
| `src/services/api-client.js`                            | Model selection, search options, token logging     |
| `src/services/perplexity-secure.js`                     | Citation footer, recency filter                    |
| `src/config/config.js`                                  | New Perplexity API config fields                   |
| `src/utils/time-ago.js`                                 | Calendar-aware month/year math                     |
| `src/commands/index.js`                                 | Template literal for help command                  |
| `package.json`                                          | Version bump to 2.0.0                              |

## Upgrade Notes

- No breaking changes to bot commands or Discord interactions
- No database migrations required
- New config fields have sensible defaults; no `.env` changes needed
- `SEARCH_DOMAIN_FILTER` is empty by default; optionally populate with gaming domains
- `sonar-pro` model upgrade is automatic for multi-turn conversations; set `MULTI_TURN_MODEL: null`
  in config to disable
