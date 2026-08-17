# CLAUDE.md — Aszune AI Bot

Authoritative guidance for AI coding agents (Claude, Copilot, Cursor) working in this repo.
This file supersedes the older, divergent instruction files under `.github/` and `.cursor/`.

## 🔒 Protected subsystem — read first

The license-enforcement / instance-tracking subsystem is **off-limits for disabling or bypassing**:

- `src/utils/metrics/*`
- `src/services/instance-tracker/*`
- `scripts/tracking-server.js`
- any session-validation / verification logic

See `.github/AGENT-SECURITY.md` and `docs/METRICS-INTERNALS.md`. You may **harden** it (e.g. remove
default secrets, add persistence) but never add a disable/bypass path or weaken enforcement.

## Project overview

Discord bot specialising in gaming lore, guides, and advice via the Perplexity API. Self-hosted,
primary target a Raspberry Pi 5 (PM2). Node.js, CommonJS, no build step.

- AI chat (Perplexity `sonar`/`sonar-pro`) with per-user conversation history + citations
- Natural-language reminders (chrono-node) persisted in SQLite (`better-sqlite3`)
- Express + Socket.IO admin dashboard (`src/services/web-dashboard.js`, bound to `127.0.0.1:3000`)
- Discord analytics/monitoring commands; Raspberry Pi resource optimisations

## Toolchain (current)

- **Node** `>=22.19.0` (see `.nvmrc` = 24). CI matrix tests 22 + 24.
- **ESLint 10**, flat config in `eslint.config.js` (there is no `.eslintrc.json`).
- **Jest 30**, config in `jest.config.js`; setup in `jest.setup.js`.
- **Prettier 3.9**. Runtime deps: discord.js 14, express 5, undici 8, better-sqlite3 13, dotenv 17.
- Dependency updates are automated via `.github/dependabot.yml`.

## Architecture — service layer (do not bypass)

```
Discord command / message
  → src/index.js                     (orchestration, intents, graceful shutdown)
  → src/services/chat.js             (message handling, reminder detection)
  → src/services/perplexity-secure.js
       ├── ApiClient          (src/services/api-client.js — undici HTTP)
       ├── CacheManager       (src/services/cache-manager.js → utils/enhanced-cache.js)
       ├── ResponseProcessor  (src/services/response-processor.js)
       └── ThrottlingService  (src/services/throttling-service.js)
```

`PerplexityService` uses composition and must expose `this.cacheManager` (NOT `this.cache`); always
delegate through it (`this.cacheManager.getStats()`). Never reach past a service into its components.

## Contracts — never violate

1. **Services throw; they do not return error strings.** Tests expect thrown exceptions.
   ```js
   catch (error) { throw error; }            // ✅ re-throw to preserve the contract
   catch (error) { return 'Error: ' + …; }   // ❌ breaks error tests
   ```
2. **User-facing errors are Discord embeds**, never plain text — route through
   `ErrorHandler.handleError(error, context)` and reply with an embed.
3. **Database errors are logged and isolated — never re-thrown.** The DB is an enhancement; a DB
   failure must not break the conversation flow.
   ```js
   try { databaseService.addUserMessage(userId, content); }
   catch (dbError) { logger.warn('Database error:', dbError.message); /* continue */ }
   ```
4. **Access `config` inside functions, never at module top level** — a module-level
   `require('../config/config')` read creates a circular dependency. Lazy-require inside the function.
5. **Preserve the triple export idiom** where it exists (backward compatibility):
   ```js
   module.exports = handleChatMessage;
   module.exports.handleChatMessage = handleChatMessage;
   module.exports.default = handleChatMessage;
   ```
6. **No `console.*` in `src/`** — use `src/utils/logger.js`. (The dashboard and `Logger` internals
   are the only exceptions.)
7. **Never log or hardcode secrets.** Tokens/keys come from env only, validated at boot in
   `src/config/config.js`.

## Testing

- Framework Jest 30, `testEnvironment: node`, v8 coverage. Run: `npm test`.
- Coverage gate — **single source of truth is `jest.config.js`: global 70%** on
  branches/functions/lines/statements. `config/jest.critical-coverage.config.js` adds stricter
  per-file gates used by `test:critical`/`precommit`.
- **Assert exact values** — `toHaveBeenCalledWith({ … exact … })`, not `expect.objectContaining`
  / `expect.any()`.
- **Expect thrown errors** — `await expect(fn()).rejects.toThrow('…')`, not returned strings.
- Discord.js and the database service are mocked in unit tests; `jest.setup.js` resets modules
  before each test (singletons re-instantiate per test).

## Quality budget

- Enforced by ESLint (`eslint.config.js`): **complexity ≤ 15**, `max-lines-per-function` 50 (200 in
  tests), `max-depth` 4, `max-statements` 25. This is the single source of truth for the budget.
- Lint the whole tree: `npx eslint src __tests__ --max-warnings=0` (CI runs this).

## Commands

```bash
npm start                 # run the bot (node src/index.js)
npm run dev               # nodemon
npm test                  # full Jest suite
npm run coverage          # suite + coverage report
npm run test:critical:ci  # per-file critical-coverage gate (precommit)
npm run lint              # eslint src __tests__      (lint:fix to autofix)
npm run format            # prettier --write
npm run quality:check     # lint + critical coverage
npm audit --audit-level=high   # security (CI gates on this, prod deps)
```

## Gotchas (hard-won)

- **Jest mocking:** never combine `jest.doMock()` with `jest.resetModules()` — `resetModules()`
  clears `doMock` registrations, so the module then loads unmocked and assertions fail with
  "Received has type: function". Register mocks with `jest.mock(...)` at file scope and
  `jest.clearAllMocks()` in `beforeEach`. Prefer verifying handler registration over executing
  complex mock chains.
- **Discord fetches** must be timeout-guarded (`Promise.race` with a ~5s timeout) with fallback
  estimates — see `src/utils/guild-member-stats.js`.
- **PM2 vs systemd:** running the bot under both simultaneously causes a ~15s restart loop. Pick
  one. Diagnostics: `scripts/diagnose-restart-loop.sh`, `scripts/find-sigint-source.sh`.

## Deployment

PM2 via `ecosystem.config.js` — two apps: **`aszune-ai`** (the bot; this is the canonical PM2 name,
not `aszune-bot`) and `Aszune-analytics` (the tracking server on :3001). Use
`src/utils/pm2-service.js` for any PM2 control code rather than hardcoding a name or shelling a
command string. On the Pi, start via `start-pi-optimized.sh` to apply optimisations.

Key env vars: `DISCORD_BOT_TOKEN`, `PERPLEXITY_API_KEY` (required); `DASHBOARD_TOKEN` (enables the
dashboard's destructive operations — without it the dashboard is read-only); `TRACKING_ADMIN_KEY`
(required to start the tracking server); `SEARCH_DOMAIN_FILTER` (optional comma-separated Perplexity
allowlist). See `.env.example`.
