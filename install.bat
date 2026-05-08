@echo off
REM ═══════════════════════════════════════════════════════════════
REM 🎵 Chorus — Windows Installer
REM ═══════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

set CHORUS_VERSION=1.0.0
set CHORUS_DIR=%USERPROFILE%\.chorus
set NODE_MIN_VERSION=20

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║                                          ║
echo   ║   🎵  C H O R U S                       ║
echo   ║   AI Agent Brain for n8n                 ║
echo   ║                                          ║
echo   ║   Installer v%CHORUS_VERSION%                       ║
echo   ║                                          ║
echo   ╚══════════════════════════════════════════╝
echo.

REM ═══════════════════════════════════════════════════════════════
REM Check Node.js
REM ═══════════════════════════════════════════════════════════════

echo [→] Checking Node.js...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js not found
    
    echo [→] Installing Node.js via winget...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    
    if %errorlevel% neq 0 (
        echo [✗] Could not auto-install Node.js
        echo [i] Please install Node.js v20+ from https://nodejs.org
        pause
        exit /b 1
    )
    
    REM Refresh PATH
    set PATH=%PATH%;%PROGRAMFILES%\nodejs
)

for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VER=%%a
set NODE_VER=%NODE_VER:v=%

if %NODE_VER% lss %NODE_MIN_VERSION% (
    echo [!] Node.js v%NODE_VER% found but v%NODE_MIN_VERSION%+ required
    echo [→] Updating Node.js...
    winget upgrade OpenJS.NodeJS.LTS
)

echo [✓] Node.js found
node -v

REM ═══════════════════════════════════════════════════════════════
REM Check Git
REM ═══════════════════════════════════════════════════════════════

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git not found — installing...
    winget install Git.Git --accept-package-agreements --accept-source-agreements
)

REM ═══════════════════════════════════════════════════════════════
REM Install Chorus
REM ═══════════════════════════════════════════════════════════════

echo.
echo [→] Installing Chorus to %CHORUS_DIR%...

if not exist "%CHORUS_DIR%" mkdir "%CHORUS_DIR%"

REM Check if running from source or download from GitHub
if exist "package.json" (
    findstr /C:"chorus" package.json >nul 2>nul
    if %errorlevel% equ 0 (
        echo [i] Installing from source...
        xcopy /E /I /Y . "%CHORUS_DIR%" >nul 2>nul
        goto :install_deps
    )
)

echo [→] Downloading Chorus from GitHub...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [✗] Git not found. Please install git first.
    pause
    exit /b 1
)
git clone https://github.com/Atum246/chorus.git "%CHORUS_DIR%"
if %errorlevel% neq 0 (
    echo [✗] Failed to clone repository
    pause
    exit /b 1
)

:install_deps

cd /d "%CHORUS_DIR%"

echo [→] Installing dependencies...
call npm install --production 2>nul
if %errorlevel% neq 0 (
    echo [✗] npm install failed
    pause
    exit /b 1
)
echo [✓] Dependencies installed

echo [→] Building Chorus...
call npm run build 2>nul
if %errorlevel% neq 0 (
    echo [✗] Build failed
    pause
    exit /b 1
)
echo [✓] Build complete

REM Create data directory
if not exist "%CHORUS_DIR%\data" mkdir "%CHORUS_DIR%\data"

REM Link CLI
call npm link 2>nul
echo [✓] CLI linked

REM ═══════════════════════════════════════════════════════════════
REM Setup Wizard
REM ═══════════════════════════════════════════════════════════════

echo.
echo ═══════════════════════════════════════════
echo  🎵 Welcome to Chorus Setup!
echo ═══════════════════════════════════════════
echo.

echo Step 1: n8n Connection
set /p N8N_URL="  n8n URL [http://localhost:5678]: "
if "%N8N_URL%"=="" set N8N_URL=http://localhost:5678

set /p N8N_KEY="  n8n API Key: "

echo.
echo Step 2: AI Model
echo   1) OpenAI (GPT-4o-mini)
echo   2) Anthropic (Claude)
echo   3) Groq (Fast, free tier)
echo   4) Ollama (Local, free)
echo   5) DeepSeek (Cheap)

set /p LLM_CHOICE="  Choose [1]: "
if "%LLM_CHOICE%"=="" set LLM_CHOICE=1

if "%LLM_CHOICE%"=="1" (
    set LLM_PROVIDER=openai
    set LLM_MODEL=gpt-4o-mini
    set LLM_NAME=OpenAI
)
if "%LLM_CHOICE%"=="2" (
    set LLM_PROVIDER=anthropic
    set LLM_MODEL=claude-3-5-sonnet-20241022
    set LLM_NAME=Anthropic
)
if "%LLM_CHOICE%"=="3" (
    set LLM_PROVIDER=groq
    set LLM_MODEL=llama-3.1-70b-versatile
    set LLM_NAME=Groq
)
if "%LLM_CHOICE%"=="4" (
    set LLM_PROVIDER=ollama
    set LLM_MODEL=llama3.1
    set LLM_NAME=Ollama
    set LLM_KEY=ollama
)
if "%LLM_CHOICE%"=="5" (
    set LLM_PROVIDER=deepseek
    set LLM_MODEL=deepseek-chat
    set LLM_NAME=DeepSeek
)

if not "%LLM_PROVIDER%"=="ollama" (
    set /p LLM_KEY="  %LLM_NAME% API Key: "
)

echo.
echo Step 3: Memory
echo   1) SQLite (persistent, recommended)
echo   2) In-memory (fast, lost on restart)

set /p MEM_CHOICE="  Choose [1]: "
if "%MEM_CHOICE%"=="" set MEM_CHOICE=1

if "%MEM_CHOICE%"=="1" set MEM_BACKEND=sqlite
if "%MEM_CHOICE%"=="2" set MEM_BACKEND=in-memory

REM Write config
(
echo # 🎵 Chorus Configuration
echo.
echo n8n:
echo   baseUrl: "%N8N_URL%"
echo   apiKey: "%N8N_KEY%"
echo   timeout: 30000
echo   retryAttempts: 3
echo.
echo llm:
echo   provider: "%LLM_PROVIDER%"
echo   apiKey: "%LLM_KEY%"
echo   model: "%LLM_MODEL%"
echo   maxTokens: 4096
echo   temperature: 0.7
echo   streaming: true
echo.
echo memory:
echo   backend: "%MEM_BACKEND%"
echo   sqlitePath: "%CHORUS_DIR%\data\chorus-memory.db"
echo   maxShortTermMessages: 50
echo   maxLongTermEntries: 10000
echo   ttlSeconds: 604800
echo.
echo guardrails:
echo   maxExecutionTimeMs: 300000
echo   maxBudgetPerRun: 10
echo   maxConcurrentRuns: 5
echo   maxTokensPerTurn: 8192
echo   rateLimits:
echo     maxRequestsPerMinute: 60
echo     maxTokensPerMinute: 100000
echo     maxWorkflowRunsPerHour: 100
echo.
echo observability:
echo   logLevel: "info"
echo   logFormat: "pretty"
echo.
echo agent:
echo   maxSteps: 25
echo   planningStrategy: "plan-and-execute"
echo   enableMemory: true
echo   enableReflection: true
echo   enableSelfHealing: true
) > "%CHORUS_DIR%\chorus.config.yaml"

echo [✓] Configuration saved

REM ═══════════════════════════════════════════════════════════════
REM Done
REM ═══════════════════════════════════════════════════════════════

echo.
echo ═══════════════════════════════════════════
echo  🎉 Chorus is ready!
echo ═══════════════════════════════════════════
echo.
echo   Get started:
echo     chorus run "Analyze my n8n workflows"
echo     chorus chat
echo     chorus serve
echo.
echo   Config: %CHORUS_DIR%\chorus.config.yaml
echo.

pause
