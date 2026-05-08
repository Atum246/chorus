<p align="center">
  <img src="https://img.shields.io/badge/🎵-Chorus-blue" alt="Chorus" width="400">
</p>

<h1 align="center">Chorus</h1>
<p align="center"><strong>AI Agent Brain for n8n — Turn Your Workflows Into Autonomous Agents</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.0-green" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/tests-45%20passed-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/providers-25-orange" alt="Providers">
  <img src="https://img.shields.io/badge/tools-50%2B-purple" alt="Tools">
</p>

---

## 🤔 What Is Chorus?

**Chorus is the missing piece n8n has always needed.**

You already use n8n to automate workflows. You love the visual editor, the 400+ integrations, the self-hosted power. But you've hit a wall:

- Your workflows follow **fixed paths** — they can't think
- They **forget everything** between runs
- When something fails, they just **stop dead**
- They can't **plan**, **reason**, or **adapt**
- They have no idea how much they're **costing you**
- They can't **learn from mistakes**

**Chorus changes all of that.**

It's an open-source AI agent brain that plugs into your n8n instance and gives it superpowers. Your workflows don't just follow paths anymore — they **think**, **plan**, **remember**, **heal**, **learn**, and **evolve**.

---

## 🎯 What Does Chorus Turn n8n Into?

| Before Chorus | After Chorus |
|---------------|--------------|
| ❌ Fixed workflow paths | ✅ **Autonomous decision making** — AI decides what to do |
| ❌ Forgets everything between runs | ✅ **Persistent memory** — remembers forever with SQLite |
| ❌ Fails and stops | ✅ **Self-healing** — auto-recovers from errors |
| ❌ No learning | ✅ **Reflection** — learns from every execution |
| ❌ Can't plan complex tasks | ✅ **Multi-step reasoning** — plans strategies |
| ❌ No cost awareness | ✅ **Cost tracking** — tracks every penny |
| ❌ No safety limits | ✅ **Guardrails** — budgets, rate limits, approvals |
| ❌ Disconnected data | ✅ **Knowledge graph** — connects related info |
| ❌ Can't search history | ✅ **Semantic search** — searches past experiences |
| ❌ Can't break down goals | ✅ **Goal decomposition** — splits complex goals |
| ❌ No confidence signals | ✅ **Confidence scoring** — knows how sure it is |
| ❌ No human oversight | ✅ **Human-in-the-loop** — approval system |
| ❌ Single workflow limit | ✅ **Multi-agent** — agents collaborate |
| ❌ No streaming | ✅ **Streaming** — real-time LLM responses |
| ❌ Limited tool use | ✅ **Function calling** — full tool integration |
| ❌ Manual workflow wiring | ✅ **Workflow composition** — combine like LEGO |
| ❌ Error = game over | ✅ **Error recovery** — retry, fallback, skip |
| ❌ Token limit chaos | ✅ **Context management** — smart token handling |
| ❌ Blind execution | ✅ **Real-time monitoring** — live dashboards |

**In short: Chorus turns n8n from a workflow tool into a full AI agent platform.**

---

## 🚀 Getting Started (5 Minutes)

### Installation

#### Linux / macOS (One Command)
```bash
curl -fsSL https://raw.githubusercontent.com/Atum246/chorus/master/install.sh | bash
```

#### Windows (One Command)
```bat
git clone https://github.com/Atum246/chorus.git && cd chorus && install.bat
```

#### Windows PowerShell (One Line)
```powershell
iex (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/Atum246/chorus/master/install.ps1')
```

#### Manual Install
```bash
git clone https://github.com/Atum246/chorus.git
cd chorus
npm install
npm run build
npm link
chorus init
```

### First Run
```bash
# Start Chorus
chorus init          # Setup wizard (connects n8n + picks your AI model)
chorus run "Analyze my n8n workflows and tell me how to optimize them"
```

---

## 💡 How People Use Chorus With n8n

### 1. 🤖 Smart Customer Support Agent

**Before:** n8n workflow receives support ticket → sends canned response → done.

**After with Chorus:**
```bash
chorus run "When a customer support ticket comes in via webhook, check their history in our database, analyze their sentiment, draft a personalized response, and if it's a refund request over $100, ask for human approval before sending"
```

Chorus will:
1. Receive the webhook
2. Search memory for past interactions with this customer
3. Analyze sentiment (angry? confused? happy?)
4. Draft a personalized response
5. Check if it's a refund over $100
6. If yes → request human approval
7. If no → send response automatically
8. Store the interaction in memory for next time

### 2. 📊 Autonomous Data Pipeline

**Before:** n8n fetches data on schedule → transforms → stores → done.

**After with Chorus:**
```bash
chorus run "Every hour, fetch data from our 3 APIs, merge them, find anomalies, if there's something unusual search the web for context, write a summary report, and Slack it to the team. If any API fails, retry 3 times, then use cached data"
```

Chorus will:
1. Fetch from all 3 APIs in parallel
2. If one fails → retry with exponential backoff
3. If still fails → use cached data from memory
4. Merge and analyze the data
5. Detect anomalies using AI reasoning
6. Search web for context on anomalies
7. Generate a human-readable report
8. Send to Slack
9. Store results in memory for future reference

### 3. 🧠 Research Agent

**Before:** n8n can't do research — it just passes data through.

**After with Chorus:**
```bash
chorus run "Research the latest AI agent frameworks, compare them, find pros and cons, write a blog post, and create a summary. Remember what you learned for next time"
```

Chorus will:
1. Launch a headless browser
2. Search DuckDuckGo for AI agent frameworks
3. Visit top 5 results and extract content
4. Analyze and compare the frameworks
5. Write a blog post with findings
6. Store all research in memory
7. Next time → it remembers and builds on previous research

### 4. 🔄 Self-Healing Production Workflows

**Before:** n8n workflow fails at 3am → you wake up to fix it.

**After with Chorus:**
```bash
chorus run "Monitor all our production workflows, if any fail, analyze the error, try to fix it automatically, if you can't, page the on-call engineer with full context"
```

Chorus will:
1. Monitor all workflows in real-time
2. When one fails → analyze the error
3. Try recovery strategies (retry, fallback, skip)
4. If auto-fix works → log it and continue
5. If not → send detailed alert with:
   - What failed
   - Why it failed
   - What was tried
   - Suggested fix
   - Full execution context

### 5. 📈 Workflow Analytics Dashboard

**Before:** n8n has basic execution logs.

**After with Chorus:**
```bash
chorus run "Analyze all our workflows, find the ones with high error rates, suggest optimizations, track costs, and create a weekly report"
```

Chorus will:
1. Analyze all workflow executions
2. Calculate success rates, avg duration, error patterns
3. Identify bottlenecks and failures
4. Track LLM costs per workflow
5. Generate optimization recommendations
6. Create a beautiful weekly report

### 6. 🌐 Multi-Workflow Orchestration

**Before:** n8n workflows are isolated — you can't easily combine them.

**After with Chorus:**
```bash
chorus run "Combine our 'Fetch Data', 'Process Data', and 'Send Report' workflows into one mega-workflow that runs them in sequence with error handling between each step"
```

Chorus will:
1. Analyze all 3 workflows
2. Create a new combined workflow
3. Add error handling between steps
4. Add memory context passing
5. Deploy it to n8n

---

## 🧠 The 19 Superpowers (What n8n Can't Do)

### 1. 🎯 Autonomous Decision Making
Your workflows now **think**. Instead of following fixed paths, the AI decides what to do next based on the current situation.

```javascript
// n8n before: Fixed path
if (status === 'error') → send alert

// Chorus after: AI decides
AI analyzes the error, context, past experiences, and decides:
- Retry with different parameters?
- Use cached data?
- Try alternative API?
- Ask human for help?
- Skip and continue?
```

### 2. 💾 Persistent Memory
Chorus remembers **everything** across runs using SQLite:

```javascript
// Before: Workflow forgets everything
Run 1: Process order #123 → Done (forgotten)
Run 2: Process order #123 → No memory of previous run

// After: Chorus remembers
Run 1: Process order #123 → Stores customer preferences, issues, patterns
Run 2: Same customer → Remembers preferences, avoids past issues
```

### 3. 🔧 Self-Healing
When something fails, Chorus doesn't give up — it tries to fix itself:

```
Error: API timeout
  → Strategy: Retry with exponential backoff
  → Attempt 1: Failed (wait 1s)
  → Attempt 2: Failed (wait 2s)
  → Attempt 3: Success!
  → Stored lesson: "API sometimes needs 3 retries"
```

### 4. 🤔 Reflection & Learning
After every execution, Chorus reflects on what happened:

```
Reflection:
  ✅ What worked: Webhook processing was fast
  ❌ What failed: API call timed out
  💡 Lesson: Add timeout handling for external APIs
  📝 Improvement: Auto-add timeout to all HTTP nodes
```

### 5. 🧩 Multi-Step Reasoning
Chorus breaks complex goals into executable strategies:

```
Goal: "Analyze customer data and create personalized marketing campaign"

Plan:
  1. Fetch customer data from database
  2. Segment customers by behavior
  3. Analyze each segment's preferences
  4. Generate personalized content for each segment
  5. A/B test the content
  6. Deploy winning variant
  7. Monitor results
```

### 6. 💰 Cost Tracking
Know exactly how much every workflow costs:

```
Cost Report:
  Workflow: "Customer Analysis"
  ├── LLM calls: 15
  ├── Tokens used: 45,000
  ├── Cost: $0.12
  ├── Budget remaining: $9.88
  └── Provider breakdown:
      ├── OpenAI: $0.08
      └── Groq: $0.04
```

### 7. 🛡️ Guardrails
Set limits that keep your agents safe:

```yaml
guardrails:
  maxBudgetPerRun: $10        # Stop if cost exceeds $10
  maxExecutionTime: 5min      # Stop if running too long
  requireApproval:            # Need human approval for:
    - send_email              # Sending emails
    - delete_*                # Any deletion
    - refund_*                # Refunds
  blockedDomains:             # Never access:
    - evil.com
    - competitor.com
```

### 8. 🕸️ Knowledge Graph
Connect related information across all your data:

```
Customer A → placed → Order #123
Order #123 → contains → Product X
Product X → has issue → Bug Report #456
Bug Report #456 → fixed in → Version 2.1

Query: "What's the status of Customer A's issue?"
Answer: "Fixed in Version 2.1, deploying next week"
```

### 9. 🔍 Semantic Search
Search through all past experiences:

```bash
chorus memory search "customer complained about shipping"
# Returns memories ranked by relevance:
# 1. Customer #456 complained about 5-day shipping (relevance: 0.95)
# 2. Shipping delays in Northeast region (relevance: 0.78)
# 3. FedEx integration issues last month (relevance: 0.65)
```

### 10. 🎯 Goal Decomposition
Break complex goals into manageable pieces:

```
Goal: "Launch new product"

Sub-goals:
  1. [P1] Create product page
  2. [P1] Setup payment processing
  3. [P2] Write marketing copy
  4. [P2] Create email campaign
  5. [P3] Social media announcements
  6. [P3] Monitor launch metrics
```

### 11. 📊 Confidence Scoring
Know how sure the AI is about its decisions:

```
Decision: "Route to sales team"
Confidence: 0.92 (High)
Reasoning: Customer mentioned "buying", "budget", "timeline"
Hedging detected: No
Specifics found: Budget ($50k), Timeline (Q2)
```

### 12. 👤 Human-in-the-Loop
Request human approval for sensitive actions:

```
⏳ APPROVAL REQUIRED
Action: Process refund of $500 for Customer #789
Reason: Refund exceeds $100 threshold
Context: Customer has been loyal for 3 years, first refund request

[Approve] [Reject] [Auto-approve in 5 minutes]
```

### 13. 🤝 Multi-Agent Collaboration
Multiple agents working together:

```
Task: "Research competitor and create report"

Delegation:
  → Research Agent: Scrape competitor websites
  → Analysis Agent: Compare features and pricing
  → Writing Agent: Create executive summary
  → Design Agent: Format report
  
All agents share memory and coordinate results.
```

### 14. 📡 Streaming
Real-time LLM response streaming:

```
Agent thinking... ▊
Agent thinking... Analyzing your data...
Agent thinking... Found 3 anomalies...
Agent thinking... Generating report...
Agent thinking... ✅ Complete!
```

### 15. 🔧 Function Calling
LLMs can use tools directly:

```
User: "What's the weather in NYC?"

LLM calls: web_search(query="current weather NYC")
Result: 72°F, partly cloudy

LLM response: "It's currently 72°F and partly cloudy in NYC."
```

### 16. 🧱 Workflow Composition
Combine workflows like LEGO blocks:

```javascript
// Sequential: Run one after another
compose(['fetch-data', 'process-data', 'send-report'], 'sequential')

// Parallel: Run all at once
compose(['fetch-api-1', 'fetch-api-2', 'fetch-api-3'], 'parallel')

// Conditional: AI decides which to run
compose(['handle-refund', 'handle-complaint', 'handle-question'], 'conditional')
```

### 17. 🔄 Error Recovery
Smart strategies for every error type:

| Error | Strategy |
|-------|----------|
| Timeout | Retry with longer timeout |
| Rate limit | Exponential backoff |
| Not found | Use cached data |
| Permission | Request human help |
| Network | Retry 3x then fail gracefully |

### 18. 📐 Context Management
Never hit token limits again:

```
Context window: 128,000 tokens
Used: 95,000 tokens
Action: Auto-summarizing old messages...
Result: Freed 30,000 tokens, kept important context
```

### 19. 📺 Real-Time Monitoring
Watch everything happen live:

```
┌─ Chorus Dashboard ─────────────────────────┐
│ 🟢 Active Agents: 3                        │
│ ⚡ Running Steps: 7                         │
│ 💰 Cost Today: $2.45                       │
│ ✅ Success Rate: 97%                        │
│ 📊 Events/min: 45                          │
│                                            │
│ Recent Events:                             │
│  14:32:01 ✅ Agent "Support" completed     │
│  14:31:58 ⚡ Step "Fetch Data" executing   │
│  14:31:55 🤔 Agent "Research" reflecting  │
│  14:31:50 ✅ Workflow "Pipeline" finished  │
└────────────────────────────────────────────┘
```

---

## 🌐 25 AI Model Providers

Connect to **any** AI model, cloud or local:

| Provider | Models | Speed | Cost | Best For |
|----------|--------|-------|------|----------|
| **OpenAI** | GPT-4o, GPT-4o-mini | ⚡⚡ | $$ | General purpose |
| **Anthropic** | Claude 3.5, Claude 3 Opus | ⚡⚡ | $$$ | Complex reasoning |
| **Google Gemini** | Gemini 2.0 Flash, 1.5 Pro | ⚡⚡⚡ | $ | Fast, huge context (2M tokens!) |
| **NVIDIA NIM** | Llama 3.1, Nemotron | ⚡⚡⚡ | $ | Fast inference |
| **Groq** | Llama 3.1, Mixtral | ⚡⚡⚡⚡ | $ | Fastest inference |
| **Together AI** | Llama, Mixtral, Qwen | ⚡⚡⚡ | $ | Open source models |
| **DeepSeek** | DeepSeek Chat, Coder | ⚡⚡ | ¢ | Cheapest GPT-4 quality |
| **Mistral** | Mistral Large, Medium | ⚡⚡ | $$ | European AI |
| **Fireworks** | Llama, Mixtral | ⚡⚡⚡ | $ | Fast open source |
| **Perplexity** | Sonar models | ⚡⚡ | $ | Web-connected AI |
| **Cohere** | Command R+ | ⚡⚡ | $$ | Enterprise |
| **OpenRouter** | All models | ⚡⚡ | Varies | Access everything |
| **xAI Grok** | Grok Beta | ⚡⚡ | $$ | Real-time info |
| **Replicate** | All open source | ⚡⚡ | $$ | Run any model |
| **SambaNova** | Llama, DeepSeek | ⚡⚡⚡ | $ | Fast inference |
| **Cerebras** | Llama 3.1 | ⚡⚡⚡⚡ | $ | Fastest chips |
| **Lepton** | Llama, Mixtral | ⚡⚡⚡ | $ | Simple API |
| **Novita** | Llama, DeepSeek | ⚡⚡⚡ | ¢ | Cheapest |
| **Hyperbolic** | Llama, Qwen | ⚡⚡⚡ | $ | GPU cloud |
| **Lambda** | Hermes, Llama | ⚡⚡ | $ | Research |
| **Chutes** | Llama, DeepSeek | ⚡⚡⚡ | ¢ | Budget |
| **Kluster** | Llama, Mixtral | ⚡⚡⚡ | ¢ | Cheapest |
| **Ollama** | All local models | ⚡⚡ | FREE | Privacy |
| **LM Studio** | All local models | ⚡⚡ | FREE | Easy local |
| **vLLM** | All local models | ⚡⚡⚡ | FREE | Production local |

---

## 🔧 50+ Built-in Tools

### n8n Integration
| Tool | Description |
|------|-------------|
| `n8n_execute_workflow` | Run any n8n workflow |
| `n8n_trigger_webhook` | Trigger webhook endpoints |
| `n8n_list_workflows` | List all workflows |
| `n8n_analyze_workflow` | Analyze workflow structure |
| `n8n_create_workflow` | Create new workflows |

### 🌐 Web & Search
| Tool | Description |
|------|-------------|
| `web_search` | Search the web (DuckDuckGo, Google, Bing) |
| `web_scrape` | Extract content from URLs |
| `web_screenshot` | Capture webpage screenshots |

### 🌐 Browser Control
| Tool | Description |
|------|-------------|
| `browser_launch` | Spin up headless browser |
| `browser_navigate` | Go to any URL |
| `browser_click` | Click elements |
| `browser_type` | Fill forms |
| `browser_screenshot` | Capture screenshots |
| `browser_extract` | Extract text, links, images, tables |
| `browser_research` | Multi-source research |
| `browser_pdf` | Generate PDFs |
| `browser_evaluate` | Run JavaScript |

### 📁 File Operations
| Tool | Description |
|------|-------------|
| `file_read` | Read file contents |
| `file_write` | Write to files |
| `file_list` | List directory contents |
| `file_delete` | Delete files (trash, recoverable) |

### 💻 Code Execution
| Tool | Description |
|------|-------------|
| `code_execute` | Run JavaScript/Node.js |
| `code_eval` | Evaluate math expressions |

### 📊 Data Processing
| Tool | Description |
|------|-------------|
| `json_transform` | Transform JSON with dot notation |
| `csv_parse` | Parse CSV to structured data |
| `json_validate` | Validate against schemas |

### 🤖 AI & Text
| Tool | Description |
|------|-------------|
| `text_summarize` | Summarize long text |
| `text_extract` | Extract emails, phones, URLs, dates |
| `text_translate` | Translate to any language |
| `sentiment_analyze` | Analyze sentiment and emotion |

### 🔔 Notifications
| Tool | Description |
|------|-------------|
| `notify_email` | Send emails |
| `notify_slack` | Slack notifications |
| `notify_webhook` | Webhook notifications |

### 🔌 API & Integration
| Tool | Description |
|------|-------------|
| `api_call` | REST API with retry |
| `graphql_query` | GraphQL queries |

### ⏰ Utility
| Tool | Description |
|------|-------------|
| `date_calc` | Date math (add, subtract, diff) |
| `uuid_generate` | Generate UUIDs |
| `hash_generate` | MD5, SHA256, SHA512 |
| `base64_encode` | Encode/decode Base64 |
| `json_parse` | Parse and validate JSON |
| `cron_schedule` | Schedule recurring tasks |

### 💻 System
| Tool | Description |
|------|-------------|
| `system_info` | OS, memory, CPU info |
| `env_get` | Read environment variables |
| `shell_exec` | Safe shell commands |

---

## 📋 8 Pre-Built Workflow Templates

| Template | Description | Use Case |
|----------|-------------|----------|
| `webhook-ai-processor` | Webhook → AI → Respond | Smart API endpoints |
| `scheduled-data-pipeline` | Schedule → Fetch → Transform → Store | Data ETL |
| `agent-loop` | Goal → Plan → Execute → Loop | Autonomous agents |
| `error-handler` | Error → Analyze → Notify | Global error handling |
| `data-sync` | Source → Transform → Target | Data synchronization |
| `chatbot-memory` | Chat → Remember → Respond | Conversational AI |
| `monitor-alert` | Check → Evaluate → Alert | Service monitoring |
| `content-generator` | Prompt → AI → Content | Content creation |

---

## 🎮 CLI Commands

```bash
# Setup
chorus init                    # Interactive setup wizard

# Run Agents
chorus run "goal"              # Run agent with a goal
chorus run "goal" --name "My Agent"
chorus run "goal" --persona "You are a data analyst"

# Interactive
chorus chat                    # Chat with agents interactively
chorus serve                   # Start REST API server

# Manage
chorus agent list              # List all agents
chorus agent create            # Create new agent
chorus workflow list           # List n8n workflows
chorus workflow test           # Test n8n connection
chorus workflow analyze <id>   # Analyze workflow structure

# Memory
chorus memory stats            # Memory statistics
chorus memory search "query"   # Search memories

# Providers
chorus providers list          # List all 25 providers
chorus providers models <id>   # List models for provider

# Templates
chorus templates list          # List workflow templates
chorus templates build <id>    # Build from template

# System
chorus health                  # Health check
chorus events                  # Recent events
```

---

## 🌐 REST API

Start the server:
```bash
chorus serve --port 3000
```

### Endpoints

```bash
# Agents
POST /api/agents              # Create agent
GET  /api/agents              # List agents
GET  /api/agents/:id          # Get agent state
POST /api/agents/:id/run      # Run agent

# Quick Run
POST /api/run                 # Create + run in one step

# Workflows
GET  /api/workflows           # List n8n workflows

# Templates
GET  /api/templates           # List templates
POST /api/templates/:id       # Build from template

# Providers
GET  /api/providers           # List all providers
GET  /api/providers/:id       # Get provider details
GET  /api/providers/:id/models # List models

# Memory
GET  /api/memory/stats        # Memory statistics

# System
GET  /api/health              # Health check
```

### Example API Call
```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"goal": "Analyze our sales data and find trends"}'
```

---

## ⚙️ Configuration

### `chorus.config.yaml`
```yaml
n8n:
  baseUrl: "http://localhost:5678"
  apiKey: "your-n8n-api-key"

llm:
  provider: "openai"           # Any of 25 providers
  apiKey: "your-api-key"
  model: "gpt-4o-mini"

memory:
  backend: "sqlite"            # Persistent storage
  sqlitePath: "./data/chorus-memory.db"

guardrails:
  maxBudgetPerRun: 10          # $10 per run
  maxExecutionTimeMs: 300000   # 5 minutes max
  requireApproval:             # Need approval for:
    - "send_email"
    - "delete_*"

agent:
  maxSteps: 25
  planningStrategy: "plan-and-execute"
  enableMemory: true
  enableReflection: true
  enableSelfHealing: true
```

### Environment Variables
```bash
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-key
LLM_PROVIDER=openai
LLM_API_KEY=your-key
LLM_MODEL=gpt-4o-mini
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI / REST API                        │
├─────────────────────────────────────────────────────────────┤
│                      Agent Manager                           │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│  Agent   │  Agent   │  Agent   │  Agent   │    ...         │
│  Engine  │  Engine  │  Engine  │  Engine  │                │
├──────────┴──────────┴──────────┴──────────┴────────────────┤
│   Autonomous   │  Self-Healing  │  Reflection  │  Reasoning │
│   Decision     │  Recovery      │  Learning    │  Engine    │
├────────────────┴────────────────┴──────────────┴────────────┤
│   Memory Manager (SQLite)  │  Knowledge Graph  │  Semantic  │
│   Short-term │ Long-term   │  Connections      │  Search    │
├────────────────────────────┴───────────────────┴────────────┤
│   Universal LLM Connector (25 Providers)                    │
├─────────────────────────────────────────────────────────────┤
│   Tool Registry (50+ Tools)                                 │
│   n8n │ Web │ Browser │ Files │ Code │ Data │ API │ System  │
├─────────────────────────────────────────────────────────────┤
│   n8n Client  │  Smart Connector  │  Workflow Composer      │
├─────────────────────────────────────────────────────────────┤
│   Guardrails  │  Cost Tracker  │  Real-Time Monitor         │
├─────────────────────────────────────────────────────────────┤
│                     Observability                            │
│   Metrics  │  Tracing  │  Health Checks  │  Event Log       │
└─────────────────────────────────────────────────────────────┘
```

---

## ❓ FAQ

### Q: Do I need to replace n8n?
**A: No!** Chorus enhances n8n, it doesn't replace it. You keep all your existing workflows, integrations, and the visual editor. Chorus adds an AI brain on top.

### Q: Does Chorus work with n8n Cloud?
**A: Yes!** Chorus connects via n8n's API, which works with both self-hosted and n8n Cloud. Just provide your API key.

### Q: What if I don't have an n8n instance?
**A: No problem!** Chorus works standalone too. You can use all the AI agent features, memory, tools, and browser control without n8n. But if you want to supercharge n8n, just connect it.

### Q: Is my data safe?
**A: Yes!** Chorus runs locally on your machine. Your data stays on your computer. The only external calls are to your chosen LLM provider. Use Ollama for 100% local, private operation.

### Q: How much does it cost?
**A: Chorus is free and open source (MIT license).** You only pay for LLM API calls. Use Groq or Ollama for free/cheap operation. Cost tracking keeps you informed.

### Q: Can I use multiple LLM providers?
**A: Yes!** Configure one as default, but switch per-agent or per-task. Use OpenAI for complex reasoning, Groq for speed, Ollama for privacy.

### Q: Does it support streaming?
**A: Yes!** Real-time streaming for all providers that support it. See responses as they're generated.

### Q: Can I create custom tools?
**A: Yes!** Register custom tools via the API or extend the source code. The tool registry is fully extensible.

### Q: How does memory work?
**A: Chorus uses SQLite for persistent storage.** Memories survive restarts. It includes:
- Short-term: Current conversation
- Long-term: Important facts and lessons
- Episodic: Complete execution records
- Semantic: Searchable by meaning

### Q: What's the difference between Chorus and n8n's AI nodes?
**A: n8n's AI nodes are single LLM calls.** Chorus is a full agent system with planning, memory, self-healing, multi-step reasoning, and 50+ tools. It's the difference between a calculator and a computer.

### Q: Can multiple agents work together?
**A: Yes!** Register agents with specialties, and Chorus delegates tasks to the best one. Agents share memory and coordinate results.

### Q: How do I update Chorus?
**A: Just pull from GitHub:**
```bash
cd ~/.chorus
git pull
npm install
npm run build
```

### Q: Where is my data stored?
**A: `~/.chorus/data/` for memory, `~/.chorus/chorus.config.yaml` for config.**

### Q: Can I use it in production?
**A: Yes!** Chorus includes production features:
- Error recovery with retry
- Budget guardrails
- Rate limiting
- Health checks
- Observability
- Self-healing

---

## 📁 Project Structure

```
chorus/
├── src/
│   ├── agent/                  🧠 Agent Engine + Manager
│   │   ├── engine.ts           # Core agent loop (plan→execute→reflect)
│   │   └── manager.ts          # Multi-agent management
│   ├── core/                   ⚙️ Core Systems
│   │   ├── config.ts           # Configuration management
│   │   ├── errors.ts           # Typed error classes
│   │   ├── events.ts           # Event bus
│   │   └── logger.ts           # Structured logging
│   ├── llm/                    🌐 LLM Integration
│   │   ├── provider.ts         # Base LLM provider
│   │   ├── universal-connector.ts # 25 providers
│   │   └── prompts.ts          # Agent prompts
│   ├── memory/                 💾 Memory System
│   │   ├── store.ts            # SQLite storage
│   │   └── manager.ts          # Memory management
│   ├── n8n/                    🔗 n8n Integration
│   │   ├── client.ts           # n8n API client
│   │   ├── workflow-builder.ts # Programmatic workflows
│   │   ├── templates.ts        # 8 workflow templates
│   │   ├── smart-connector.ts  # Smart connections
│   │   ├── superpowers.ts      # 10 superpower features
│   │   └── full-integration.ts # All 19 features
│   ├── tools/                  🔧 Tool System
│   │   ├── registry.ts         # Tool registry
│   │   ├── superpowers.ts      # 30+ superpower tools
│   │   └── browser.ts          # 13 browser tools
│   ├── guardrails/             🛡️ Safety System
│   │   └── index.ts            # Budget, rate limits, domains
│   ├── observability/          📊 Monitoring
│   │   └── index.ts            # Metrics, tracing, health
│   └── cli/                    🎮 CLI Interface
│       ├── index.ts            # CLI commands
│       ├── chat.ts             # Interactive chat
│       └── server.ts           # REST API server
├── tests/                      🧪 Test Suite
│   └── chorus.test.ts          # 45 tests
├── install.sh                  🐧 Linux/macOS installer
├── install.bat                 🪟 Windows installer
├── install.ps1                 🪟 PowerShell installer
├── install-oneline.bat         🪟 One-line Windows install
├── chorus.config.yaml          ⚙️ Default config
├── package.json                📦 NPM package
└── README.md                   📖 This file
```

---

## 📄 License

MIT — use it however you want.

---

## 🙏 Contributing

```bash
git clone https://github.com/Atum246/chorus.git
cd chorus
npm install
npm test
```

---

<p align="center">
  <strong>🎵 Chorus — Your n8n workflows just got superpowers.</strong>
  <br><br>
  <a href="https://github.com/Atum246/chorus">GitHub</a> •
  <a href="https://github.com/Atum246/chorus/issues">Issues</a> •
  <a href="https://github.com/Atum246/chorus/releases">Releases</a>
</p>
