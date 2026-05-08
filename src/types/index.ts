/**
 * 🎵 Chorus — Core Type Definitions
 * The language of the agent system
 */

// ═══════════════════════════════════════════════════════════════
// Configuration Types
// ═══════════════════════════════════════════════════════════════

export interface ChorusConfig {
  n8n: N8nConfig;
  llm: LLMConfig;
  memory: MemoryConfig;
  guardrails: GuardrailsConfig;
  observability: ObservabilityConfig;
  agent: AgentDefaults;
}

export interface N8nConfig {
  baseUrl: string;
  apiKey: string;
  webhookBaseUrl?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'groq' | 'together' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  timeout: number;
  maxRetries: number;
  streaming: boolean;
}

export type MemoryBackend = 'sqlite' | 'redis' | 'in-memory';

export interface MemoryConfig {
  backend: MemoryBackend;
  sqlitePath?: string;
  redisUrl?: string;
  maxShortTermMessages: number;
  maxLongTermEntries: number;
  embeddingModel?: string;
  vectorDimensions?: number;
  ttlSeconds: number;
}

export interface GuardrailsConfig {
  maxExecutionTimeMs: number;
  maxBudgetPerRun: number;
  maxConcurrentRuns: number;
  allowedDomains: string[];
  blockedDomains: string[];
  maxTokensPerTurn: number;
  requireApproval: string[];
  rateLimits: RateLimitConfig;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxWorkflowRunsPerHour: number;
}

export interface ObservabilityConfig {
  logLevel: LogLevel;
  logFormat: 'json' | 'pretty';
  enableTracing: boolean;
  enableMetrics: boolean;
  metricsPort: number;
  webhookNotifications?: WebhookConfig;
}

export interface WebhookConfig {
  url: string;
  events: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface AgentDefaults {
  maxSteps: number;
  maxReflections: number;
  planningStrategy: 'react' | 'plan-and-execute' | 'tree-of-thought';
  enableMemory: boolean;
  enableReflection: boolean;
  enableSelfHealing: boolean;
  defaultPersona?: string;
}

// ═══════════════════════════════════════════════════════════════
// Agent Types
// ═══════════════════════════════════════════════════════════════

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  persona?: string;
  goals: string[];
  tools: string[];
  workflows: WorkflowBinding[];
  memory: AgentMemoryConfig;
  guardrails?: Partial<GuardrailsConfig>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowBinding {
  workflowId: string;
  workflowName: string;
  triggerType: 'manual' | 'webhook' | 'schedule';
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
}

export interface AgentMemoryConfig {
  useShortTerm: boolean;
  useLongTerm: boolean;
  useEpisodic: boolean;
  namespace: string;
}

export interface AgentState {
  agentId: string;
  status: 'idle' | 'planning' | 'executing' | 'reflecting' | 'paused' | 'error';
  currentGoal?: string;
  currentPlan?: Plan;
  stepCount: number;
  totalTokensUsed: number;
  totalCost: number;
  startedAt?: string;
  lastActivityAt: string;
  errors: AgentError[];
}

export interface AgentError {
  step: number;
  error: string;
  timestamp: string;
  recovered: boolean;
  recoveryAction?: string;
}

// ═══════════════════════════════════════════════════════════════
// Planning Types
// ═══════════════════════════════════════════════════════════════

export interface Plan {
  id: string;
  goal: string;
  strategy: string;
  steps: PlanStep[];
  estimatedCost: number;
  estimatedTime: number;
  confidence: number;
  createdAt: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'replanning';
}

export interface PlanStep {
  id: string;
  order: number;
  action: string;
  tool?: string;
  workflowId?: string;
  inputs: Record<string, unknown>;
  expectedOutput: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: StepResult;
  reflections?: Reflection[];
}

export interface StepResult {
  success: boolean;
  output: unknown;
  tokensUsed: number;
  cost: number;
  durationMs: number;
  error?: string;
}

export interface Reflection {
  id: string;
  stepId: string;
  type: 'success' | 'failure' | 'insight' | 'adjustment';
  content: string;
  suggestedAction?: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// Memory Types
// ═══════════════════════════════════════════════════════════════

export interface MemoryEntry {
  id: string;
  namespace: string;
  type: 'short-term' | 'long-term' | 'episodic' | 'semantic';
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  importance: number;
  accessCount: number;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  timestamp: string;
  tokensUsed?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface Episode {
  id: string;
  agentId: string;
  goal: string;
  plan: Plan;
  outcome: 'success' | 'failure' | 'partial';
  lessonsLearned: string[];
  totalTokens: number;
  totalCost: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Tool Types
// ═══════════════════════════════════════════════════════════════

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  requiredPermissions?: string[];
  costEstimate?: number;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: unknown[];
}

export interface ToolExecutionContext {
  agentId: string;
  stepId: string;
  runId: string;
  budgetRemaining: number;
  timeoutMs: number;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
  tokensUsed: number;
  cost: number;
  durationMs: number;
  sideEffects?: string[];
}

// ═══════════════════════════════════════════════════════════════
// n8n Integration Types
// ═══════════════════════════════════════════════════════════════

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: N8nConnections;
  settings?: N8nWorkflowSettings;
  staticData?: unknown;
  tags?: N8nTag[];
  createdAt: string;
  updatedAt: string;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

export interface N8nConnections {
  [sourceNodeName: string]: {
    [outputType: string]: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

export interface N8nWorkflowSettings {
  saveExecutionProgress?: boolean;
  callerPolicy?: string;
  errorWorkflow?: string;
  timezone?: string;
}

export interface N8nTag {
  id: string;
  name: string;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'error' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
  data?: unknown;
  error?: string;
}

export interface N8nWebhookResponse {
  executionId: string;
  data: unknown;
}

// ═══════════════════════════════════════════════════════════════
// Event Types
// ═══════════════════════════════════════════════════════════════

export type ChorusEventType =
  | 'agent:created'
  | 'agent:started'
  | 'agent:paused'
  | 'agent:resumed'
  | 'agent:completed'
  | 'agent:error'
  | 'plan:created'
  | 'plan:updated'
  | 'plan:completed'
  | 'plan:failed'
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'memory:stored'
  | 'memory:recalled'
  | 'memory:forgotten'
  | 'workflow:triggered'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'guardrail:triggered'
  | 'reflection:created'
  | 'budget:warning'
  | 'budget:exceeded';

export interface ChorusEvent {
  type: ChorusEventType;
  agentId: string;
  timestamp: string;
  data: Record<string, unknown>;
  severity: 'info' | 'warn' | 'error' | 'critical';
}

// ═══════════════════════════════════════════════════════════════
// LLM Types
// ═══════════════════════════════════════════════════════════════

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: LLMToolCall[];
  usage: LLMUsage;
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface LLMStreamChunk {
  content?: string;
  toolCalls?: Partial<LLMToolCall>[];
  usage?: Partial<LLMUsage>;
  done: boolean;
}
