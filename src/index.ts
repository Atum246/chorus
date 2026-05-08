/**
 * 🎵 Chorus — Main Entry Point
 * Export all public APIs
 */

// Core
export { loadConfig, getConfig, updateConfig, saveConfig } from './core/config.js';
export { initLogger, getLogger, childLogger } from './core/logger.js';
export { eventBus, ChorusEventBus } from './core/events.js';
export * from './core/errors.js';

// n8n
export { N8nClient, WorkflowBuilder, Patterns } from './n8n/index.js';

// LLM
export { LLMProvider, Prompts } from './llm/index.js';

// Memory
export { MemoryStore } from './memory/index.js';

// Tools
export { ToolRegistry } from './tools/index.js';

// Agent
export { AgentEngine, AgentManager } from './agent/index.js';

// Guardrails
export { GuardrailsManager, BudgetTracker, RateLimiter, DomainGuard } from './guardrails/index.js';

// Observability
export { MetricsCollector, TraceCollector, HealthChecker, ObservabilityManager } from './observability/index.js';

// Types
export * from './types/index.js';
