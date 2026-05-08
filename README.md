# 🎵 Chorus

**AI Agent Brain for n8n — Turn workflows into autonomous agents**

Chorus connects to your n8n instance and supercharges it with AI agent capabilities: autonomous planning, multi-step reasoning, persistent memory, self-healing execution, and more.

## ✨ Features

- 🧠 **Autonomous Planning** — Agents create multi-step plans to achieve goals
- 🔗 **n8n Integration** — Full API access to trigger, monitor, and create workflows
- 💾 **Multi-Layer Memory** — Short-term, long-term, episodic, and semantic memory
- 🔄 **Self-Healing** — Automatic error recovery and plan adaptation
- 🛡️ **Guardrails** — Budget limits, rate limiting, domain blocking, approval gates
- 📊 **Observability** — Metrics, tracing, health checks, and event logging
- 🎯 **Reflection** — Agents reflect on progress and adjust strategies
- 🌐 **Multi-Provider LLM** — OpenAI, Anthropic, Ollama, Groq, Together, and more
- 🔧 **Extensible Tools** — Built-in tools + custom tool registration
- 📋 **CLI Interface** — Beautiful command-line interface

## 🚀 Quick Start

```bash
# Install
npm install

# Initialize configuration
npx chorus init

# Run an agent
npx chorus run "Analyze all my workflows and suggest optimizations"

# Check health
npx chorus health
```

## 📖 Usage

### CLI Commands

```bash
# Initialize Chorus
chorus init

# Run an agent with a goal
chorus run "your goal here"
chorus run "your goal here" --name "My Agent" --persona "You are a data analyst"

# Manage agents
chorus agent list
chorus agent create

# Manage workflows
chorus workflow list
chorus workflow test
chorus workflow analyze <workflowId>

# Memory operations
chorus memory stats
chorus memory search "customer data"

# System
chorus health
chorus events
```

### Programmatic API

```typescript
import { AgentManager, loadConfig } from 'chorus';

const config = loadConfig();
const manager = new AgentManager(config);
await manager.initialize();

// Create an agent
const agent = await manager.createAgent('Data Agent', {
  persona: 'You are a data processing expert',
  goals: ['Process and analyze data efficiently'],
});

// Run with a goal
const result = await manager.run(agent.id, 'Fetch customer data and generate report');

console.log(result.summary);
console.log(`Cost: $${result.totalCost.toFixed(4)}`);
```

## ⚙️ Configuration

Chorus is configured via `chorus.config.yaml`:

```yaml
n8n:
  baseUrl: "http://localhost:5678"
  apiKey: "your-n8n-api-key"

llm:
  provider: "openai"  # openai | anthropic | ollama | groq | together | custom
  apiKey: "your-api-key"
  model: "gpt-4o-mini"

memory:
  backend: "sqlite"   # sqlite | in-memory
  sqlitePath: "./data/chorus-memory.db"

guardrails:
  maxBudgetPerRun: 10
  maxExecutionTimeMs: 300000
```

### Environment Variables

```
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-key
LLM_PROVIDER=openai
LLM_API_KEY=your-key
LLM_MODEL=gpt-4o-mini
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLI / API                         │
├─────────────────────────────────────────────────────┤
│                 Agent Manager                        │
├──────────┬──────────┬──────────┬───────────────────┤
│  Agent   │  Agent   │  Agent   │    ...            │
│  Engine  │  Engine  │  Engine  │                   │
├──────────┴──────────┴──────────┴───────────────────┤
│    LLM Provider  │  Memory Store  │  Tool Registry  │
├─────────────────────────────────────────────────────┤
│              n8n Client  │  Guardrails              │
├─────────────────────────────────────────────────────┤
│                  Observability                       │
└─────────────────────────────────────────────────────┘
```

## 📄 License

MIT
