# CI/CD Pipeline

## Overview

Aszune AI Bot uses GitHub Actions for continuous integration and deployment. The pipeline is defined
in `.github/workflows/unified-ci.yml` and runs automatically on push and pull request events.

v1.8.0 introduced a dual test coverage enforcement model:

| Layer | Threshold | Config | Purpose |
| ----- | --------- | ------ | ------- |
| Critical files | ≥80% statements | `jest.critical-coverage.config.js` | Early fail for core reliability paths |
| Global baseline | ≥65% statements | `jest.config.js` | Sustainable confidence without blocking iteration |

Critical gate runs first; if it fails, the full suite is skipped to save CI minutes.

## Pipeline Steps

1. **Setup**: Checks out code and sets up Node.js environment
2. **Dependencies**: Installs npm dependencies with caching for faster builds
3. **Code Quality**: Runs comprehensive quality checks with qlty integration
4. **Testing**: Runs all tests with coverage reporting
5. **Security Scanning**: Performs multi-layered security analysis (npm audit, qlty security)
6. **Coverage Enforcement**: Runs critical coverage gate (80% threshold)
7. **Coverage Reporting**: Uploads full-suite coverage data to Codecov and QLTY (global ≥65%)
8. **Quality Gates**: Enforces code quality standards and metrics
8. **Deployment**: Prepares for deployment when merging to the main branch

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
- name: Critical coverage gate
run: npm run test:critical:ci

- name: Full test suite (runs only if critical gate passes)
run: npm test
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

- name: Upload critical coverage (optional flag)
  if: success() && always()
  uses: codecov/codecov-action@v3
  with:
    flags: critical-files
    fail_ci_if_error: false
```

## Status Badge

The current status of the CI pipeline is displayed on the README:

![CI/CD](https://github.com/chrishaycock/aszune-ai-bot/actions/workflows/unified-ci.yml/badge.svg)

## Benefits

- **Automated Quality Assurance**: Tests run automatically on every code change
- **Early Error Detection**: Identifies issues before they reach production
- **Coverage Tracking**: Dual-threshold monitoring (targeted critical protection + sustainable global baseline)
- **Security Scanning**: Identifies potential vulnerabilities
- **Deployment Automation**: Streamlines the release process

## Viewing Results

1. **GitHub Actions Tab**: See all workflow runs and their status
2. **Pull Request Checks**: CI status is shown directly on pull requests
3. **Codecov**: View detailed coverage reports
4. **QLTY**: Check code quality metrics

## Code Quality Integration

The pipeline now includes comprehensive code quality checks with qlty:

```yaml
- name: Run quality checks
  run: npm run quality:check

- name: Run security scan
  run: npm run security:all
```

### Quality Enforcement

- **Code Complexity**: Enforces complexity limits (≤15 per file, ≤10 per function)
- **Security Scanning**: Multi-tool security analysis (Gitleaks, Trivy, Semgrep)
- **Code Standards**: ESLint, Prettier, and documentation formatting
- **Duplication Detection**: Identifies and prevents code duplication
- **Secret Detection**: Prevents accidental secret commits
- **Dual Coverage Gates**: Prevent regressions in critical paths while allowing incremental global improvement

## Recent Improvements

The CI/CD pipeline was recently enhanced with:

1. **Dual Coverage Strategy (v1.8.0)**: Introduced 80% critical / 65% global enforcement
2. **qlty Integration**: Unified code quality + security tooling retained
3. **Enhanced Security**: Multi-layered scanning with specialized tools
4. **Early Fail Optimization**: Critical coverage gate short-circuits full suite on failure
5. **Improved Test Reporting**: JUnit output retained for visualization
6. **Documentation Refresh**: Coverage status, testing guide, and release notes updated
7. **Deployment Preparation**: Unchanged; pipeline stability improved
