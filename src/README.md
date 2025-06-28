# Aszune AI Bot - Improved Structure  
![CI](https://github.com/chrishaycock/aszune-ai-bot/actions/workflows/test.yml/badge.svg)
[![Codecov](https://codecov.io/gh/chrishaycock/aszune-ai-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/chrishaycock/aszune-ai-bot)

**Aszune AI Bot** is a Discord bot designed to provide gaming lore, game logic, guides, and advice using the Perplexity API with the **sonar** model. This branch contains a major refactor to improve the codebase structure, maintainability, and performance.

---

## Table of Contents

- [Features](#features)
- [Architecture Improvements](#architecture-improvements)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup Steps](#setup-steps)
- [Usage](#usage)
  - [Running in Development Mode](#running-in-development-mode)
  - [Running in Production](#running-in-production)
- [Bot Commands](#bot-commands)
- [Project Structure](#project-structure)
- [Testing & Coverage](#testing--coverage)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Features

All existing features from the main branch, plus:

- 🔧 **Modular Architecture:** Restructured into services, utilities, and commands for better separation of concerns
- 📂 **Configuration Management:** Centralised configuration file for all constants and settings
- 📊 **Persistent Stats Storage:** User stats are now saved to disk and loaded on startup
- 🗄️ **Data Access Layer:** Abstracted data storage operations for better maintainability
- 🛡️ **Improved Error Handling:** Robust error handling and logging throughout the application
- 📝 **Better Logging:** Structured logging with different levels and timestamps
- 🧹 **Memory Management:** Automatic cleanup of inactive conversations to prevent memory leaks
- 🔄 **Background Processing:** Scheduled tasks for maintenance operations
- 🧪 **Enhanced Testing:** Improved test structure with better mocking and isolation

---

## Architecture Improvements

### Modular Code Structure

The codebase has been reorganized into a modular structure:

```
src/
├── commands/     # Command handlers
├── config/       # Configuration files
├── services/     # External services and API clients
└── utils/        # Utility functions and helpers
```

### Data Storage & Persistence

- User statistics are now stored persistently in JSON files
- Data is automatically saved at regular intervals and on shutdown
- Automatic cleanup of old conversation history to prevent memory leaks

### Error Handling & Logging

- Centralised error handling with custom error messages
- Structured logging with timestamps and log levels
- Different handling strategies for different error types

### Performance Improvements

- Replaced plain objects with ES6 Maps for better performance
- Improved memory management with automatic cleanup
- Optimized API request handling

---

## Installation

### Prerequisites

- Node.js 16.x or higher
- Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))
- Perplexity API Key

### Setup Steps

1. Clone this repository:

```bash
git clone https://github.com/chrishaycock/aszune-ai-bot.git
cd aszune-ai-bot
git checkout feature/code-improvements
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
PERPLEXITY_API_KEY=your_perplexity_api_key
```

---

## Usage

### Running in Development Mode

To run the bot with automatic reloading on file changes:

```bash
npm run dev
```

### Running in Production

For regular execution:

```bash
npm start
```

For persistent execution with PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

---

## Bot Commands

The bot supports both traditional text commands with the `!` prefix and modern Discord slash commands:

- **!help** or **/help**: Show available commands
- **!clearhistory** or **/clearhistory**: Clear your conversation history
- **!summary** or **/summary**: Generate a summary of your conversation
- **!stats** or **/stats**: Show your usage statistics

---

## Project Structure

```
aszune-ai-bot/
├── src/                     # Source code
│   ├── commands/            # Command handlers
│   ├── config/              # Configuration files
│   ├── services/            # External services and API clients
│   └── utils/               # Utility functions and helpers
├── data/                    # Persistent data storage
├── __tests__/               # Test files
│   ├── integration/         # Integration tests
│   ├── unit/                # Unit tests
│   └── utils/               # Test utilities
├── __mocks__/               # Mock files for testing
├── .env                     # Environment variables (not in git)
├── .gitignore               # Git ignore file
├── ecosystem.config.js      # PM2 configuration
├── jest.config.js           # Jest configuration
├── package.json             # Node.js dependencies and scripts
└── README.md                # Project documentation
```

---

## Testing & Coverage

Run tests with coverage:

```bash
npm test
```

---

## Future Enhancements

- Database integration for more robust data storage
- Additional command modules
- Performance monitoring and metrics
- User permission levels and admin commands
- Custom embeds and interactive components

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

This project is licensed under the MIT License.
