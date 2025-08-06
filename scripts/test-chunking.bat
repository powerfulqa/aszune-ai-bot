@echo off
REM This script runs the message chunking test to validate proper word boundary handling
REM Usage: test-chunking.bat

set NODE_ENV=test
node scripts\test-chunking.js
