# GitHub Workflows for Aszune AI Bot

This directory contains the GitHub Actions workflows for the Aszune AI Bot project.

## Workflow Files

### Unified Workflow

- **unified-ci.yml**: A consolidated workflow that handles building, testing, and code coverage
  reporting

## Workflow Features

## Workflow Features

The unified workflow includes the following features:

- **Test**: Runs the suite in three shards on Node 22 and 24, without coverage
- **Coverage**: Runs the full suite with coverage on pull requests and `main` (global 70% gate),
  then the per-file critical coverage gate, and uploads results to QLTY and Codecov
- **Quality & Security**: ESLint and `npm audit` for production dependencies
- **Deploy** (commented out): Placeholder for future deployment automation

## Notes

- All coverage uploads have `continue-on-error: true` to prevent CI failures due to token issues
- The `--forceExit` flag is used with Jest to prevent hanging processes
- Node.js caching is enabled for faster workflow runs
