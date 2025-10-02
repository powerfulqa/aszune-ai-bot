@echo off
REM Automated License Generation for Aszune AI Bot v1.6.0
REM 
REM Usage Examples:
REM   generate-license.bat personal
REM   generate-license.bat commercial 1 save
REM   generate-license.bat enterprise 1 save user@company.com

echo.
echo 🔑 Aszune AI Bot - License Generator v1.6.0
echo.

if "%1"=="" (
    echo Usage: generate-license.bat ^<type^> [count] [save] [email]
    echo.
    echo License Types:
    echo   personal    - Personal License ^(FREE^) - 1 server
    echo   community   - Community License ^($29/month^) - 5 servers  
    echo   commercial  - Commercial License ^($299/month^) - Unlimited
    echo   enterprise  - Enterprise License ^(Custom^) - Unlimited
    echo.
    echo Examples:
    echo   generate-license.bat personal
    echo   generate-license.bat commercial 1 save
    echo   generate-license.bat enterprise 1 save user@company.com
    echo.
    goto :eof
)

set LICENSE_TYPE=%1
set COUNT=%2
set SAVE_FLAG=%3
set EMAIL=%4

if "%COUNT%"=="" set COUNT=1

REM Build node command
set NODE_CMD=node scripts/generate-license.js %LICENSE_TYPE% %COUNT%

if "%SAVE_FLAG%"=="save" (
    set NODE_CMD=%NODE_CMD% --save
)

if not "%EMAIL%"=="" (
    set NODE_CMD=%NODE_CMD% --email %EMAIL%
)

echo Running: %NODE_CMD%
echo.

%NODE_CMD%

echo.
pause