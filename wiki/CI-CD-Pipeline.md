# CI/CD Pipeline

## Overview

Aszune AI Bot uses GitHub Actions for continuous integration and deployment. The pipeline is defined
in `.github/workflows/unified-ci.yml` and runs automatically on push and pull request events.

## Pipeline Steps

1. **Setup**: Checks out code and sets up Node.js environment
2. **Dependencies**: Installs npm dependencies with caching for faster builds
3. **Testing**: Runs all tests with coverage reporting
4. **Security**: Performs security audits with npm
5. **Coverage Reporting**: Uploads coverage data to Codecov and QLTY
6. **Deployment**: Prepares for deployment when merging to the main branch

## Workflow Configuration

The workflow uses the following key features:

### Node.js Setup

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v3
  with:
    node-version: 18
    cache: 'npm'
```

### Test Execution

```yaml
- name: Run tests with coverage
  run: npm run test:ci
```

### Security Checks

```yaml
- name: Run security audit
  run: npm audit --audit-level=high --production
```

### Coverage Reporting

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    fail_ci_if_error: false
```

## Status Badge

The current status of the CI pipeline is displayed on the README:

![CI/CD](https://github.com/chrishaycock/aszune-ai-bot/actions/workflows/unified-ci.yml/badge.svg)

## Benefits

- **Automated Quality Assurance**: Tests run automatically on every code change
- **Early Error Detection**: Identifies issues before they reach production
- **Coverage Tracking**: Monitors test coverage to ensure code quality
- **Security Scanning**: Identifies potential vulnerabilities
- **Deployment Automation**: Streamlines the release process

## Viewing Results

1. **GitHub Actions Tab**: See all workflow runs and their status
2. **Pull Request Checks**: CI status is shown directly on pull requests
3. **Codecov**: View detailed coverage reports
4. **QLTY**: Check code quality metrics

## Recent Improvements

The CI/CD pipeline was recently enhanced with:

1. **Improved Test Reporting**: Added JUnit format output for better test visualization
2. **Enhanced Coverage Reporting**: Added integration with both Codecov and QLTY
3. **Security Scanning**: Added npm audit checks
4. **Deployment Preparation**: Added configuration for automatic deployment
