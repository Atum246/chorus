/**
 * 🎵 Chorus — Error Types
 * Typed errors for better handling
 */

export class ChorusError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly recoverable: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ChorusError';
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.context = context;
  }
}

export class N8nConnectionError extends ChorusError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'N8N_CONNECTION', 'high', true, context);
    this.name = 'N8nConnectionError';
  }
}

export class N8nWorkflowError extends ChorusError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'N8N_WORKFLOW', 'medium', true, context);
    this.name = 'N8nWorkflowError';
  }
}

export class LLMError extends ChorusError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_ERROR', 'medium', true, context);
    this.name = 'LLMError';
  }
}

export class LLMRateLimitError extends ChorusError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number = 60000) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`, 'LLM_RATE_LIMIT', 'medium', true, { retryAfterMs });
    this.name = 'LLMRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class BudgetExceededError extends ChorusError {
  public readonly budget: number;
  public readonly attempted: number;

  constructor(budget: number, attempted: number) {
    super(
      `Budget exceeded: $${attempted.toFixed(4)} > $${budget.toFixed(4)}`,
      'BUDGET_EXCEEDED',
      'critical',
      false,
      { budget, attempted }
    );
    this.name = 'BudgetExceededError';
    this.budget = budget;
    this.attempted = attempted;
  }
}

export class GuardrailViolationError extends ChorusError {
  public readonly rule: string;

  constructor(rule: string, message: string) {
    super(`Guardrail violation [${rule}]: ${message}`, 'GUARDRAIL_VIOLATION', 'high', false, { rule });
    this.name = 'GuardrailViolationError';
    this.rule = rule;
  }
}

export class MaxStepsExceededError extends ChorusError {
  constructor(maxSteps: number) {
    super(`Maximum steps exceeded: ${maxSteps}`, 'MAX_STEPS', 'medium', false, { maxSteps });
    this.name = 'MaxStepsExceededError';
  }
}

export class AgentTimeoutError extends ChorusError {
  constructor(timeoutMs: number) {
    super(`Agent execution timed out after ${timeoutMs}ms`, 'AGENT_TIMEOUT', 'high', false, { timeoutMs });
    this.name = 'AgentTimeoutError';
  }
}

export class MemoryError extends ChorusError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MEMORY_ERROR', 'low', true, context);
    this.name = 'MemoryError';
  }
}

export class ToolError extends ChorusError {
  public readonly toolName: string;

  constructor(toolName: string, message: string, context?: Record<string, unknown>) {
    super(`Tool [${toolName}]: ${message}`, 'TOOL_ERROR', 'medium', true, { toolName, ...context });
    this.name = 'ToolError';
    this.toolName = toolName;
  }
}
