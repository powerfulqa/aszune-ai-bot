# Aszune AI Bot Documentation

Welcome to the Aszune AI Bot Wiki! This documentation provides detailed information about setup,
usage, and development of the Aszune AI Bot.

## What is Aszune AI Bot?

Aszune AI Bot is a Discord bot designed to provide gaming lore, game logic, guides, and advice using
the Perplexity API with the **sonar** model. It maintains persistent conversation history for each
user through SQLite database integration and adds fun emoji reactions based on keywords found in
messages. The bot primarily supports modern Discord slash commands, with limited legacy `!` command
compatibility for backward support. Comprehensive analytics and user engagement tracking are
included.

## Navigation

- [Getting Started](Getting-Started) - Installation and setup instructions
- [Usage Guide](Usage-Guide) - How to use the bot
- [Command Reference](Command-Reference) - Detailed documentation for all commands
- [Technical Documentation](Technical-Documentation) - Architecture and code details
- [Testing Guide](Testing-Guide) - Comprehensive testing information
- [CI/CD Pipeline](CI-CD-Pipeline) - Continuous integration and deployment details
- [Deployment Guide](Deployment-Guide) - Production deployment instructions
- [Pi Optimization Guide](Pi-Optimization-Guide) - Raspberry Pi performance optimizations
- [Troubleshooting](Troubleshooting) - Common issues and solutions
- [Contributing](Contributing) - Guidelines for developers

### Dashboard Features (v1.9.0)

Comprehensive web-based monitoring and management interface. Access at
`http://localhost:3000/dashboard`:

**Complete Overview**: [Dashboard Features Summary](Dashboard-Features-Complete) - All 9 dashboard
pages and features  
**Implementation Details**: [v1.9.0 Dashboard Implementation](V1.9.0-Dashboard-Implementation) -
Technical architecture and details

**Individual Features**:

- [Dashboard Feature 1: Real-Time Log Viewer](Dashboard-Feature-1-Log-Viewer) - Live log streaming,
  filtering, and export
- [Dashboard Feature 2: Service Status & Management](Dashboard-Feature-2-Service-Management) -
  Monitor and control bot services
- [Dashboard Feature 3: Configuration Editor](Dashboard-Feature-3-Config-Editor) - Safe
  configuration editing with validation and backups
- [Dashboard Feature 5: Network & Connectivity Status](Dashboard-Feature-5-Network-Status) - Network
  interface monitoring and diagnostics
- [Dashboard Feature 7: Reminder Management Interface](Dashboard-Feature-7-Reminders) - Create,
  edit, and manage reminders via web UI

**Release Information**: [RELEASE-NOTES-v1.9.0](../docs/RELEASE-NOTES-v1.9.0.md) |
[Dashboard API Reference](../docs/Dashboard-API-Reference-v1.9.0.md)

## Code Quality & Standards

The project follows modern code quality practices with [qlty](https://qlty.sh/) integration:

- **[Code Quality Documentation](../docs/QLTY_INTEGRATION.md)** - Comprehensive qlty usage guide
- **[Implementation Summary](../docs/QLTY_IMPLEMENTATION_SUMMARY.md)** - qlty integration overview
- **[Security Policy](../SECURITY.md)** - Security guidelines and vulnerability reporting
- **[Contributing Guidelines](../CONTRIBUTING.md)** - Enhanced contribution standards with quality
  requirements
- **[Code of Conduct](../CODE_OF_CONDUCT.md)** - Community guidelines
- **[Changelog](../CHANGELOG.md)** - Standardized project changelog

## Version Information

**v1.10.0** - Code Quality & Documentation Cleanup (2025-01-17)

- **Code Quality Excellence** - 94.8% ESLint issue reduction, systematic complexity improvements
- **CI/CD Optimization** - 16× faster pipeline with intelligent skip detection  
- **Documentation Cleanup** - Removed 60+ obsolete files, consolidated architecture docs
- **Test Suite** - 1,661+ tests passing with comprehensive coverage
- **Code Duplication** - Systematic removal of duplicated validation and helper patterns

**v1.9.0** - Dashboard Feature Suite (2025-01-15)

- 5 major dashboard enhancements for monitoring and management
- Real-time log viewer, service management, configuration editor
- Network & connectivity status, reminder management interface

**v1.8.0** - Web Dashboard (2025-11-13)

- Express + Socket.io web dashboard with live metrics
- Dual-threshold coverage policy: ≥80% critical / ≥65% global

**v1.7.0** - Database & Reminders (2025-10-08)

- SQLite database integration for persistent data
- AI-powered reminder system with natural language

See [CHANGELOG.md](../CHANGELOG.md) for complete version history.

## Features

- 🤖 **AI Chat:** Perplexity API integration with the **sonar** model
- 🧠 **Context Awareness:** Persistent conversation history via SQLite
- ⏰ **Reminders:** AI-powered natural language reminder scheduling
- 📊 **Analytics:** Discord commands for server insights and performance
- 🌐 **Web Dashboard:** Real-time monitoring at `http://localhost:3000`
- 🇬🇧 **UK English:** All responses use UK English spelling
- 🍓 **Pi Optimised:** Specialised Raspberry Pi performance tuning
- 🧪 **Well Tested:** 1,661+ tests with comprehensive coverage
- 🛡️ **Code Quality:** QLTY integration for linting and security
