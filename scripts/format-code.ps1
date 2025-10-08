# PowerShell script to format and fix code issues for v1.3.0

Write-Host "Starting code formatting and linting process..." -ForegroundColor Cyan

# Install dependencies if needed
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Format JavaScript files with Prettier
Write-Host "Formatting JavaScript files..." -ForegroundColor Yellow
npm run format

# Format Markdown files
Write-Host "Formatting Markdown files..." -ForegroundColor Yellow
npm run format:md

# Run ESLint to fix issues
Write-Host "Running ESLint to fix issues..." -ForegroundColor Yellow
npm run lint:fix

Write-Host "Code formatting and linting complete!" -ForegroundColor Green
