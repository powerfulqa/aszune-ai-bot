# GitHub Workflows for Aszune AI Bot

This directory contains the GitHub Actions workflows for the Aszune AI Bot project.

## Workflow Files

### Unified Workflow

- **unified-ci.yml**: A consolidated workflow that handles building, testing, and code coverage reporting

## Workflow Features

## Workflow Features

The unified workflow includes the following features:

- **Build and Test**: Runs tests with coverage and uploads results to QLTY and Codecov
- **Simple Test**: A faster test job for feature branches that doesn't generate coverage
- **Deploy** (commented out): Placeholder for future deployment automation

## Notes

- All coverage uploads have `continue-on-error: true` to prevent CI failures due to token issues
- The `--forceExit` flag is used with Jest to prevent hanging processes
- Node.js caching is enabled for faster workflow runs
