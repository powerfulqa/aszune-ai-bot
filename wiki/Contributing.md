# Contributing

Thank you for your interest in contributing to the Aszune AI Bot! This guide will help you get started with development and outline the best practices for contributing to this project.

## Code of Conduct

Please be respectful and considerate when contributing to this project. We welcome contributions from everyone who wishes to improve the bot.

## Getting Started

### Development Environment Setup

1. **Fork the Repository**

   Start by forking the repository to your GitHub account.

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/aszune-ai-bot.git
   cd aszune-ai-bot
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Set Up Environment Variables**

   Create a `.env` file with your development credentials:

   ```env
   DISCORD_BOT_TOKEN=your_development_bot_token
   PERPLEXITY_API_KEY=your_perplexity_api_key
   DEBUG=true
   ```

5. **Create a Development Bot**

   For testing, create a separate Discord bot application through the [Discord Developer Portal](https://discord.com/developers/applications) rather than using the production bot.

### Project Structure

Familiarize yourself with the project structure:

```
aszune-ai-bot/
├── src/
│   ├── index.js           # Main entry point
│   ├── commands/          # Command handlers
│   ├── config/            # Configuration settings
│   ├── services/          # API and core services
│   └── utils/             # Utility functions and helpers
├── scripts/               # Development and utility scripts
│   ├── test-chunking.js   # Test script for message chunking
│   └── test-chunking.bat  # Windows batch script to run message chunking test
├── docs/                  # Documentation and version-specific release notes
│   ├── v1.3.0.md          # Version 1.3.0 release notes
│   ├── v1.3.1.md          # Version 1.3.1 release notes
│   └── v1.3.2.md          # Version 1.3.2 release notes
├── __tests__/             # Unit and integration tests
├── __mocks__/             # Test mocks
└── .github/               # GitHub-specific templates and workflows
    ├── COMMIT_TEMPLATE.md # Template for commit messages
    └── pull_request_template.md # Template for pull requests
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Development branch for integration
- Feature branches - For new features, named like `feature/your-feature`
- Bugfix branches - For bug fixes, named like `bugfix/issue-description`

### Making Changes

1. **Create a New Branch**

   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make Your Changes**

   Follow the coding standards (described below) while implementing your changes.

3. **Write Tests**

   Add tests for your changes in the `__tests__` directory.

4. **Run Tests**

   ```bash
   npm test
   ```

5. **Commit Your Changes**

   Follow conventional commits format for commit messages. You can use the commit template by running:

   ```bash
   git config --local commit.template .github/COMMIT_TEMPLATE.md
   ```

   Then use your editor to create the commit message following the template.

   For quick commits, follow this format:

   ```bash
   git commit -m "feat: add new command for xyz"
   ```

   Common prefixes:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation change
   - `style:` - Formatting, missing semicolons, etc (no code change)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Updating build tasks, package manager configs, etc

6. **Push Your Changes**

   ```bash
   git push origin feature/your-feature
   ```

7. **Create a Pull Request**

   Open a pull request against the `develop` branch with a clear description of the changes and any relevant issue numbers.

## Coding Standards

### JavaScript Style

- Follow the ESLint configuration provided in the project
- Use ES6+ features where appropriate
- Add JSDoc comments for functions and methods

### Naming Conventions

- **Variables and Functions**: `camelCase`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **File Names**: `camelCase.js` or descriptive names that match their purpose

### Code Organization

- Keep functions small and focused on a single task
- Group related functionality in the same file or directory
- Follow the modular structure of the project

### Comments and Documentation

- Use descriptive variable and function names to make code self-documenting
- Add comments for complex logic
- Include JSDoc comments for all functions:

```javascript
/**
 * Sends a message to a Discord channel
 * @param {Channel} channel - The Discord channel to send the message to
 * @param {string} content - The content of the message
 * @returns {Promise<Message>} - The sent message
 */
function sendMessage(channel, content) {
  // Function implementation
}
```

## Testing

### Writing Tests

The project uses Jest for testing. Tests should be organized as follows:

- Unit tests should be placed in `__tests__/unit/`
- Integration tests should be placed in `__tests__/integration/`

### Test Naming

Name test files with the `.test.js` suffix:

```
__tests__/unit/commands/help.test.js
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific tests
npm test -- commands/help.test.js

# Run tests with coverage
npm run test:coverage
```

## Pull Request Process

1. Update the documentation, including the wiki and inline code comments
2. Add or update tests as needed
3. Ensure all tests pass
4. Make sure your code has no linting errors
5. Update the `RELEASE-NOTES.md` file with details of changes
6. For significant changes, create a version-specific release note in the `docs/` directory
7. Use the pull request template to provide a complete description of your changes
8. The pull request will be merged once it receives approval from a maintainer

## Reporting Issues

When reporting issues, please use the following template:

```
## Issue Description
A clear and concise description of what the issue is.

## Steps to Reproduce
1. Step 1
2. Step 2
3. ...

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
A clear and concise description of what actually happened.

## Screenshots
If applicable, add screenshots to help explain your problem.

## Environment
- Node version: [e.g. 16.0.0]
- OS: [e.g. Windows 10, Ubuntu 20.04]
- Bot version: [e.g. 1.0.0]
- Discord.js version: [e.g. 14.3.0]
```

## Feature Requests

Feature requests are welcome! When suggesting a new feature, please provide:

1. A clear description of the feature
2. Why it would be useful to add this feature
3. Examples of how the feature would be used

## Community

Join our Discord community for discussions and updates: [Aszune AI Community](https://discord.gg/your-invite-link)

---

Thank you for contributing to the Aszune AI Bot project! Your efforts help make this bot better for everyone.
