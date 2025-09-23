# Aszune AI Bot Documentation

Welcome to the Aszune AI Bot Wiki! This documentation provides detailed information about setup,
usage, and development of the Aszune AI Bot.

## What is Aszune AI Bot?

Aszune AI Bot is a Discord bot designed to provide gaming lore, game logic, guides, and advice using
the Perplexity API with the **sonar** model. It maintains a short conversation history for each user
and adds fun emoji reactions based on keywords found in messages. The bot supports both traditional
`!` commands and modern Discord slash commands.

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

## Version Information

- **v1.4.0** - Comprehensive Testing & Coverage Enhancement (2025-01-22)
  - Massive test coverage improvement from 77.79% to 82%+
  - Added comprehensive test suites for memory monitoring, message chunking, and command handling
  - Expanded test count from 371 to 380+ passing tests
  - Enhanced error handling and recovery mechanisms across all modules
  - Production-ready quality with extensive test coverage

- **v1.3.2** - Message Chunking Enhancement (2025-08-06)
  - Fixed critical bug where words at chunk boundaries could be incorrectly joined
  - Improved word boundary detection to ensure proper text formatting
  - Enhanced testing suite to verify proper chunk boundary handling

- **v1.3.1** - Message Chunking Implementation (2025-08-02)
  - Added automatic message chunking to prevent long responses from being truncated
  - Intelligently splits messages at paragraph and sentence boundaries
  - Added numbering prefixes to indicate message sequence
- **v1.3.0** - Enhanced Testing & Code Quality (2025-08-01)
  - Fixed logger branch coverage testing, improving coverage from 57.89% to 82.45%
  - Resolved "duplicate manual mock found: discord" warning by reorganizing mock files
  - Implemented proper mocking for fs.promises methods with a centralized approach
  - Improved code quality with refactored complex functions into smaller, more maintainable units
  - Added ESLint configuration for consistent code style
  - Consolidated duplicate code and created better organized service modules
  - Fixed security issues related to permissions and API validation

- **v1.2.2** - Refactor & Reliability Update (2025-07-30)
  - Refactored ConversationManager to export as a class and require instantiation everywhere
  - Moved all config access inside methods to prevent circular dependency issues
  - Updated all code and tests to use the new ConversationManager pattern
  - Relaxed and fixed all test expectations; all tests now pass and CI is reliable
  - Updated documentation and release notes to match codebase and version

- **v1.2.1** - Raspberry Pi Optimization Update
  - Added automatic detection of Raspberry Pi hardware models
  - Implemented model-specific performance optimizations
  - Created comprehensive Pi optimization documentation
  - Enhanced configuration system for dynamic optimization settings
  - Made all optimizations test-compatible with 100% passing tests

- **v1.2.0** - Optimizations and shutdown improvements
  - Enhanced shutdown handling with protection against multiple executions
  - Improved error handling in Perplexity service
  - Updated CI security audit configuration for production dependencies
  - Fixed all test failures and improved code coverage
- **v1.1.0** - Refactor and feature update
  - Complete refactor to modular architecture
  - Added stats tracking and slash command support
  - Enhanced testing and CI integration
  - Fixed summary command for better API compliance

- **v1.0.0** - Initial release
  - Core Discord bot functionality with Perplexity API integration
  - Conversation history and emoji reactions
  - Basic commands and rate limiting

## Features

- 🤖 **Chat Completions:** Uses Perplexity API's `chat/completions` endpoint with the **sonar**
  model
- 🧠 **Context Awareness:** Remembers recent user messages with a configurable history length
- 🔁 **Command Support:** Users can clear their history at any time
- 😄 **Emoji Reactions:** Adds reactions based on keywords like "hello", "funny", "love", etc
- 🔒 **Secure Configuration:** `.env` based token and key management
- 🕒 **Rate Limiting:** Prevents users from spamming the bot
- 📝 **Help Command:** Lists all available commands and usage
- 🧾 **Conversation Summary:** Generates summaries of conversations
- 📝 **Text Summarisation:** Summarizes any provided text using UK English
- 🇬🇧 **UK English Responses:** All bot replies use UK English spelling and phrasing
- 🗂️ **Improved Performance:** Uses JavaScript `Map` for conversation history and rate limiting
- 🛠️ **Cleaner Codebase:** Refactored command handling for easier maintenance
- 🆕 **Stats Tracking:** Shows per-user message and summary counts
- 🆕 **Slash Command Support:** All major commands available as Discord slash commands
- 🔄 **Graceful Shutdown:** Robust handling of process termination with proper resource cleanup
- 🧪 **Comprehensive Testing:** 380+ automated tests with 82%+ code coverage
- 🧾 **Branch Coverage Testing:** 82.45% branch coverage for critical components like logger.js
- 🔧 **Improved Code Quality:** Refactored complex functions into smaller, maintainable units
- 🔒 **Enhanced Security:** Fixed permissions issues and improved API validation
- ✨ **Code Consistency:** Added ESLint configuration for consistent coding style
