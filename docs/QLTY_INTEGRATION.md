# Code Quality with qlty

This project uses [qlty](https://qlty.sh/) for unified code quality, linting, formatting, and
security scanning.

## Setup

### Install qlty CLI

```bash
# Install on Windows
powershell -c "iwr https://qlty.sh | iex"

# Install on macOS/Linux
curl https://qlty.sh | bash
```

### Initialize qlty (if not already configured)

```bash
qlty init
```

## Usage

### Working npm Scripts

The project uses alternative implementations for quality checks due to qlty configuration challenges:

```bash
# Comprehensive quality check (ESLint + Critical Coverage Tests)
npm run quality:check

# Format all files with Prettier
npm run quality:fix

# Security audit for dependencies
npm run security:dependencies

# Get quality metrics information
npm run quality:metrics
```

### Direct qlty Usage (Advanced)

If qlty is properly installed and configured:

```bash
# Basic quality check (may require additional setup)
qlty check --sample=10

# Check specific files (if working)
qlty check src/services/chat.js

# Check all files (if working)
qlty check --all
```

### Auto-formatting

```bash
# Format all code
npm run quality:fix

# Format specific files
qlty fmt src/**/*.js
```

### Code Metrics

```bash
# View code quality metrics
npm run quality:metrics

# View code smells and duplication
npm run quality:smells

# Detailed metrics with sorting
qlty metrics --sort complexity --max-depth=3 --all
```

### Security Scanning

```bash
# Run all security scans
npm run security:all

# Check for secrets
npm run security:secrets

# Check dependencies for vulnerabilities
npm run security:dependencies
```

## Enabled Tools

### Linting and Formatting

- **ESLint**: JavaScript code linting
- **Prettier**: Code formatting
- **Markdownlint**: Markdown formatting

### Security Scanning

- **Gitleaks**: Secret detection in code and history
- **Trivy**: Dependency vulnerability scanning
- **Semgrep**: Static application security testing (SAST)

### Code Quality Analysis

- **Complexity Analysis**: Cyclomatic and cognitive complexity
- **Duplication Detection**: Identifies duplicate code blocks
- **Code Smells**: Detects maintainability issues

## Configuration

### Main Configuration

qlty is configured via `.qlty/qlty.toml`:

```toml
config_version = "0"

[[source]]
name = "default"
default = true

[plugins.enabled]
eslint = "latest"
prettier = "latest"
gitleaks = "latest"
trivy = "latest"
semgrep = "latest"
complexity = "latest"
duplication = "latest"
markdownlint = "latest"
```

### Tool-specific Configurations

Tool configurations are stored in `.qlty/configs/`:

- `.eslintrc.json` - ESLint rules
- `.prettierrc` - Prettier formatting options
- `.markdownlint.json` - Markdown linting rules
- `.gitleaks.toml` - Secret detection patterns

## Quality Gates

The project maintains the following quality standards:

### Code Coverage

- **Minimum**: 82% overall coverage
- **Branch Coverage**: 60% for critical components

### Code Complexity

- **File Complexity**: Max 15 per file
- **Function Complexity**: Max 10 per function
- **Max Depth**: 4 levels of nesting

### Code Duplication

- **Identical Code**: Max 50 lines
- **Similar Code**: Max 80 similarity threshold

### Security

- **No Secrets**: Zero tolerance for committed secrets
- **Vulnerability Scanning**: All high/critical vulnerabilities must be addressed
- **Dependency Auditing**: Regular security audits of dependencies

## CI/CD Integration

Quality checks are integrated into the CI/CD pipeline:

```yaml
# GitHub Actions workflow
- name: Run quality checks
  run: |
    qlty check --all
    qlty smells --all

- name: Security scanning
  run: |
    qlty check --plugin=gitleaks
    qlty check --plugin=trivy
```

## IDE Integration

### VS Code Extension

Install the qlty VS Code extension for real-time feedback:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "qlty"
4. Install the qlty extension
5. Restart VS Code

Features:

- Real-time linting and formatting
- Quality metrics in editor
- Security issue highlighting
- Auto-fix suggestions

## Troubleshooting

### Common Issues

**qlty command not found:**

```bash
# Add to PATH (Windows PowerShell)
$env:PATH += ";$env:USERPROFILE\.qlty\bin"

# Add to PATH (macOS/Linux)
export PATH="$HOME/.qlty/bin:$PATH"
```

**Permission denied errors:**

```bash
# Windows - Run as administrator
# macOS/Linux - Check file permissions
chmod +x ~/.qlty/bin/qlty
```

**Plugin installation issues:**

```bash
# Clear plugin cache and reinstall
qlty plugins list
qlty plugins install eslint
```

### Getting Help

- **qlty Documentation**: https://docs.qlty.sh/
- **Community Support**: https://qlty.sh/discord
- **Project Issues**: Create GitHub issue for project-specific problems

## Quality Metrics Dashboard

View detailed quality metrics and trends:

1. **qlty Cloud**: https://qlty.sh/dashboard
2. **GitHub Integration**: Quality checks in pull requests
3. **Local Reports**: `qlty metrics --format html > quality-report.html`

## Best Practices

### For Contributors

1. **Run quality checks** before committing:

   ```bash
   npm run quality:check
   npm run quality:fix
   ```

2. **Check security** before pushing:

   ```bash
   npm run security:all
   ```

3. **Monitor complexity** in new code:
   ```bash
   qlty metrics --files-changed
   ```

### For Maintainers

1. **Review quality trends** regularly
2. **Update quality gates** as project matures
3. **Monitor security vulnerabilities** continuously
4. **Keep qlty and plugins updated**

## Quality Philosophy

This project follows qlty's philosophy of:

- **Universal Quality**: One tool for all quality needs
- **Fast Execution**: Efficient caching and parallel processing
- **Git Awareness**: Focus on newly introduced issues
- **Developer Experience**: Seamless integration into workflow
- **Measurable Progress**: Track quality improvements over time
