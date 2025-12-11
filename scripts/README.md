# Aszune AI Bot - Utility Scripts

Development and maintenance utility scripts for Aszune AI Bot.

## 📁 Available Scripts

### Development & Testing

| Script                       | Description                       |
| ---------------------------- | --------------------------------- |
| `run-tests.bat`              | Run all tests on Windows          |
| `start-test.bat`             | Start test environment            |
| `test-message-formatting.js` | Test message formatting utilities |
| `test-perplexity-api.js`     | Test Perplexity API connectivity  |

### Code Quality

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `format-code.ps1`      | Format code with Prettier        |
| `fix-line-endings.ps1` | Normalize line endings (CRLF→LF) |

### Diagnostics

| Script                     | Description                          |
| -------------------------- | ------------------------------------ |
| `check-triggers.js`        | Database trigger validation          |
| `diagnose-restart-loop.sh` | Diagnose PM2 restart loop issues     |
| `find-sigint-source.sh`    | Find SIGINT signal sources           |
| `fix-production.bat`       | Production environment fix utilities |

## 🚀 Usage

### Running Tests

```cmd
# Windows Command Prompt
scripts\run-tests.bat

# Start test environment
scripts\start-test.bat
```

### Code Formatting

```powershell
# PowerShell
.\scripts\format-code.ps1
.\scripts\fix-line-endings.ps1
```

### API Testing

```bash
# Test Perplexity API connectivity
node scripts/test-perplexity-api.js

# Test message formatting
node scripts/test-message-formatting.js
```

### Database Diagnostics

```bash
# Check database triggers
node scripts/check-triggers.js
```

### Production Fixes

```cmd
# Fix common production issues
scripts\fix-production.bat
```

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/powerfulqa/aszune-ai-bot/issues)
- **Documentation**: [Main README](../README.md)
