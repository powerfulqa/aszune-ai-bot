#!/bin/bash
# Script to format and fix code issues for v1.3.0

echo "Starting code formatting and linting process..."

# Install dependencies if needed
echo "Installing dependencies..."
npm install

# Format JavaScript files with Prettier
echo "Formatting JavaScript files..."
npm run format

# Format Markdown files
echo "Formatting Markdown files..."
npm run format:md

# Run ESLint to fix issues
echo "Running ESLint to fix issues..."
npm run lint:fix

echo "Code formatting and linting complete!"
