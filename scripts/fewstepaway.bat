@echo off
setlocal enabledelayedexpansion

set "ROOT=%~dp0.."

:: Get electron, compile, built-in extensions
cd /d "%ROOT%"
if "%VSCODE_SKIP_PRELAUNCH%"=="" (
    node build\lib\preLaunch.ts
)

:: Configuration
set NODE_ENV=development
set VSCODE_DEV=1
set VSCODE_CLI=1

:: Get executable name from product.json
for /f "tokens=* USEBACKQ" %%f in (`node -p "require('./product.json').applicationName"`) do (
    set "APP_NAME=%%f"
)

set "CODE=.build\\electron\\%APP_NAME%.exe"

:: Launch
"%CODE%" . %*
