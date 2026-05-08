# ═══════════════════════════════════════════════════════════════
# 🎵 Chorus — PowerShell Installer (Windows)
# One-line install: iex (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/Atum246/chorus/master/install.ps1')
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$CHORUS_VERSION = "1.0.0"
$CHORUS_DIR = "$env:USERPROFILE\.chorus"
$REPO_URL = "https://github.com/Atum246/chorus.git"

# Colors
function Write-Color($Text, $Color = "White") { Write-Host $Text -ForegroundColor $Color }
function Write-Info($Text) { Write-Color "[✓] $Text" "Green" }
function Write-Step($Text) { Write-Color "[→] $Text" "Cyan" }
function Write-Warn($Text) { Write-Color "[!] $Text" "Yellow" }
function Write-Err($Text) { Write-Color "[✗] $Text" "Red" }

# Banner
Write-Color ""
Write-Color "  ╔══════════════════════════════════════════╗" "Cyan"
Write-Color "  ║                                          ║" "Cyan"
Write-Color "  ║   🎵  C H O R U S                       ║" "Cyan"
Write-Color "  ║   AI Agent Brain for n8n                 ║" "Cyan"
Write-Color "  ║                                          ║" "Cyan"
Write-Color "  ║   Installer v$CHORUS_VERSION                        ║" "Cyan"
Write-Color "  ║                                          ║" "Cyan"
Write-Color "  ╚══════════════════════════════════════════╝" "Cyan"
Write-Color ""

# ═══════════════════════════════════════════════════════════════
# Check Node.js
# ═══════════════════════════════════════════════════════════════

Write-Step "Checking Node.js..."

try {
    $nodeVersion = node -v 2>$null
    $nodeMajor = [int]($nodeVersion -replace 'v','' -split '\.')[0]
    
    if ($nodeMajor -lt 20) {
        Write-Warn "Node.js $nodeVersion found but v20+ required"
        throw "Old version"
    }
    
    Write-Info "Node.js $nodeVersion found"
} catch {
    Write-Warn "Node.js not found or outdated"
    Write-Step "Installing Node.js via winget..."
    
    try {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Info "Node.js installed"
    } catch {
        Write-Err "Could not auto-install Node.js"
        Write-Color "  Please install from https://nodejs.org" "Yellow"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ═══════════════════════════════════════════════════════════════
# Check Git
# ═══════════════════════════════════════════════════════════════

Write-Step "Checking Git..."

try {
    git --version 2>$null | Out-Null
    Write-Info "Git found"
} catch {
    Write-Warn "Git not found"
    Write-Step "Installing Git via winget..."
    
    try {
        winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Info "Git installed"
    } catch {
        Write-Err "Could not auto-install Git"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ═══════════════════════════════════════════════════════════════
# Install Chorus
# ═══════════════════════════════════════════════════════════════

Write-Step "Installing Chorus to $CHORUS_DIR..."

if (Test-Path $CHORUS_DIR) {
    Write-Step "Updating existing installation..."
    Set-Location $CHORUS_DIR
    git pull 2>$null
} else {
    Write-Step "Cloning repository..."
    git clone $REPO_URL $CHORUS_DIR
    Set-Location $CHORUS_DIR
}

Write-Step "Installing dependencies..."
npm install --production 2>$null
Write-Info "Dependencies installed"

Write-Step "Building Chorus..."
npm run build 2>$null
Write-Info "Build complete"

# Create data directory
New-Item -ItemType Directory -Force -Path "$CHORUS_DIR\data" | Out-Null

# Link CLI
Write-Step "Setting up CLI..."
npm link 2>$null
Write-Info "CLI linked"

# ═══════════════════════════════════════════════════════════════
# Setup Wizard
# ═══════════════════════════════════════════════════════════════

Write-Color ""
Write-Color "═══════════════════════════════════════════" "Cyan"
Write-Color " 🎵 Welcome to Chorus Setup!" "Cyan"
Write-Color "═══════════════════════════════════════════" "Cyan"
Write-Color ""

# n8n Configuration
Write-Color "Step 1: n8n Connection" "White"
$n8nUrl = Read-Host "  n8n URL [http://localhost:5678]"
if (-not $n8nUrl) { $n8nUrl = "http://localhost:5678" }

$n8nKey = Read-Host "  n8n API Key"

# LLM Configuration
Write-Color ""
Write-Color "Step 2: AI Model" "White"
Write-Color "  1) OpenAI (GPT-4o-mini)"
Write-Color "  2) Anthropic (Claude)"
Write-Color "  3) Google Gemini"
Write-Color "  4) Groq (Fast, free tier)"
Write-Color "  5) NVIDIA NIM"
Write-Color "  6) Ollama (Local, free)"
Write-Color "  7) DeepSeek (Cheap)"

$llmChoice = Read-Host "  Choose [1]"
if (-not $llmChoice) { $llmChoice = "1" }

switch ($llmChoice) {
    "1" { $script:LLM_PROVIDER="openai"; $script:LLM_MODEL="gpt-4o-mini"; $script:LLM_NAME="OpenAI" }
    "2" { $script:LLM_PROVIDER="anthropic"; $script:LLM_MODEL="claude-3-5-sonnet-20241022"; $script:LLM_NAME="Anthropic" }
    "3" { $script:LLM_PROVIDER="google"; $script:LLM_MODEL="gemini-2.0-flash"; $script:LLM_NAME="Google Gemini" }
    "4" { $script:LLM_PROVIDER="groq"; $script:LLM_MODEL="llama-3.1-70b-versatile"; $script:LLM_NAME="Groq" }
    "5" { $script:LLM_PROVIDER="nvidia"; $script:LLM_MODEL="meta/llama-3.1-70b-instruct"; $script:LLM_NAME="NVIDIA NIM" }
    "6" { $script:LLM_PROVIDER="ollama"; $script:LLM_MODEL="llama3.1"; $script:LLM_NAME="Ollama"; $script:LLM_KEY="ollama" }
    "7" { $script:LLM_PROVIDER="deepseek"; $script:LLM_MODEL="deepseek-chat"; $script:LLM_NAME="DeepSeek" }
}

if ($script:LLM_PROVIDER -ne "ollama") {
    $script:LLM_KEY = Read-Host "  $($script:LLM_NAME) API Key"
}

# Memory Configuration
Write-Color ""
Write-Color "Step 3: Memory" "White"
Write-Color "  1) SQLite (persistent, recommended)"
Write-Color "  2) In-memory (fast, lost on restart)"

$memChoice = Read-Host "  Choose [1]"
if (-not $memChoice) { $memChoice = "1" }

if ($memChoice -eq "1") { $script:MEM_BACKEND="sqlite" } else { $script:MEM_BACKEND="in-memory" }

# Write config
@"
# 🎵 Chorus Configuration

n8n:
  baseUrl: "$n8nUrl"
  apiKey: "$n8nKey"
  timeout: 30000
  retryAttempts: 3

llm:
  provider: "$($script:LLM_PROVIDER)"
  apiKey: "$($script:LLM_KEY)"
  model: "$($script:LLM_MODEL)"
  maxTokens: 4096
  temperature: 0.7
  streaming: true

memory:
  backend: "$($script:MEM_BACKEND)"
  sqlitePath: "$CHORUS_DIR\data\chorus-memory.db"
  maxShortTermMessages: 50
  maxLongTermEntries: 10000
  ttlSeconds: 604800

guardrails:
  maxExecutionTimeMs: 300000
  maxBudgetPerRun: 10
  maxConcurrentRuns: 5
  maxTokensPerTurn: 8192
  rateLimits:
    maxRequestsPerMinute: 60
    maxTokensPerMinute: 100000
    maxWorkflowRunsPerHour: 100

observability:
  logLevel: "info"
  logFormat: "pretty"

agent:
  maxSteps: 25
  planningStrategy: "plan-and-execute"
  enableMemory: true
  enableReflection: true
  enableSelfHealing: true
"@ | Out-File -FilePath "$CHORUS_DIR\chorus.config.yaml" -Encoding UTF8

Write-Info "Configuration saved"

# ═══════════════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════════════

Write-Color ""
Write-Color "═══════════════════════════════════════════" "Green"
Write-Color " 🎉 Chorus is ready!" "Green"
Write-Color "═══════════════════════════════════════════" "Green"
Write-Color ""
Write-Color "  Get started:"
Write-Color "    chorus run `"Analyze my n8n workflows`""
Write-Color "    chorus chat"
Write-Color "    chorus serve"
Write-Color ""
Write-Color "  Config: $CHORUS_DIR\chorus.config.yaml"
Write-Color "  GitHub: https://github.com/Atum246/chorus"
Write-Color ""

Read-Host "Press Enter to exit"
