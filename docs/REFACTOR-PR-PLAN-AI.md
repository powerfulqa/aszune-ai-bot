# Refactor PR Plan (for Claude Opus 4.5)

## Quick Navigation (open these first)

- Repo overview: [README.md](../README.md)
- Entry point / startup sequencing: [src/index.js](../src/index.js)
- Chat pipeline (validation, DB context, reminders, AI):
  [src/services/chat.js](../src/services/chat.js)
- Reminder scheduling + persistence API:
  [src/services/reminder-service.js](../src/services/reminder-service.js)
- Dashboard server (Express/Socket.IO + APIs):
  [src/services/web-dashboard.js](../src/services/web-dashboard.js)
- Dashboard API contract (notes unauthenticated):
  [docs/DASHBOARD-API-REFERENCE-v1.9.0.md](DASHBOARD-API-REFERENCE-v1.9.0.md)
- Coverage policy (single source of truth): [docs/COVERAGE-STATUS.md](COVERAGE-STATUS.md)
- Scripts (tests/lint/format): [package.json](../package.json)

## Execution Notes (for an AI agent)

- Prefer multiple PRs; keep each PR narrowly scoped to one section below.
- After every PR, run `npm test` and `npm run lint`.
- Avoid starting real servers/timers in tests; respect `NODE_ENV=test` and existing test gates.
- Do not add new UX features or new external services; only refactors + safety rails described
  below.

## Objective

Fix correctness bugs and remove waste identified in the review, while improving security posture and
maintainability **without adding new UX/features beyond what already exists**.

## Strategy

Ship as a sequence of small PRs (recommended) to keep diffs reviewable and failures isolated. Each
PR has explicit acceptance criteria and targeted tests.

## Global Constraints (apply to every PR)

- Do not change user-facing command set/UX unless explicitly listed in that PR.
- Keep existing config/env var names working; only add new optional env vars.
- Preserve testability: no new "always-on" intervals/servers in `NODE_ENV=test`.
- Maintain coverage policy in `docs/COVERAGE-STATUS.md`; add tests when behaviour changes.

---

## PR 1 — Single ConversationManager (Correctness + Waste)

### Goal

Eliminate inconsistent rate limiting/history caused by multiple `ConversationManager` instances.

### Problem

`ConversationManager` is instantiated in multiple places, creating divergent state and redundant
background intervals.

### Scope

Create one shared instance and replace all `new ConversationManager()` call sites with imports.

### Implementation Steps

1. Create a singleton module exporting the shared instance; optionally add a second export for "init
   intervals" to ensure only one initializer runs.
2. Replace instantiations in:
   - `src/index.js`
   - `src/services/chat.js`
   - `src/commands/index.js`
   - `src/utils/natural-language-reminder.js`
3. Ensure only one location calls `initializeIntervals()` (recommended: startup in `src/index.js`).
4. Audit tests that assumed separate instances; update tests to reset singleton state between tests
   (expose a `resetForTests()` only in test env if needed).

### Files to Add/Change

- Add: `src/state/conversationManager.js` (or similar "state" folder)
- Update imports/usages in the 4 files listed above.

### Tests

- Add/adjust unit tests to prove:
  - Rate limiting is consistent across chat + slash commands (same timestamps map).
  - Conversation history used by `/summary` matches chat history.
- If the suite uses Jest module caching, ensure singleton is reset between tests (e.g.,
  `jest.resetModules()` or explicit reset helper).

### Acceptance Criteria

- No `new ConversationManager()` remains outside the singleton module.
- Only one interval set is started in non-test runs; zero unintended open handles in tests.
- Chat rate limiting behaves identically regardless of whether user interacts via chat or slash.

---

## PR 2 — Remove Legacy Reminder Command Path (Correctness)

### Goal

Stop routing reminders through a legacy module that doesn't match the current reminder service API.

### Problem

`src/commands/reminder.js` appears incompatible with `src/services/reminder-service.js`, and chat
invokes it indirectly for "simple reminders," risking runtime errors.

### Implementation Steps

1. In `src/services/chat.js`, replace "simple reminder" handling to call the canonical service
   method directly:
   - `reminderService.setReminder(userId, timeString, message, channelId, serverId)`.
2. Remove the dependency on `handleReminderCommand` from the chat path.
3. Decide on legacy module fate:
   - Option A (preferred): delete `src/commands/reminder.js` if truly unused by runtime entrypoints.
   - Option B: keep it but clearly mark as deprecated and make its calls forward to
     `reminderService.setReminder()` using the current signature (only if tests still reference it).
4. Ensure natural-language reminder flows still initialize the reminder service correctly.

### Tests

- Add unit tests for chat "simple reminder" detection to ensure it schedules via `ReminderService`
  and returns the expected response shape.
- Add a test to ensure no require/import of `src/commands/reminder.js` occurs from the chat path (if
  deleted).

### Acceptance Criteria

- "Remind me in 5 minutes …" works via chat without using legacy command module.
- Slash commands `/remind`, `/reminders`, `/cancelreminder` remain unchanged.
- No runtime errors from reminder API signature mismatches.

---

## PR 3 — Dashboard Safety Rails (Security)

### Goal

Reduce risk of accidental remote exposure for an unauthenticated control plane.

### Problems

- Docs state API is unauthenticated (`docs/DASHBOARD-API-REFERENCE-v1.9.0.md`).
- Dashboard uses permissive CORS (`origin: '*'`).
- Dashboard includes service control/config editing routes, which are high-risk if remotely
  reachable.

### Implementation Steps

1. Bind dashboard to localhost by default.
   - Change server listen call to `server.listen(port, host)` where `host` defaults to `127.0.0.1`.
   - Add env override `DASHBOARD_BIND_HOST` to allow advanced users to set `0.0.0.0` intentionally.
2. Add optional token auth for `/api/*`.
   - New env var: `DASHBOARD_TOKEN` (when set, require `Authorization: Bearer <token>`).
   - When not set, preserve existing local-only behaviour (still bound to localhost by default).
3. Tighten CORS.
   - Default allow only localhost origins (or disable CORS entirely unless configured).
   - Add env var `DASHBOARD_CORS_ORIGIN` for explicit override.
4. Update docs:
   - `docs/DASHBOARD-API-REFERENCE-v1.9.0.md` should state localhost-binding + optional bearer
     token.
   - `README.md` should include a short warning about exposing port 3000 and how to secure it.

### Tests

- Add tests in the dashboard route layer to verify:
  - Requests without auth fail with 401 when `DASHBOARD_TOKEN` is set.
  - Requests succeed without auth when `DASHBOARD_TOKEN` is unset.
  - Host binding logic uses default `127.0.0.1` (validate indirectly by mocking the listen call
    args).

### Acceptance Criteria

- Default runtime only listens on localhost.
- Remote access requires explicit opt-in (bind host) and can be protected with a token.
- Existing test suite still passes; no new open handles in `NODE_ENV=test`.

---

## PR 4 — Dashboard Decomposition (Maintainability)

### Goal

Reduce the 3000+ line "god file" while keeping behaviour stable.

### Scope

Mechanical extraction into modules; no endpoint behaviour changes.

### Implementation Steps

1. Identify cohesive regions in `src/services/web-dashboard.js`:
   - log interception/buffering
   - metrics broadcasting interval
   - username resolution/cache
   - server start/stop/bind retry
2. Extract each region into a module under `src/services/web-dashboard/`.
3. Keep `WebDashboardService` as an orchestrator that composes these modules.

### Tests

- Minimal: ensure `start()` and `stop()` still operate as before (existing tests likely cover
  parts).
- Add a regression test to confirm routes are still registered and socket handlers attach.

### Acceptance Criteria

- `src/services/web-dashboard.js` shrinks materially, and extracted modules have single
  responsibilities.
- No API changes and no behaviour drift (same endpoints, same payloads).

---

## PR 5 — Unify "Phone-home" / Verification / Telemetry (Clarity + Waste)

### Goal

Reduce duplication between instance tracking and telemetry; make verification/heartbeats
single-sourced.

### Problem

Both `src/services/instance-tracker/index.js` and `src/utils/metrics/telemetry.js` implement similar
concepts (register/heartbeat/verify/revoke), increasing complexity and risk of inconsistent states.

### Implementation Steps

1. Define a single "beacon client" module that handles:
   - endpoint resolution
   - retry/backoff rules
   - payload format
   - heartbeat timer lifecycle
2. Update instance tracker to own "authorization/kill-switch decisions."
3. Update telemetry to become a thin wrapper over the beacon client, or remove it entirely if
   redundant.
4. Ensure `src/index.js` only initializes one path and state is consistent.

### Tests

- Add unit tests that simulate:
  - verified + authorized
  - verified + unauthorized (with `requireVerification` on/off)
  - revoked response causing shutdown behaviour (only when configured)

### Acceptance Criteria

- Only one component sends heartbeats; no double-registration.
- Verification state is consistent across analytics core and instance tracker.

---

## PR 6 — QLTY/CI Tightening + Dead/Unreachable Code Cleanup

### Goal

Reduce "waste" and enforce quality gates automatically.

### Problems

- Legacy "text command" fields exist but chat ignores most prefixed messages (`!`, `/`), making
  portions of command metadata likely unused.
- Lint exists but may not be enforced in CI.
- Type safety is JS-only; JSDoc/`@ts-check` could prevent signature mismatches like the reminder
  issue.

### Implementation Steps

1. CI: ensure `npm run lint` runs in CI (modify workflow under `.github/workflows/*` if present).
2. Dead code: audit `textCommand`/alias handling and remove if truly unused by runtime.
   - If uncertain, keep metadata fields but remove any runtime code that tries to route text
     commands.
3. Add `// @ts-check` to high-risk files (dashboard routes, reminder service, chat service) and fix
   surfaced issues using JSDoc types (no TS migration required).
4. Add a short architecture doc clarifying singletons/services and call paths (optional but
   recommended).

### Tests

- Run full `npm test` and `npm run lint` in CI.
- Add at least one "signature check" test ensuring chat reminder path calls the canonical reminder
  API.

### Acceptance Criteria

- CI fails on lint errors.
- Unreachable legacy paths are removed or explicitly deprecated.
- High-risk modules have basic `@ts-check` coverage with no new warnings.

---

## Execution Order (Recommended)

1. PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6

**Rationale:** PR 1/2 fix real correctness bugs; PR 3 addresses security risk; PR 4/5/6 reduce
long-term maintenance and prevent regressions.

## Note

If you need this as a single PR instead of a series, merge the steps, but keep commits grouped per
PR section so rollback remains possible.
