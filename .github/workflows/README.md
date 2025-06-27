# GitHub Workflows for Aszune AI Bot

This directory contains the GitHub Actions workflows for the Aszune AI Bot project.

## Workflow Files

### Current (Legacy) Workflows

These workflows are being phased out in favor of the unified workflow:

- **ci.yml**: Original CI workflow that runs tests and uploads coverage to QLTY and Codecov
- **test.yml**: Alternative workflow for running tests and uploading coverage to Codecov
- **fix-coverage.yml**: Simplified workflow just for running tests with the --forceExit flag

### New Unified Workflow

- **unified-ci.yml**: Consolidated workflow that replaces all the above workflows with a more structured approach

## Migration Plan

We are in the process of migrating to the unified workflow. The legacy workflows will be kept temporarily to ensure backward compatibility, but they should be removed once the unified workflow has been tested and confirmed to be working correctly.

To complete the migration:

1. Review the unified workflow to ensure it meets all requirements
2. Test the unified workflow on a feature branch
3. Once confirmed working, remove the legacy workflow files

## Workflow Features

The unified workflow includes the following features:

- **Build and Test**: Runs tests with coverage and uploads results to QLTY and Codecov
- **Simple Test**: A faster test job for feature branches that doesn't generate coverage
- **Deploy** (commented out): Placeholder for future deployment automation

## Notes

- All coverage uploads have `continue-on-error: true` to prevent CI failures due to token issues
- The `--forceExit` flag is used with Jest to prevent hanging processes
- Node.js caching is enabled for faster workflow runs
