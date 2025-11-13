# Coverage Status (Single Source of Truth)

Last updated: 2025-11-13 (v1.8.0 local run)

## Current Local Metrics

- Tests: 1,231 total / 1,228 passing / 3 skipped
- Statements: 75.57% (12486 / 16521)
- Branches: 81.64% (1806 / 2212)
- Functions: 79.01% (512 / 648)
- Lines: 75.57% (12486 / 16521)

These reflect the latest full `npm run quality:check` execution on the `main` branch.

## Historical Baseline & Policy Shift

- Historical CI target: 82%+ statement coverage (v1.6.x high-water mark)
- v1.7.x dip: Expanded surface (database + reminders) reduced aggregate ratios
- v1.8.0 policy: Dual-threshold enforcement (80% critical files / 65% global baseline)
- Strategy: Protect reliability hotspots while iteratively raising global coverage

## Lowest Coverage Hotspots (Prioritized)

| Module / Area                          | Statements | Branches | Notes |
| -------------------------------------- | ---------- | -------- | ----- |
| `utils/enhanced-conversation-context`  | 0%         | 0%       | Legacy/unused? Confirm usage before investing tests |
| `utils/license-server`                 | 0%         | 0%       | Feature-flagged; add smoke tests only if enabling soon |
| `utils/license-validator`              | 0%         | 0%       | Same as above |
| `services/reminder-service`            | 26.6%      | 50%      | Add lifecycle + edge timing tests |
| `services/cache-manager`               | 56.9%      | 58.3%    | Exercise eviction paths + error fallbacks |
| `utils/time-parser`                    | 39.8%      | 50%      | Complex natural language branches untested |

## Recommended Next Increments (v1.8.0 Roadmap)

1. Add focused tests for `reminder-service` covering:
   - Long interval (>24h) scheduling fallback
   - Cancellation edge (non-existent ID)
   - Restart recovery (simulate persisted reminders)
2. Expand `cache-manager` tests:
   - Tag invalidation paths
   - Eviction strategies (hybrid/LRU/LFU) with boundary triggers
   - Error handling fallbacks returning safe stats
3. Add minimal contract tests for license modules (only if feature-flag activation planned)
4. Create parsing matrix tests for `time-parser` (relative, absolute, malformed, DST boundary)
5. Assess `enhanced-conversation-context` for deprecation vs. revitalization—either remove (and document) or wrap with smoke tests.

## Update Procedure

When you run a fresh full suite and want to update this file:

```powershell
# Run full test + coverage
npm run quality:check
# OR (if you only need coverage)
npm test -- --coverage
```

Then edit this file in a single commit with message:

```
docs: update coverage status (YYYY-MM-DD)
```

Keep rounding consistent: two significant figures (e.g., 72.6%, 67.1%).

## Communication Pattern

- All other README / wiki files should reference this file instead of embedding raw percentages when referring to "current" status.
- Historical release notes should remain unchanged to preserve accuracy at time of release.

## Acceptance Thresholds (v1.8.0 Policy)

| Tier                | Statements | Branches | Action |
| ------------------- | ---------- | -------- | ------ |
| Critical Gate       | ≥80%       | n/a*     | Enforced per critical file config |
| Current Global      | ≥65%       | n/a*     | Baseline satisfied; pursue focused uplifts |
| Next Target Range   | 72–74%     | 70%+     | Add tests for cache-manager, reminder-service, time-parser |
| Strategic Uplift    | 78–82%     | 72%+     | Consider raising global threshold post stability |
| Regressing          | <65%       | <60%     | Investigate immediately; potential CI fail condition |

* Branch coverage monitored (reporting only) until statement/line stability increases.

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

## License & Feature Flags Note

The 0% license-related module coverage is acceptable while license enforcement remains disabled by default. Before enabling any license feature flags in production, raise those modules to at least minimal (≥50%) statement coverage with:

- Validation path test (valid key)
- Failure path test (invalid key)
- Timing-safe comparison test

## FAQ

**Why dual thresholds?** Prevents brittle CI failures while guaranteeing high confidence in core runtime paths.

**Why not immediately restore to 82%?** Large new domains (DB + reminders) expanded faster than test authoring; sustainable uplift avoids churn.

**Why keep historical claims in old release notes?** They reflect accurate state at publication time and support traceability.

**Can we raise branches without full statements first?** Yes—target conditional-heavy utilities (`time-parser`, `cache-manager`) for efficient branch gains; branch uplift precedes future global threshold increases.

---
Canonical coverage reference ends here.
