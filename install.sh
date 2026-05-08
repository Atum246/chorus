#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🎵 Chorus — Universal Installer (Linux & macOS)
# ═══════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CHORUS_VERSION="1.0.0"
CHORUS_DIR="${CHORUS_DIR:-$HOME/.chorus}"
NODE_MIN_VERSION=20

# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

print_banner() {
  echo -e "${CYAN}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║                                          ║"
  echo "  ║   🎵  C H O R U S                       ║"
  echo "  ║   AI Agent Brain for n8n                 ║"
  echo "  ║                                          ║"
  echo "  ║   Installer v${CHORUS_VERSION}                        ║"
  echo "  ║                                          ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${NC}"
}

log_info() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

log_step() {
  echo -e "${CYAN}[→]${NC} $1"
}

# ═══════════════════════════════════════════════════════════════
# OS Detection
# ═══════════════════════════════════════════════════════════════

detect_os() {
  case "$(uname -s)" in
    Linux*)     OS="linux";;
    Darwin*)    OS="macos";;
    CYGWIN*|MINGW*|MSYS*) OS="windows";;
    *)          OS="unknown";;
  esac

  case "$(uname -m)" in
    x86_64*)  ARCH="x64";;
    arm64*|aarch64*) ARCH="arm64";;
    *)        ARCH="unknown";;
  esac

  log_info "Detected: ${OS} (${ARCH})"
}

# ═══════════════════════════════════════════════════════════════
# Dependency Checks
# ═══════════════════════════════════════════════════════════════

check_node() {
  log_step "Checking Node.js..."

  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -ge "$NODE_MIN_VERSION" ]; then
      log_info "Node.js $(node -v) found"
      return 0
    else
      log_warn "Node.js $(node -v) found but v${NODE_MIN_VERSION}+ required"
    fi
  else
    log_warn "Node.js not found"
  fi

  return 1
}

install_node() {
  log_step "Installing Node.js..."

  case "$OS" in
    macos)
      if command -v brew &> /dev/null; then
        brew install node@20
      else
        log_error "Homebrew not found. Install from https://brew.sh"
        log_info "Or install Node.js from https://nodejs.org"
        exit 1
      fi
      ;;
    linux)
      # Try to install via package manager
      if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
      elif command -v dnf &> /dev/null; then
        sudo dnf module install nodejs:20/common
      elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
      elif command -v pacman &> /dev/null; then
        sudo pacman -S nodejs npm
      else
        log_error "Could not auto-install Node.js"
        log_info "Install Node.js v20+ from https://nodejs.org"
        exit 1
      fi
      ;;
  esac

  if check_node; then
    log_info "Node.js installed successfully"
  else
    log_error "Node.js installation failed"
    exit 1
  fi
}

check_git() {
  if ! command -v git &> /dev/null; then
    log_warn "Git not found — installing..."
    case "$OS" in
      macos) brew install git ;;
      linux)
        if command -v apt-get &> /dev/null; then
          sudo apt-get install -y git
        elif command -v dnf &> /dev/null; then
          sudo dnf install -y git
        fi
        ;;
    esac
  fi
}

# ═══════════════════════════════════════════════════════════════
# Installation
# ═══════════════════════════════════════════════════════════════

install_chorus() {
  log_step "Installing Chorus to ${CHORUS_DIR}..."

  # Create directory
  mkdir -p "$CHORUS_DIR"

  # Check if running from source or download from GitHub
  if [ -f "package.json" ] && grep -q '"chorus"' package.json 2>/dev/null; then
    log_info "Installing from source..."
    cp -r . "$CHORUS_DIR/" 2>/dev/null || true
  else
    log_info "Downloading Chorus from GitHub..."
    if command -v git &> /dev/null; then
      git clone https://github.com/dav-chorus/chorus.git "$CHORUS_DIR" 2>/dev/null || {
        log_error "Failed to clone repository"
        exit 1
      }
    else
      log_error "Git not found. Please install git first."
      exit 1
    fi
  fi

  cd "$CHORUS_DIR"

  # Install npm dependencies
  log_step "Installing dependencies (this may take a minute)..."
  npm install --production 2>&1 | while read -r line; do
    if [[ "$line" == *"added"* ]]; then
      log_info "Dependencies installed"
    fi
  done

  # Build
  log_step "Building Chorus..."
  npm run build 2>&1 | while read -r line; do
    echo -ne "."
  done
  echo ""
  log_info "Build complete"

  # Make CLI executable
  chmod +x dist/cli/index.js 2>/dev/null || true

  # Create symlink
  log_step "Setting up CLI..."
  npm link 2>/dev/null || true

  # Add to PATH if needed
  if ! command -v chorus &> /dev/null; then
    SHELL_RC=""
    case "$SHELL" in
      */zsh)  SHELL_RC="$HOME/.zshrc";;
      */bash) SHELL_RC="$HOME/.bashrc";;
      */fish) SHELL_RC="$HOME/.config/fish/config.fish";;
    esac

    if [ -n "$SHELL_RC" ]; then
      echo "export PATH=\"\$PATH:$CHORUS_DIR/node_modules/.bin\"" >> "$SHELL_RC"
      log_info "Added to PATH in $SHELL_RC"
      log_warn "Run 'source $SHELL_RC' or restart your terminal"
    fi
  fi

  # Create data directory
  mkdir -p "$CHORUS_DIR/data"

  log_info "Chorus installed to $CHORUS_DIR"
}

# ═══════════════════════════════════════════════════════════════
# Setup Wizard
# ═══════════════════════════════════════════════════════════════

run_setup_wizard() {
  echo ""
  echo -e "${CYAN}${BOLD}🎵 Welcome to Chorus Setup!${NC}"
  echo ""

  # n8n Configuration
  echo -e "${BOLD}Step 1: n8n Connection${NC}"
  read -rp "  n8n URL [http://localhost:5678]: " N8N_URL
  N8N_URL="${N8N_URL:-http://localhost:5678}"

  read -rp "  n8n API Key: " N8N_KEY
  if [ -z "$N8N_KEY" ]; then
    log_warn "No API key provided — you can add it later in chorus.config.yaml"
  fi

  # LLM Configuration
  echo ""
  echo -e "${BOLD}Step 2: AI Model${NC}"
  echo "  1) OpenAI (GPT-4o-mini)"
  echo "  2) Anthropic (Claude)"
  echo "  3) Groq (Fast, free tier)"
  echo "  4) Ollama (Local, free)"
  echo "  5) DeepSeek (Cheap)"
  echo "  6) Other"

  read -rp "  Choose [1]: " LLM_CHOICE
  LLM_CHOICE="${LLM_CHOICE:-1}"

  case "$LLM_CHOICE" in
    1) LLM_PROVIDER="openai"; LLM_MODEL="gpt-4o-mini"; LLM_NAME="OpenAI";;
    2) LLM_PROVIDER="anthropic"; LLM_MODEL="claude-3-5-sonnet-20241022"; LLM_NAME="Anthropic";;
    3) LLM_PROVIDER="groq"; LLM_MODEL="llama-3.1-70b-versatile"; LLM_NAME="Groq";;
    4) LLM_PROVIDER="ollama"; LLM_MODEL="llama3.1"; LLM_NAME="Ollama";;
    5) LLM_PROVIDER="deepseek"; LLM_MODEL="deepseek-chat"; LLM_NAME="DeepSeek";;
    6)
      read -rp "  Provider name: " LLM_PROVIDER
      read -rp "  Model name: " LLM_MODEL
      LLM_NAME="$LLM_PROVIDER"
      ;;
  esac

  if [ "$LLM_PROVIDER" != "ollama" ]; then
    read -rp "  ${LLM_NAME} API Key: " LLM_KEY
  else
    LLM_KEY="ollama"
    log_info "Make sure Ollama is running: ollama serve"
  fi

  # Memory Configuration
  echo ""
  echo -e "${BOLD}Step 3: Memory${NC}"
  echo "  1) SQLite (persistent, recommended)"
  echo "  2) In-memory (fast, lost on restart)"

  read -rp "  Choose [1]: " MEM_CHOICE
  MEM_CHOICE="${MEM_CHOICE:-1}"

  case "$MEM_CHOICE" in
    1) MEM_BACKEND="sqlite";;
    2) MEM_BACKEND="in-memory";;
  esac

  # Write config
  cat > "$CHORUS_DIR/chorus.config.yaml" << EOF
# 🎵 Chorus Configuration
# Generated by setup wizard

n8n:
  baseUrl: "${N8N_URL}"
  apiKey: "${N8N_KEY}"
  timeout: 30000
  retryAttempts: 3
  retryDelay: 1000

llm:
  provider: "${LLM_PROVIDER}"
  apiKey: "${LLM_KEY}"
  model: "${LLM_MODEL}"
  maxTokens: 4096
  temperature: 0.7
  streaming: true

memory:
  backend: "${MEM_BACKEND}"
  sqlitePath: "${CHORUS_DIR}/data/chorus-memory.db"
  maxShortTermMessages: 50
  maxLongTermEntries: 10000
  ttlSeconds: 604800

guardrails:
  maxExecutionTimeMs: 300000
  maxBudgetPerRun: 10
  maxConcurrentRuns: 5
  allowedDomains: []
  blockedDomains: []
  maxTokensPerTurn: 8192
  requireApproval: []
  rateLimits:
    maxRequestsPerMinute: 60
    maxTokensPerMinute: 100000
    maxWorkflowRunsPerHour: 100

observability:
  logLevel: "info"
  logFormat: "pretty"
  enableTracing: false
  enableMetrics: false

agent:
  maxSteps: 25
  maxReflections: 5
  planningStrategy: "plan-and-execute"
  enableMemory: true
  enableReflection: true
  enableSelfHealing: true
EOF

  log_info "Configuration saved to $CHORUS_DIR/chorus.config.yaml"

  # Test connection
  echo ""
  echo -e "${BOLD}Step 4: Test Connection${NC}"

  cd "$CHORUS_DIR"
  if npx tsx src/cli/index.ts health 2>/dev/null; then
    log_info "All connections working!"
  else
    log_warn "Some connections failed — check your config"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

main() {
  print_banner
  detect_os
  check_git

  if ! check_node; then
    install_node
  fi

  install_chorus
  run_setup_wizard

  echo ""
  echo -e "${GREEN}${BOLD}🎉 Chorus is ready!${NC}"
  echo ""
  echo "  Get started:"
  echo "    chorus run \"Analyze my n8n workflows\""
  echo "    chorus chat"
  echo "    chorus serve"
  echo ""
  echo "  Config: $CHORUS_DIR/chorus.config.yaml"
  echo "  Docs:   https://github.com/chorus-ai/chorus"
  echo ""
}

main "$@"
