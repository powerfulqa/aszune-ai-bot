#!/bin/bash

# This script is a wrapper for the codecov CLI that forces it to use the correct repository
# To use it, make it executable with `chmod +x codecov-wrapper.sh` and use it instead of calling codecov directly

# Force environment variables
export GITHUB_REPOSITORY="powerfulqa/aszune-ai-bot"
export GITHUB_REPOSITORY_OWNER="powerfulqa"
export CODECOV_NAME="powerfulqa/aszune-ai-bot"
export CODECOV_SLUG="powerfulqa/aszune-ai-bot"

# Print debug info
echo "=== CODECOV DEBUG INFO ==="
echo "GITHUB_REPOSITORY=$GITHUB_REPOSITORY"
echo "GITHUB_REPOSITORY_OWNER=$GITHUB_REPOSITORY_OWNER"
echo "CODECOV_NAME=$CODECOV_NAME"
echo "CODECOV_SLUG=$CODECOV_SLUG"
echo "=========================="

# Create a local codecov.yml override if needed
cat > codecov-local-override.yml <<EOL
codecov:
  url: "https://codecov.io/gh/powerfulqa/aszune-ai-bot"
  slug: "powerfulqa/aszune-ai-bot"
EOL

# Set additional environment variables for the CLI
export CODECOV_YML="codecov-local-override.yml"
export CODECOV_OVERRIDE_COMMIT=$GITHUB_SHA
export CODECOV_OVERRIDE_BRANCH="feature/smart-cache"

# Execute with all arguments passed to this script
echo "Running Codecov CLI with forced repository settings..."
exec "$@"
