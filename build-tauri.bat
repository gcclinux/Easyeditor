@echo off
echo Setting up build environment...

@REM [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64", "User")
REM Add Rust to PATH
set PATH=%PATH%;%USERPROFILE%\.cargo\bin

REM Add Windows SDK (SignTool) to PATH
set PATH=%PATH%;C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64

REM Tell Tauri where to find SignTool
set TAURI_WINDOWS_SIGNTOOL_PATH=C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe

if "%1"=="" goto usage
if "%1"=="dev" goto dev
if "%1"=="--dev" goto dev
if "%1"=="build" goto build
if "%1"=="--build" goto build

:usage
echo Usage: build-tauri.bat [command]
echo.
echo Commands:
echo   build, --build    Build the Tauri application
echo   dev, --dev        Start Tauri development server
goto :eof

:build
@echo off
setlocal
set WEBKIT_DISABLE_DMABUF_RENDERER=1
set WEBKIT_DISABLE_COMPOSITING_MODE=1
echo Building Tauri application for Windows...
npm run tauri build
endlocal
echo Build finished.
goto :eof

:dev
@echo off
setlocal
set WEBKIT_DISABLE_DMABUF_RENDERER=1
set WEBKIT_DISABLE_COMPOSITING_MODE=1
echo Starting Tauri development server...
npm run tauri dev
endlocal