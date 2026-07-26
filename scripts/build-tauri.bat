@echo off
cd /d "%~dp0\.."

echo Setting up build environment...

@REM [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64", "User")
REM Add Rust to PATH
set PATH=%PATH%;%USERPROFILE%\.cargo\bin

REM Set SignTool path dynamically if specific version exists or find installed SDK
if exist "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" (
    set TAURI_WINDOWS_SIGNTOOL_PATH=C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe
    set PATH=%PATH%;C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64
) else (
    for /f "delims=" %%f in ('dir /b /s "C:\Program Files (x86)\Windows Kits\10\bin\*signtool.exe" 2^>nul') do (
        echo %%f | findstr /i "\\x64\\" >nul
        if not errorlevel 1 (
            set "TAURI_WINDOWS_SIGNTOOL_PATH=%%f"
        )
    )
)

if defined TAURI_WINDOWS_SIGNTOOL_PATH (
    echo Using SignTool at: %TAURI_WINDOWS_SIGNTOOL_PATH%
)

REM Add WiX Toolset to PATH
set PATH=%PATH%;%CD%\src-tauri\target\release\wix\x64\wix

if "%1"=="" goto usage
if "%1"=="dev" goto dev
if "%1"=="--dev" goto dev
if "%1"=="build" goto build
if "%1"=="--build" goto build

:usage
echo Usage: scripts\build-tauri.bat [command]
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