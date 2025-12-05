# Aszune AI Bot (v1.10.0)

[![CI/CD](https://github.com/chrishaycock/aszune-ai-bot/actions/workflows/unified-ci.yml/badge.svg)](https://github.com/chrishaycock/aszune-ai-bot/actions/workflows/unified-ci.yml)
[![Codecov](https://codecov.io/gh/chrishaycock/aszune-ai-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/chrishaycock/aszune-ai-bot)
[![Maintainability](https://qlty.sh/badges/89f58366-59f3-43bb-8a8a-6b02c47c7ad9/maintainability.svg)](https://qlty.sh/gh/chrishaycock/projects/aszune-ai-bot)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/Tests-1661%20Passing-brightgreen.svg)](#testing--coverage)

[Release Notes](./docs/RELEASE-NOTES-v1.10.0.md) |
[Dashboard Overview](./wiki/Dashboard-Features-Complete.md) | [Documentation Wiki](./wiki/Home.md)

**Aszune AI Bot** is a professional Discord bot that combines advanced AI conversation capabilities
with comprehensive analytics and monitoring features. Built for gaming communities, it provides
lore, guides, and advice using the Perplexity API's **sonar** model while offering real-time
performance dashboards and server analytics directly within Discord.

## Key Features

- 🤖 **AI-Powered Conversations** - Context-aware chat using Perplexity API's sonar model
- 📊 **Web Dashboard** - Real-time monitoring with logs, services, network status, and configuration
- ⏰ **Smart Reminders** - Natural language reminder scheduling with Discord notifications
- 📈 **Analytics** - Server analytics, user engagement metrics, and performance monitoring
- 🍓 **Raspberry Pi Optimized** - Specialized optimizations for resource-constrained devices

**Current Status**: 1,661 tests passing – 70%+ coverage thresholds

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Bot Commands](#bot-commands)
- [Web Dashboard](#web-dashboard)
- [Analytics & Monitoring](#analytics--monitoring)
- [Project Structure](#project-structure)
- [Code Quality](#code-quality)
- [Testing & Coverage](#testing--coverage)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Features
- 🕒 **Rate Limiting:** Prevents users from spamming the bot by enforcing a short cooldown between
  messages.
- 📝 **Help Command:** `/help` - list all available commands and usage
- 🧾 **Conversation Summary:** `/summary` - generate a summary of your current conversation
- 📝 **Text Summarisation:** `/summarise <text>` - summarise any provided text
- 🆕 **Stats Tracking:** `/stats` - view your usage statistics
- ⏰ **Reminder System:** `/remind`, `/reminders`, `/cancelreminder` - AI-powered natural language reminders
- 📊 **Analytics:** `/analytics`, `/dashboard`, `/resources`, `/cache` - comprehensive monitoring
- 🇬🇧 **UK English Responses:** All bot replies use UK English spelling and phrasing
- 📋 **Slash Command Support:** All commands available as modern Discord slash commands
- 🧪 **Comprehensive Testing:** 1,661+ tests with 80%+ coverage on critical components
- 🌐 **Web Dashboard:** Optional Express + Socket.io dashboard with live metrics
- 💾 **Persistent Storage:** SQLite database for conversation history and user analytics
- 🍓 **Raspberry Pi Optimised:** Specialised performance optimisations for Pi 3+
- 🛡️ **Code Quality:** QLTY integration with 94.8% ESLint fix rate and systematic complexity reduction

---

## Web Dashboard

The web dashboard provides comprehensive monitoring and management:

- **Real-Time Log Viewer:** Live log streaming with filtering, search, and export
- **Service Status:** Monitor and control bot services with systemd integration  
- **Configuration Editor:** Safe .env and config.js editing with validation
- **Network Status:** Interface monitoring, connectivity checks, public IP detection
- **Reminder Management:** Create, view, edit, and manage reminders via web UI

**Access:** `http://localhost:3000` while the bot is running

For detailed API reference and technical specifications, see [RELEASE-NOTES-v1.9.0.md](docs/RELEASE-NOTES-v1.9.0.md).

---

## Installation

### Prerequisites

- Node.js v20.18.1 or later
- A Discord bot token (from the
  [Discord Developer Portal](https://discord.com/developers/applications))
- A valid [Perplexity AI API key](https://www.perplexity.ai/)

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/chrishaycock/aszune-ai-bot.git
   cd aszune-ai-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a `.env` file**

   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   ```

4. **Database Setup (Automatic)**

   The bot automatically creates and manages a SQLite database:
   - **Auto-created:** Database file created automatically on first run
   - **Location:** `./data/bot.db` (configurable via `DB_PATH`)
   - **No manual setup required:** The bot handles all database initialization

5. **Optional: License System (Feature Flagged)**

   The license validation system is currently **disabled by default**. You can:
   - **Use without license**: Bot works normally with all v1.6.2 analytics features
   - **Enable license features**: Set environment variables to test license functionality
   - **Development mode**: Set `NODE_ENV=development` to enable all license features

   ```env
   # Optional License Configuration (disabled by default)
   ASZUNE_LICENSE_KEY=your_license_key_here

   # Enable specific license features for testing
   ENABLE_LICENSE_VALIDATION=true
   ENABLE_LICENSE_SERVER=true
   ENABLE_LICENSE_ENFORCEMENT=true

   # OR enable everything for development
   NODE_ENV=development
   ```

   **License Registration** (when enabled):
   [Create License Registration](https://github.com/chrishaycock/aszune-ai-bot/issues/new?labels=license-registration&template=license-registration.md&title=Personal%20License%20Request)

---

## Usage

### Running the Bot Manually

```bash
node src/index.js
```

You should see:

```
Discord bot is online!
```

Your bot should now appear online in your Discord server.

### Running on Raspberry Pi 3

For optimal performance on Raspberry Pi 3, use the provided script:

```bash
# Make the script executable
chmod +x start-pi-optimized.sh

# Run with optimisations
./start-pi-optimized.sh
```

This script applies several performance optimisations:

- Sets memory limits appropriate for Pi 3
- Reduces CPU and memory usage
- Optimises network connections
- Configures compact mode for responses

For more details on Pi optimisations, see the
[Raspberry Pi Optimisation Guide](wiki/Pi-Optimization-Guide.md).

---

### Running with PM2 (for Production & Raspberry Pi)

PM2 keeps the bot alive in the background and restarts it on crashes or reboots.

#### Recommended: Using the Pi Optimisation Shell Script

To run the bot with full Raspberry Pi optimisations, use the provided shell script as your PM2 entry
point:

```bash
pm2 start start-pi-optimized.sh --name aszune-bot --interpreter bash
pm2 startup
pm2 save
```

This ensures all Pi-specific environment variables and system-level tweaks are applied before
starting the bot, and enables automatic restart after a reboot.

**Note:** Running `pm2 start src/index.js` will NOT apply Pi optimisations. Always use the shell
script for Pi deployments.

---

### Web Dashboard Access (v1.8.0)

- Access: `http://localhost:3000` while the bot is running
- Details: see `docs/DASHBOARD-v1.8.0-RELEASE.md` for features and screenshots

---

## Bot Commands

### Core Commands

| Command             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `/help`             | Shows a list of available commands and usage                |
| `/clearhistory`     | Clears your conversation history                            |
| `/summary`          | Summarises your current conversation in UK English          |
| `/summarise <text>` | Summarises any provided text in UK English                  |
| `/stats`            | Shows your usage stats (messages sent, summaries requested) |

### Reminder Commands (NEW in v1.7.0)

| Command           | Description                                       |
| ----------------- | ------------------------------------------------- |
| `/remind`         | Set a reminder with natural language time parsing |
| `/reminders`      | List all your active reminders                    |
| `/cancelreminder` | Cancel a specific reminder by ID                  |

### Analytics Commands (NEW in v1.6.0)

| Command      | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `/analytics` | Show Discord server analytics and performance insights          |
| `/dashboard` | Display comprehensive performance dashboard with real-time data |
| `/resources` | View resource optimization status and recommendations           |
| `/cache`     | Display cache statistics and performance metrics (Fixed v1.6.5) |

> **Note:** All commands are available as modern Discord slash commands.

---

## Analytics & Monitoring

### 📊 Real-time Discord Analytics

Version 1.6.0 introduces comprehensive analytics accessible directly within Discord:

#### `/analytics` - Real-time Discord Server Analytics

- **Live Member Data**: Real Discord server statistics with timeout protection (v1.6.1)
- **Active User Counts**: Live online/idle/dnd member filtering (e.g., "Active Users: 102")
- **Server Statistics**: Total members, bot counts, human member ratios
- **Presence Detection**: Real-time member activity status from Discord API
- **Fallback Protection**: Intelligent estimates when Discord API is slow or unavailable

#### `/dashboard` - Synchronized Performance Monitoring

- **Consistent Data**: Same Discord member counts as `/analytics` for reliability (v1.6.1)
- **System Metrics**: Real-time CPU, memory, and network utilization
- **Performance Correlation**: System load analysis with actual Discord server activity
- **Resource Optimization**: Performance recommendations based on real usage patterns
- **Timeout Protection**: 5-second response guarantee with graceful fallbacks

#### `/resources` - Resource Optimization

- **Resource Analysis**: Detailed system resource usage and optimization opportunities
- **Performance Recommendations**: Automated suggestions for improving bot performance
- **Capacity Planning**: Usage projections and scaling recommendations
- **System Health**: Comprehensive health assessments and maintenance guidance

#### `/cache` - Cache Statistics (Fixed v1.6.5)

- **Performance Metrics**: Hit rate, cache hits/misses, operation counts
- **Memory Usage**: Current cache memory usage and limits (e.g., "0 B / 50 MB")
- **Configuration**: Eviction strategy and uptime information (e.g., "Strategy: hybrid, Uptime:
  28s")
- **Operations Tracking**: Sets, deletes, evictions statistics
- **Complete Field Coverage**: All statistics display proper values (no more "undefined")

### 🔧 License Monitoring System

Built-in license validation and monitoring:

- **Automatic Validation**: License checked every 24 hours
- **Violation Detection**: Unauthorized usage automatically reported
- **Grace Period**: 7-day grace period for new installations
- **Remote Monitoring**: Optional license server for centralized tracking
- **Raspberry Pi Integration**: Specialized setup for Pi-based monitoring

### 📈 Benefits

- **No External Tools Required**: All monitoring accessible within Discord
- **Proactive Management**: Early warning system for issues
- **Data-Driven Decisions**: Usage analytics for community optimization
- **Cost Reduction**: Eliminates need for third-party monitoring services
- **Complete Control**: Self-hosted solution with full data ownership

---

## Project Structure

```
aszune-ai-bot/
├── src/
│   ├── index.js                    # Main entry point
│   ├── commands/                   # Command handlers (slash commands only)
│   │   ├── index.js               # Unified command handler
│   │   └── reminder.js             # Reminder command handler
│   ├── config/                     # Configuration settings
│   │   └── config.js              # Global configuration
│   ├── services/                   # API and core services
│   │   ├── api-client.js           # HTTP requests and API communication
│   │   ├── cache-manager.js        # Response caching and cleanup management
│   │   ├── chat.js                 # Chat message handler
│   │   ├── database.js             # SQLite database service with reminder support
│   │   ├── perplexity-secure.js    # Perplexity API service
│   │   ├── reminder-service.js     # Reminder scheduling and management
│   │   ├── response-processor.js   # API response processing and formatting
│   │   ├── storage.js              # Data storage service
│   │   └── throttling-service.js   # Rate limiting and connection throttling
│   └── utils/                      # Utility functions and helpers
│       ├── cache-pruner.js        # Cache cleanup utilities
│       ├── connection-throttler.js # Connection throttling
│       ├── conversation.js        # Conversation management
│       ├── debouncer.js           # Function debouncing
│       ├── discord-analytics.js   # Discord analytics utilities
│       ├── emoji.js               # Emoji processing
│       ├── enhanced-cache.js      # Enhanced caching
│       ├── enhanced-conversation-context.js # Conversation context
│       ├── error-handler.js       # Error handling utilities
│       ├── input-validator.js     # Input validation and sanitization
│       ├── lazy-loader.js         # Lazy loading utilities
│       ├── license-server.js      # License server utilities
│       ├── license-validator.js   # License validation
│       ├── logger.js              # Logging utilities
│       ├── memory-monitor.js      # Memory monitoring and GC
│       ├── message-chunker.js     # Message chunking
│       ├── message-chunking/      # Enhanced chunking system
│       │   ├── index.js           # Main chunking coordinator
│       │   ├── chunk-boundary-handler.js
│       │   ├── source-reference-processor.js
│       │   └── url-formatter.js
│       ├── message-formatter.js   # Message formatting
│       ├── natural-language-reminder.js # AI-powered reminder detection
│       ├── performance-dashboard.js # Performance dashboard
│       ├── performance-monitor.js # Performance tracking
│       ├── performance-tracker.js # Performance metrics
│       ├── pi-detector.js         # Raspberry Pi detection
│       ├── resource-optimizer.js  # Resource optimization
│       ├── security-monitor.js    # Security monitoring
│       ├── testUtils.js           # Test utilities
│       └── time-parser.js         # Advanced time parsing for reminders
├── data/                           # Persistent data storage
│   ├── bot.db                     # SQLite database (auto-created)
│   ├── question_cache.json        # Response cache
│   ├── test.db                    # Test database
│   └── user_stats.json            # User statistics (legacy)
├── docs/                          # Version-specific documentation
├── scripts/                       # Development and utility scripts
│   ├── check-triggers.js          # Database trigger validation
│   ├── fix-line-endings.ps1       # Line ending normalization
│   ├── fix-production.bat         # Production fix utilities
│   ├── format-code.ps1            # Code formatting scripts
│   ├── generate-license.*         # License generation tools
│   ├── pi-license-setup.sh        # Raspberry Pi license setup
│   ├── run-tests.bat              # Test execution scripts
│   ├── start-test.bat             # Test environment setup
│   └── README.md                  # Scripts documentation
├── wiki/                          # Comprehensive documentation
├── __tests__/                     # Test suites
│   ├── integration/               # Integration tests
│   ├── unit/                      # Unit tests
│   └── utils/                     # Test utilities
├── __mocks__/                     # Test mocks
├── coverage/                      # Code coverage reports
├── test-results/                  # Test result outputs
├── logs/                          # Application logs
├── .qlty/                         # Code quality configuration
│   ├── qlty.toml                 # Main qlty configuration
│   └── configs/                   # Tool-specific configurations
├── .github/                       # GitHub configuration
├── .cursor/                       # Cursor IDE configuration
├── package.json                   # Project metadata
├── ecosystem.config.js            # PM2 deployment config
├── jest.config.js                 # Jest test configuration
├── jest.setup.js                  # Jest setup file
├── .prettierrc                    # Prettier configuration
├── .eslintrc.json                 # ESLint configuration
├── .env.example                   # Environment variables example
├── SECURITY.md                    # Security policy and guidelines
├── CONTRIBUTING.md                # Contribution guidelines
├── CODE_OF_CONDUCT.md             # Community code of conduct
├── CHANGELOG.md                   # Project changelog
├── LICENSE                        # License file
└── .env                           # Environment secrets (not committed)
```

---

## Code Quality

This project maintains high code quality standards using [qlty](https://qlty.sh/) for unified
linting, formatting, security scanning, and maintainability analysis.

### Quality Standards

- **Test Coverage:** 1,661+ tests passing – dual thresholds: ≥80% critical files / ≥65% global baseline
- **Code Quality:** 94.8% reduction in ESLint issues with systematic complexity reduction
- **Security:** Zero tolerance for secrets, timing-safe authentication, vulnerability scanning
- **Code Complexity:** Max 15 complexity per file, 10 per function
- **Formatting:** Consistent code style with Prettier

### Running Quality Checks

```bash
npm run quality:check    # Quick quality check
npm run quality:fix      # Auto-fix formatting and linting
npm run quality:metrics  # View code metrics and complexity
npm run quality:smells   # Detect code smells and duplication
npm run security:all     # Full security scanning
```

For detailed information, see [QLTY/README.md](QLTY/README.md).

---

## Testing & Coverage

```bash
npm test                    # Run all tests
npm run coverage            # Run tests with coverage report
npm run test:branch-coverage # Run branch coverage tests
```

The test suite includes:
- Unit tests for all service modules
- Integration tests for bot functionality
- Database integration tests
- Branch coverage tests for critical components

For detailed testing information, see [Testing Guide](./wiki/Testing-Guide.md).

Live coverage metrics are maintained in [docs/COVERAGE-STATUS.md](docs/COVERAGE-STATUS.md).

---

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment. The pipeline:

1. **Builds** the application
2. **Runs all tests** with coverage reporting
3. **Performs security checks** using npm audit
4. **Uploads coverage data** to Codecov and QLTY
5. **Prepares for deployment** when merging to main branch

View the CI/CD workflow in `.github/workflows/unified-ci.yml`

---

## Troubleshooting

### 🔴 Bot Offline or Invalid Token

- Double-check your `DISCORD_BOT_TOKEN` in `.env`
- Confirm the token has not been regenerated or revoked
- Ensure your bot has permission to join and read messages in your server

### 🔴 Perplexity API Errors (400 / 401)

- Validate your API key is current and supports the `chat/completions` endpoint
- Ensure model name is `"sonar"` and the format of your payload is correct
- Test the same key using a tool like Postman or curl

---

## Future Enhancements

- [ ] Add clickable sources and reference links from Perplexity results
- [ ] Enhance error handling with retry/backoff logic for API rate limits
- [ ] Implement AI-powered content moderation for safer interactions

---

## Contributing

Pull requests and ideas are always welcome! Please:

1. Fork the repository
2. Create a new branch
3. Submit a PR with your changes

---

## License & Usage

**🔐 PROPRIETARY SOFTWARE** — Licensed usage only

> **⚠️ FEATURE FLAGGED**: The license validation system is currently **disabled by default** for
> safe deployment. All analytics and bot features work normally without licensing.

### 📋 License Options

| License Type   | Price      | Usage                         | Servers   | Support          |
| -------------- | ---------- | ----------------------------- | --------- | ---------------- |
| **Personal**   | FREE       | Personal Discord servers      | 1         | Community        |
| **Community**  | $29/month  | Non-profit gaming communities | 3         | Email            |
| **Commercial** | $299/month | Commercial Discord servers    | Unlimited | Priority         |
| **Enterprise** | Custom     | White-label + source access   | Unlimited | Professional SLA |

### 🚀 Quick Start (No License Required Currently)

```bash
# 1. Install and run (no license needed)
npm install
npm start

# 2. Optional: Enable license features for testing
ENABLE_LICENSE_VALIDATION=true npm start
```

### 🔧 License Feature Flags

License functionality is behind feature flags for gradual rollout:

```bash
# Default: License features disabled
npm start

# Enable license validation only
ENABLE_LICENSE_VALIDATION=true npm start

# Enable license server
ENABLE_LICENSE_SERVER=true npm start

# Enable enforcement (requires validation)
ENABLE_LICENSE_ENFORCEMENT=true npm start

# Development mode: Enable all features
NODE_ENV=development npm start
```

### 🛡️ License Enforcement (When Enabled)

- ✅ **Built-in validation** - Software validates license on startup
- ✅ **Grace period** - 7 days for new users to register
- ✅ **Usage tracking** - Monitors compliance automatically
- ❌ **Unauthorized use** - Terminates after grace period

### 🚀 Getting Your License (For Future Use)

1. **Personal License (Free)**:
   [Create License Registration Issue](https://github.com/chrishaycock/aszune-ai-bot/issues/new?labels=license-registration&template=license-registration.md&title=Personal%20License%20Request)
2. **Commercial License**:
   [Create Commercial License Request](https://github.com/chrishaycock/aszune-ai-bot/issues/new?labels=commercial-license&template=commercial-license.md&title=Commercial%20License%20Request)
3. **Enterprise License**: Create a GitHub issue

### 📧 Questions?

- **License Issues**: Create a GitHub issue
- **Technical Support**: Included with paid licenses

**[📄 View Full License Terms](./LICENSE)**

---

**Made for the Aszune community. Powered by Discord, Perplexity, and Node.js.**

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full version history.

For detailed release notes:
- [v1.10.0](./docs/RELEASE-NOTES-v1.10.0.md) - Code Quality & Documentation Cleanup
- [v1.9.0](./docs/RELEASE-NOTES-v1.9.0.md) - Dashboard Enhancements
- [v1.8.0](./docs/RELEASE-NOTES-v1.8.0.md) - Web Dashboard
- [v1.7.0](./docs/RELEASE-NOTES-v1.7.0.md) - Database & Reminders
