@echo off
echo Starting tests with timeout...
timeout 30 npm test
if %errorlevel% neq 0 (
    echo Tests timed out or failed
    taskkill /F /IM node.exe 2>nul
    exit /b 1
)
echo Tests completed successfully
exit /b 0



