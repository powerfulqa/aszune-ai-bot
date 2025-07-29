# Aszune AI Bot Documentation

Welcome to the Aszune AI Bot Wiki! This documentation provides detailed information about setup, usage, and development of the Aszune AI Bot.

## What is Aszune AI Bot?

Aszune AI Bot is a Discord bot designed to provide gaming lore, game logic, guides, and advice using the Perplexity API with the **sonar** model. It maintains a short conversation history for each user and adds fun emoji reactions based on keywords found in messages. The bot supports both traditional `!` commands and modern Discord slash commands.

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

- 🤖 **Chat Completions:** Uses Perplexity API's `chat/completions` endpoint with the **sonar** model
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
- 🧪 **Comprehensive Testing:** 140 automated tests with >90% code coverage
