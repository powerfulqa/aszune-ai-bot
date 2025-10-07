@echo off
REM Production Emergency Fix Script for Aszune AI Bot v1.7.0 (Windows)

echo 🚨 EMERGENCY PRODUCTION FIX - Aszune AI Bot v1.7.0
echo ==================================================

REM Check if we're in the right directory
if not exist package.json (
    echo ❌ Not in bot directory. Please navigate to the bot folder
    pause
    exit /b 1
)

echo ℹ️  Current directory: %CD%

REM Check Node.js version
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js 20+ from nodejs.org
    pause
    exit /b 1
)

echo ℹ️  Node.js version:
node --version

REM Clean and reinstall dependencies
echo ℹ️  Cleaning node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo ℹ️  Installing dependencies...
npm install

REM Verify critical dependencies
echo ℹ️  Verifying critical dependencies...

npm ls chrono-node >nul 2>&1
if errorlevel 1 (
    echo ❌ chrono-node installation failed, retrying...
    npm install chrono-node@^2.9.0
) else (
    echo ✅ chrono-node installed successfully
)

npm ls better-sqlite3 >nul 2>&1
if errorlevel 1 (
    echo ❌ better-sqlite3 installation failed, retrying...
    npm install better-sqlite3@^12.4.1
) else (
    echo ✅ better-sqlite3 installed successfully
)

npm ls discord.js >nul 2>&1
if errorlevel 1 (
    echo ❌ discord.js installation failed, retrying...
    npm install discord.js@^14.18.0
) else (
    echo ✅ discord.js installed successfully
)

REM Create required directories
echo ℹ️  Creating required directories...
if not exist data mkdir data
if not exist logs mkdir logs

REM Check environment file
if not exist .env (
    echo ❌ .env file not found!
    echo Creating template .env file...
    (
        echo # Discord Bot Configuration
        echo DISCORD_TOKEN=your_discord_token_here
        echo PERPLEXITY_API_KEY=your_perplexity_key_here
        echo.
        echo # Bot Configuration
        echo LOG_LEVEL=INFO
        echo NODE_ENV=production
        echo DB_PATH=./data/bot.db
        echo.
        echo # Optional Features
        echo ENABLE_LICENSE_VALIDATION=false
        echo ENABLE_LICENSE_SERVER=false
        echo ENABLE_LICENSE_ENFORCEMENT=false
    ) > .env
    echo ❌ Please edit .env file with your tokens before starting the bot
)

REM Test module loading
echo ℹ️  Testing module loading...

node -e "require('./src/utils/time-parser.js'); console.log('time-parser OK')" >nul 2>&1
if errorlevel 1 (
    echo ❌ time-parser module failed to load
) else (
    echo ✅ time-parser module loads successfully
)

node -e "require('./src/services/database.js'); console.log('database OK')" >nul 2>&1
if errorlevel 1 (
    echo ❌ database service failed to load
) else (
    echo ✅ database service loads successfully
)

echo.
echo ✅ Production fix completed!
echo.
echo 🚀 START THE BOT WITH ONE OF THESE COMMANDS:
echo.
echo Standard start:
echo   node src/index.js
echo.
echo Test run (with timeout):
echo   timeout /t 5 ^& node src/index.js
echo.
echo Background with PM2:
echo   npm install -g pm2
echo   pm2 start src/index.js --name aszune-bot
echo.

echo ℹ️  If issues persist, check the logs and environment variables
echo ℹ️  Bot logs will be saved to: ./logs/
pause