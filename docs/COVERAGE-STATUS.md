# Coverage Status (Single Source of Truth)

Last updated: 2026-10-04 (v2.3.0)

## Current Local Metrics

- Tests: 2,036 total / 2,036 passing / 0 skipped
- Test Suites: 193 total
- Statements: 81.9%
- Branches: 86.1%
- Functions: 78.3%
- Lines: 81.9%

These reflect the latest full `npm test` execution on the `main` branch.

## Historical Baseline & Policy

- Historical CI target: 82%+ statement coverage (v1.6.x high-water mark)
- v1.8.0 policy: Dual-threshold enforcement (80% critical files / 65% global baseline)
- Strategy: Protect reliability hotspots while iteratively raising global coverage

## Acceptance Thresholds (current)

| Tier           | Gate                                                 | Source                                    |
| -------------- | ---------------------------------------------------- | ----------------------------------------- |
| Global Minimum | ≥70% statements, branches, functions and lines       | `jest.config.js`                          |
| Critical Gate  | Per-file thresholds on critical files (76-80% stmts) | `config/jest.critical-coverage.config.js` |

## Update Procedure

When you run a fresh full suite and want to update this file:

```powershell
npm test -- --coverage
```

Then edit this file in a single commit with message:

```
docs: update coverage status (YYYY-MM-DD)
```

## Communication Pattern

- All other README / wiki files should reference this file instead of embedding raw percentages.
- Historical release notes should remain unchanged to preserve accuracy at time of release.

- Branch coverage monitored (reporting only) until statement/line stability increases.

## Test Suite Composition Snapshot

- Unit suites: broad coverage of services, utils, parsing, caching, performance, database
- Integration suites: command handling, error propagation, message flow
- Branch configs: dedicated logger + index branch coverage harnesses
- Skipped tests: 3 (investigate whether they are legacy or flaky; prefer deletion or repair)

## Flakiness Watch

No current flakes detected in last run (0 retries, no transient failures). If flakes emerge:

1. Tag with `@flaky` in test name
2. Isolate timing or environment dependencies (fake timers, deterministic seeds)
3. Update this section with remediation notes

## FAQ

**Why dual thresholds?** Prevents brittle CI failures while guaranteeing high confidence in core
runtime paths.

**Why not immediately restore to 82%?** Large new domains (DB + reminders) expanded faster than test
authoring; sustainable uplift avoids churn.

**Why keep historical claims in old release notes?** They reflect accurate state at publication time
and support traceability.

**Can we raise branches without full statements first?** Yes—target conditional-heavy utilities
(`time-parser`, `cache-manager`) for efficient branch gains; branch uplift precedes future global
threshold increases.

---

Canonical coverage reference ends here.
