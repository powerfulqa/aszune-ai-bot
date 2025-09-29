# Contributing to Aszune AI Bot

Thank you for your interest in contributing to Aszune AI Bot! We welcome contributions from the community and are pleased to have you join us.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Contributions](#making-contributions)
- [Code Quality Standards](#code-quality-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Create a branch for your feature or bugfix
5. Make your changes
6. Test your changes thoroughly
7. Submit a pull request

## Development Setup

### Prerequisites

- Node.js v20.18.1 or later
- npm or yarn package manager
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/aszune-ai-bot.git
cd aszune-ai-bot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run tests to ensure everything is working
npm test
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

## Making Contributions

### Types of Contributions

We welcome various types of contributions:

- **Bug Reports**: Report bugs using GitHub issues
- **Feature Requests**: Suggest new features via GitHub issues
- **Code Contributions**: Bug fixes, new features, performance improvements
- **Documentation**: Improvements to README, wiki, or code comments
- **Testing**: Additional test cases or test infrastructure improvements

### Branch Naming Convention

- `feature/description-of-feature` - New features
- `fix/description-of-fix` - Bug fixes
- `docs/description-of-change` - Documentation updates
- `refactor/description-of-refactor` - Code refactoring
- `test/description-of-test` - Test improvements

## Code Quality Standards

This project follows high code quality standards using qlty and other tools:

### Linting and Formatting

- **ESLint**: JavaScript code linting
- **Prettier**: Code formatting
- **Markdownlint**: Markdown formatting

Run quality checks:

```bash
# Lint JavaScript code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Run qlty quality checks (if installed)
qlty check
```

### Code Style Guidelines

- Use meaningful variable and function names
- Follow the existing code style and patterns
- Add JSDoc comments for functions and classes
- Keep functions focused and under 50 lines when possible
- Use ES6+ features appropriately
- Handle errors gracefully

### Security Guidelines

- Never commit sensitive information (tokens, keys, passwords)
- Validate all user inputs
- Use secure coding practices
- Follow the principle of least privilege
- Report security vulnerabilities responsibly (see SECURITY.md)

## Testing

### Test Requirements

- All new features must include tests
- Bug fixes should include regression tests
- Maintain or improve test coverage (currently 82%+)
- All tests must pass before merging

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage

# Run specific test suites
npm run test:branch-coverage

# Run tests in CI mode
npm run test:ci
```

### Test Structure

```
__tests__/
├── integration/     # Integration tests
├── unit/           # Unit tests
└── utils/          # Test utilities and helpers
```

### Writing Tests

- Follow the existing test patterns
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies appropriately
- Use the provided test utilities

## Documentation

### Documentation Standards

- Update README.md for user-facing changes
- Update wiki documentation for significant features
- Add JSDoc comments for new functions/classes
- Include code examples where helpful
- Keep documentation up-to-date with code changes

### Documentation Structure

```
docs/           # Version-specific release notes
wiki/           # Comprehensive documentation
README.md       # Main project documentation
```

## Pull Request Process

### Before Submitting

1. **Test thoroughly**: Ensure all tests pass
2. **Run quality checks**: Fix any linting or formatting issues
3. **Update documentation**: Include necessary documentation updates
4. **Check dependencies**: Ensure no unnecessary dependencies are added
5. **Security review**: Verify no sensitive information is included

### Pull Request Guidelines

1. **Clear title**: Use a descriptive title that summarizes the change
2. **Detailed description**: Explain what changes were made and why
3. **Link issues**: Reference any related GitHub issues
4. **Screenshots**: Include screenshots for UI changes
5. **Breaking changes**: Clearly mark any breaking changes

### PR Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No sensitive information included
```

### Review Process

1. **Automated checks**: CI/CD pipeline runs automatically
2. **Maintainer review**: Project maintainers will review your PR
3. **Feedback incorporation**: Address any requested changes
4. **Approval and merge**: Once approved, your PR will be merged

### After Your PR is Merged

1. **Update local repository**: Pull the latest changes
2. **Delete feature branch**: Clean up your local branches
3. **Monitor for issues**: Watch for any issues related to your changes

## Getting Help

If you need help with your contribution:

1. **Check existing issues**: Look for similar questions or problems
2. **GitHub Discussions**: Use GitHub Discussions for questions
3. **Discord**: Join our Discord community (link in README)
4. **Documentation**: Check the wiki for detailed information

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation acknowledgments

Thank you for contributing to Aszune AI Bot! Your contributions help make this project better for everyone.