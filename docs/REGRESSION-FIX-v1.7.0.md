# v1.7.0 Post-Release Regression & Stability Fixes (October 9-10, 2025)

After the v1.7.0 release (Database Integration & Reminder System) several small but important
regression and clarity issues were identified and addressed without changing any public APIs. This
document records ONLY the incremental fixes – it does not duplicate the full release notes.

## ✅ Summary of Fixes

- **Cache & Memory Reporting Clarity** (`feat: Improve cache and memory reporting clarity`)
  - Normalised memory unit formatting ("0 B / 50 MB")
  - Ensured hit rate always displays a percentage (no blank/undefined values)
  - Added explicit entry count and eviction strategy labels
  - Improved uptime formatting (seconds → human readable)
- **Dashboard Warning Normalisation**
  (`fix: Dashboard warnings, memory status clarity, server count accuracy, and Pi detector`)
  - Removed noisy / duplicate warning lines from performance dashboard output
  - Corrected server count calculation logic for analytics consistency
  - Clarified memory status thresholds vs critical levels
  - Hardened Raspberry Pi model detection fallback path (graceful Unknown handling)
- **Undici / Web API Test Compatibility**
  (`fix: Add File API mock for undici compatibility in tests`)
  - Added lightweight `global.File` mock in `jest.setup.js` so undici-based code paths can run in
    Jest without external polyfills
  - Prevents future silent failures when adding features relying on `File` / `Blob`
- **Startup Script Improvements** (`start-pi-optimized.sh`)
  - Added executable permissions & model‑aware adaptive debounce / connection limits
  - Minor wording improvements and root execution warnings for skipped optimisations
- **Documentation Hygiene**
  - Added this regression summary file (non-breaking, additive)
  - To be referenced from README, release notes, and wiki version history

## 🔍 Rationale

These fixes were applied to improve operational clarity (metrics, thresholds) and test stability
without altering core behaviours of caching, analytics, reminder scheduling, or persistence.

## 🧪 Testing Impact

- Jest setup change isolated to test environment – production unaffected
- Cache / dashboard output validated via existing analytics & cache command tests (no new test
  contracts introduced)
- Pi detector adjustments retain previous success paths while adding safer fallbacks

## 🛠️ Deployment Notes

- No environment variable changes
- No database migrations
- Safe to roll forward – no rollback required
- Tag `v1.7.0` force‑updated to latest commit including these fixes

## 📌 Cross-References

- Main Release Notes: `RELEASE-NOTES-v1.7.0.md`
- README Changelog: v1.7.0 section (now includes post-release blurb)
- Jest Setup: `jest.setup.js` (File mock)
- Pi Script: `start-pi-optimized.sh`

---

Focused, additive fixes – core v1.7.0 feature set unchanged.
