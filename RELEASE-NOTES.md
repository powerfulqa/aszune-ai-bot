# Release Notes

---

## Initial Release

### Initial Release

- First public release of Aszune AI Bot.
- Features:
  - Discord bot using Perplexity API (sonar model).
  - Maintains per-user conversation history.
  - Emoji reactions based on keywords.
  - Rate limiting to prevent spam.
  - `.env`-based configuration for secrets.
  - Basic commands: `!help`, `!clearhistory`, `!summary`.

---

## Enhancements

- Added `!summarise <text>` command for summarising arbitrary text.
- Improved help command output.
- All bot replies and summaries use UK English spelling and phrasing.
- Improved error handling and environment variable checks.
- Refactored command handling for easier extension.
- Switched conversation history and rate limiting to use JavaScript `Map` for better performance.

---

## CI/CD & Testing

- Added Jest unit and integration tests for core utilities and bot logic.
- Added Codecov integration for code coverage reporting.
- Improved test coverage to 100% for utility modules.
- Added GitHub Actions workflow for CI:
  - Runs tests and uploads coverage to Codecov.
  - Uses Node.js 18.
  - Improved reliability by updating to `codecov/codecov-action@v4`.
  - Added `persist-credentials: false` to checkout step.
  - Enabled `fail_ci_if_error: true` for Codecov upload.
- **Workflow Maintenance:**  
  - Addressed warnings and errors in the GitHub Actions workflow by upgrading the Codecov action and following new setup recommendations.
  - Reduced retry/backoff issues and improved CI reliability.
- **Additional Tests Added:**
  - Emoji utility: tested multiple keywords, order, empty strings, and keywords inside other words.
  - Command handling: tested unknown commands and summary with no conversation history.
  - Error handling: tested summary API failure and main API failure.
  - Ensured all new tests are included in Codecov coverage reporting.

---

## Bugfixes & Maintenance

- Fixed 504 Gateway Timeout errors in Codecov GitHub Action by upgrading to v4 and following new setup recommendations.
- Updated documentation and README for new features and troubleshooting.
- Added rollback script for production safety.
- Improved PM2 ecosystem config and deployment instructions.

---
