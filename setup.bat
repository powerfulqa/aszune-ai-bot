@echo off
echo Cleaning up npm installation...
echo.

REM Remove node_modules
echo Removing node_modules folder...
if exist node_modules (
  rmdir /s /q node_modules
  echo Node modules removed.
) else (
  echo No node_modules folder found.
)
echo.

REM Clear npm cache
echo Clearing npm cache...
call npm cache clean --force
echo.

REM Install dependencies
echo Installing dependencies...
call npm ci

REM Check if npm ci failed
if %ERRORLEVEL% NEQ 0 (
  echo npm ci failed, trying regular npm install...
  call npm install
)

echo.
echo Installation completed!
