// This file is for testing the GitHub Actions workflow
// It should trigger the workflow when committed

/**
 * Test trigger for GitHub Actions workflow
 * Date: ${new Date().toISOString()}
 * 
 * Changes made:
 * 1. Fixed CLI parameter --commit to --commit-sha per CLI requirements
 * 2. Updated wrapper script to use CODECOV_OVERRIDE_COMMIT_SHA
 * 3. Added debug output to workflow for better troubleshooting
 */

const triggerDate = new Date();
console.log(`Workflow test triggered at ${triggerDate.toISOString()}`);
