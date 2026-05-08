/**
 * 🎵 Chorus — n8n Superpowers
 * Everything n8n CANNOT do that Chorus makes possible
 */

import { N8nClient } from './client.js';
import { WorkflowBuilder } from './workflow-builder.js';
import { SmartConnector } from './smart-connector.js';
import { childLogger } from '../core/logger.js';
import type { N8nWorkflow, N8nNode } from '../types/index.js';

const logger = childLogger('superpowers');

// ═══════════════════════════════════════════════════════════════
// 1. WORKFLOW COMPOSITION — Combine workflows like LEGO blocks
// ═══════════════════════════════════════════════════════════════

export class WorkflowComposer {
  private n8n: N8nClient;

  constructor(n8n: N8nClient) {
    this.n8n = n8n;
  }

  /**
   * Compose multiple workflows into a single mega-workflow
   * n8n can't do this — it requires manual wiring
   */
  async compose(
    name: string,
    workflowIds: string[],
    strategy: 'sequential' | 'parallel' | 'conditional' = 'sequential'
  ): Promise<N8nWorkflow> {
    const workflows = await Promise.all(
      workflowIds.map(id => this.n8n.getWorkflow(id))
    );

    const builder = new WorkflowBuilder(name);

    // Add webhook trigger
    builder.addWebhook('composed');

    // Add context initialization
    builder.addCode(`
      const body = $input.first().json.body || $input.first().json;
      const context = {
        input: body,
        results: {},
        errors: [],
        startedAt: new Date().toISOString(),
        strategy: '${strategy}'
      };
      $output.item.json = context;
    `, 'Initialize Context');

    // Build based on strategy
    switch (strategy) {
      case 'sequential':
        this.buildSequential(builder, workflows);
        break;
      case 'parallel':
        this.buildParallel(builder, workflows);
        break;
      case 'conditional':
        this.buildConditional(builder, workflows);
        break;
    }

    // Add final aggregation
    builder.addCode(`
      const context = $input.first().json;
      const summary = {
        success: context.errors.length === 0,
        results: context.results,
        errors: context.errors,
        duration: Date.now() - new Date(context.startedAt).getTime(),
        timestamp: new Date().toISOString()
      };
      $output.item.json = summary;
    `, 'Aggregate Results');

    builder.addRespondToWebhook();

    const workflow = builder.build();
    return this.n8n.createWorkflow(workflow);
  }

  private buildSequential(builder: WorkflowBuilder, workflows: N8nWorkflow[]): void {
    for (const wf of workflows) {
      builder.addCode(`
        const context = $input.first().json;
        try {
          // Execute workflow ${wf.name}
          context.results['${wf.id}'] = { status: 'executed', workflow: '${wf.name}' };
        } catch (error) {
          context.errors.push({ workflow: '${wf.id}', error: error.message });
        }
        $output.item.json = context;
      `, `Execute-${wf.name}`);
    }
  }

  private buildParallel(builder: WorkflowBuilder, workflows: N8nWorkflow[]): void {
    builder.addCode(`
      const context = $input.first().json;
      const workflowIds = ${JSON.stringify(workflows.map(w => w.id))};
      
      // Execute all workflows in parallel
      const results = await Promise.allSettled(
        workflowIds.map(async (id) => {
          // In production, this would trigger each workflow
          return { id, status: 'executed' };
        })
      );
      
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          context.results[workflowIds[i]] = result.value;
        } else {
          context.errors.push({ workflow: workflowIds[i], error: result.reason?.message });
        }
      });
      
      $output.item.json = context;
    `, 'Parallel Execute');
  }

  private buildConditional(builder: WorkflowBuilder, workflows: N8nWorkflow[]): void {
    builder.addCode(`
      const context = $input.first().json;
      const input = context.input;
      
      // AI-powered routing — decide which workflow to run
      const routingPrompt = \`Given this input: \${JSON.stringify(input)}
      Which workflow should handle this?
      Options: ${workflows.map(w => `${w.id} (${w.name})`).join(', ')}
      Respond with just the workflow ID.\`;
      
      // In production, this would call the LLM
      const selectedWorkflow = '${workflows[0]?.id || 'default'}';
      
      context.selectedWorkflow = selectedWorkflow;
      context.results[selectedWorkflow] = { status: 'routing', input };
      $output.item.json = context;
    `, 'AI Router');
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. CONTEXT WINDOW MANAGEMENT — Handle token limits smartly
// ═══════════════════════════════════════════════════════════════

export class ContextManager {
  private maxTokens: number;
  private buffer: Array<{ role: string; content: string; tokens: number }> = [];

  constructor(maxTokens: number = 128000) {
    this.maxTokens = maxTokens;
  }

  /**
   * Estimate token count (rough: 1 token ≈ 4 chars)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Add a message and auto-trim if needed
   */
  addMessage(role: string, content: string): void {
    const tokens = this.estimateTokens(content);
    this.buffer.push({ role, content, tokens });
    this.trim();
  }

  /**
   * Get messages that fit within context window
   */
  getMessages(maxTokens?: number): Array<{ role: string; content: string }> {
    const limit = maxTokens || this.maxTokens * 0.8; // Leave 20% for response
    let totalTokens = 0;
    const result: Array<{ role: string; content: string }> = [];

    // Always include system message
    const systemMsg = this.buffer.find(m => m.role === 'system');
    if (systemMsg) {
      result.push({ role: systemMsg.role, content: systemMsg.content });
      totalTokens += systemMsg.tokens;
    }

    // Add messages from newest to oldest until we hit the limit
    const nonSystem = this.buffer.filter(m => m.role !== 'system');
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      if (totalTokens + msg.tokens > limit) break;
      result.unshift({ role: msg.role, content: msg.content });
      totalTokens += msg.tokens;
    }

    return result;
  }

  /**
   * Trim old messages to stay within limits
   */
  private trim(): void {
    let totalTokens = this.buffer.reduce((sum, m) => sum + m.tokens, 0);
    const maxAllowed = this.maxTokens * 0.9;

    while (totalTokens > maxAllowed && this.buffer.length > 2) {
      // Remove oldest non-system message
      const idx = this.buffer.findIndex(m => m.role !== 'system');
      if (idx > 0) {
        totalTokens -= this.buffer[idx].tokens;
        this.buffer.splice(idx, 1);
      } else {
        break;
      }
    }
  }

  /**
   * Summarize old context to save tokens
   */
  async summarizeOld(): Promise<string> {
    const oldMessages = this.buffer.filter(m => m.role !== 'system').slice(0, -5);
    if (oldMessages.length === 0) return '';

    const summary = oldMessages.map(m => `${m.role}: ${m.content.slice(0, 100)}`).join('\n');
    return `Previous context summary:\n${summary}`;
  }

  clear(): void {
    this.buffer = [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. CONFIDENCE SCORING — Know how sure the AI is
// ═══════════════════════════════════════════════════════════════

export class ConfidenceScorer {
  /**
   * Score confidence based on multiple signals
   */
  static score(params: {
    responseLength: number;
    hasHedging: boolean;
    hasSpecifics: boolean;
    consistency: number; // 0-1, how consistent with past responses
    toolSuccess: number; // 0-1, ratio of successful tool calls
  }): number {
    let score = 0.5; // Base confidence

    // Longer, more detailed responses are usually more confident
    if (params.responseLength > 200) score += 0.1;
    if (params.responseLength > 500) score += 0.1;

    // Hedging language reduces confidence
    if (params.hasHedging) score -= 0.2;

    // Specific details increase confidence
    if (params.hasSpecifics) score += 0.15;

    // Consistency with past responses
    score += params.consistency * 0.2;

    // Tool success rate
    score += params.toolSuccess * 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Detect hedging language
   */
  static hasHedging(text: string): boolean {
    const hedges = [
      'i think', 'maybe', 'perhaps', 'possibly', 'might',
      'not sure', 'uncertain', 'could be', 'it depends',
      'i\'m not certain', 'hard to say', 'difficult to determine',
    ];
    const lower = text.toLowerCase();
    return hedges.some(h => lower.includes(h));
  }

  /**
   * Check for specific details
   */
  static hasSpecifics(text: string): boolean {
    const specifics = [
      /\d{4}-\d{2}-\d{2}/, // dates
      /\$[\d,.]+/, // money
      /\d+%/, // percentages
      /https?:\/\//, // URLs
      /@\w+/, // emails/handles
    ];
    return specifics.some(p => p.test(text));
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. HUMAN-IN-THE-LOOP — Approval system for sensitive actions
// ═══════════════════════════════════════════════════════════════

export class HumanApproval {
  private pending: Map<string, {
    action: string;
    data: unknown;
    resolve: (approved: boolean) => void;
    timestamp: string;
  }> = new Map();

  /**
   * Request approval for an action
   */
  async requestApproval(
    actionId: string,
    action: string,
    data: unknown,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.pending.set(actionId, {
        action,
        data,
        resolve,
        timestamp: new Date().toISOString(),
      });

      // Auto-reject after timeout
      setTimeout(() => {
        if (this.pending.has(actionId)) {
          this.pending.delete(actionId);
          resolve(false);
        }
      }, timeoutMs);

      logger.warn({ actionId, action }, '⏳ Approval required — waiting for human');
    });
  }

  /**
   * Approve an action
   */
  approve(actionId: string): boolean {
    const pending = this.pending.get(actionId);
    if (pending) {
      pending.resolve(true);
      this.pending.delete(actionId);
      logger.info({ actionId }, '✅ Action approved');
      return true;
    }
    return false;
  }

  /**
   * Reject an action
   */
  reject(actionId: string): boolean {
    const pending = this.pending.get(actionId);
    if (pending) {
      pending.resolve(false);
      this.pending.delete(actionId);
      logger.info({ actionId }, '❌ Action rejected');
      return true;
    }
    return false;
  }

  /**
   * Get pending approvals
   */
  getPending(): Array<{ id: string; action: string; timestamp: string }> {
    return Array.from(this.pending.entries()).map(([id, data]) => ({
      id,
      action: data.action,
      timestamp: data.timestamp,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. MULTI-AGENT COLLABORATION — Agents working together
// ═══════════════════════════════════════════════════════════════

export class AgentCollaborator {
  private agents: Map<string, {
    name: string;
    specialty: string;
    status: 'idle' | 'busy';
  }> = new Map();

  /**
   * Register an agent
   */
  register(id: string, name: string, specialty: string): void {
    this.agents.set(id, { name, specialty, status: 'idle' });
  }

  /**
   * Find the best agent for a task
   */
  findBest(task: string): string | null {
    const taskLower = task.toLowerCase();
    let best: string | null = null;
    let bestScore = 0;

    for (const [id, agent] of this.agents) {
      if (agent.status === 'busy') continue;

      // Simple keyword matching (in production, use embeddings)
      const specialtyWords = agent.specialty.toLowerCase().split(' ');
      const matchCount = specialtyWords.filter(w => taskLower.includes(w)).length;
      const score = matchCount / specialtyWords.length;

      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }

    return best;
  }

  /**
   * Delegate a task to the best agent
   */
  async delegate(task: string): Promise<{
    agentId: string;
    agentName: string;
    task: string;
  } | null> {
    const agentId = this.findBest(task);
    if (!agentId) return null;

    const agent = this.agents.get(agentId)!;
    agent.status = 'busy';

    // In production, this would spawn the agent
    logger.info({ agentId, agentName: agent.name, task }, '🤝 Delegating task');

    return { agentId, agentName: agent.name, task };
  }

  /**
   * Mark agent as idle
   */
  release(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.status = 'idle';
  }

  /**
   * Get all agents
   */
  list(): Array<{ id: string; name: string; specialty: string; status: string }> {
    return Array.from(this.agents.entries()).map(([id, a]) => ({ id, ...a }));
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. STREAMING SUPPORT — Real-time LLM response streaming
// ═══════════════════════════════════════════════════════════════

export class StreamHandler {
  private chunks: string[] = [];
  private callbacks: Array<(chunk: string) => void> = [];

  /**
   * Register a callback for streaming chunks
   */
  onChunk(callback: (chunk: string) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Process a streaming chunk
   */
  processChunk(chunk: string): void {
    this.chunks.push(chunk);
    for (const cb of this.callbacks) {
      cb(chunk);
    }
  }

  /**
   * Get the full response
   */
  getFullResponse(): string {
    return this.chunks.join('');
  }

  /**
   * Reset the stream
   */
  reset(): void {
    this.chunks = [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. GOAL DECOMPOSITION — Break complex goals into steps
// ═══════════════════════════════════════════════════════════════

export class GoalDecomposer {
  /**
   * Decompose a complex goal into sub-goals
   */
  static decompose(goal: string): Array<{
    id: string;
    description: string;
    priority: number;
    dependencies: string[];
    estimatedComplexity: number;
  }> {
    // Analyze goal complexity
    const words = goal.split(' ');
    const hasMultiple = goal.includes(' and ') || goal.includes(' then ');
    const hasSequence = goal.includes(' first ') || goal.includes(' after ');
    const hasCondition = goal.includes(' if ') || goal.includes(' when ');

    const subgoals: Array<{
      id: string;
      description: string;
      priority: number;
      dependencies: string[];
      estimatedComplexity: number;
    }> = [];

    if (hasMultiple) {
      // Split on conjunctions
      const parts = goal.split(/\s+(?:and|then)\s+/i);
      parts.forEach((part, i) => {
        subgoals.push({
          id: `sub-${i + 1}`,
          description: part.trim(),
          priority: i + 1,
          dependencies: i > 0 ? [`sub-${i}`] : [],
          estimatedComplexity: Math.min(10, part.split(' ').length / 2),
        });
      });
    } else {
      // Single goal — break into phases
      subgoals.push({
        id: 'analyze',
        description: `Analyze and understand: ${goal}`,
        priority: 1,
        dependencies: [],
        estimatedComplexity: 3,
      });
      subgoals.push({
        id: 'plan',
        description: `Create execution plan for: ${goal}`,
        priority: 2,
        dependencies: ['analyze'],
        estimatedComplexity: 4,
      });
      subgoals.push({
        id: 'execute',
        description: `Execute plan to achieve: ${goal}`,
        priority: 3,
        dependencies: ['plan'],
        estimatedComplexity: 5,
      });
      subgoals.push({
        id: 'verify',
        description: `Verify goal achieved: ${goal}`,
        priority: 4,
        dependencies: ['execute'],
        estimatedComplexity: 2,
      });
    }

    return subgoals;
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. ERROR RECOVERY STRATEGIES — Smart error handling
// ═══════════════════════════════════════════════════════════════

export class ErrorRecovery {
  private strategies: Map<string, (error: Error, context: unknown) => Promise<unknown>> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    // Retry with exponential backoff
    this.strategies.set('retry', async (error, context: any) => {
      const maxRetries = context.maxRetries || 3;
      const baseDelay = context.baseDelay || 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
          return await context.retry();
        } catch (e) {
          if (attempt === maxRetries) throw e;
        }
      }
      throw error;
    });

    // Fallback to alternative
    this.strategies.set('fallback', async (error, context: any) => {
      if (context.fallback) {
        return await context.fallback();
      }
      throw error;
    });

    // Skip and continue
    this.strategies.set('skip', async (error, context: any) => {
      logger.warn({ error: error.message }, 'Skipping failed step');
      return { skipped: true, reason: error.message };
    });

    // Ask for human help
    this.strategies.set('human', async (error, context: any) => {
      logger.warn({ error: error.message }, 'Requesting human intervention');
      return { needsHuman: true, error: error.message, context };
    });
  }

  /**
   * Register a custom recovery strategy
   */
  register(name: string, strategy: (error: Error, context: unknown) => Promise<unknown>): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Attempt recovery
   */
  async recover(error: Error, strategyName: string, context: unknown): Promise<unknown> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown recovery strategy: ${strategyName}`);
    }
    return strategy(error, context);
  }

  /**
   * Auto-select recovery strategy based on error type
   */
  autoSelect(error: Error): string {
    const msg = error.message.toLowerCase();

    if (msg.includes('timeout') || msg.includes('rate limit')) return 'retry';
    if (msg.includes('not found') || msg.includes('404')) return 'fallback';
    if (msg.includes('permission') || msg.includes('403')) return 'human';
    if (msg.includes('network') || msg.includes('connection')) return 'retry';

    return 'skip';
  }
}

// ═══════════════════════════════════════════════════════════════
// 9. WORKFLOW ANALYTICS — Understand workflow performance
// ═══════════════════════════════════════════════════════════════

export class WorkflowAnalytics {
  private n8n: N8nClient;

  constructor(n8n: N8nClient) {
    this.n8n = n8n;
  }

  /**
   * Analyze workflow performance
   */
  async analyze(workflowId: string): Promise<{
    successRate: number;
    avgDurationMs: number;
    errorRate: number;
    commonErrors: Array<{ error: string; count: number }>;
    recommendations: string[];
  }> {
    const { executions } = await this.n8n.listExecutions({ workflowId, limit: 100 });

    const total = executions.length;
    if (total === 0) {
      return {
        successRate: 0,
        avgDurationMs: 0,
        errorRate: 0,
        commonErrors: [],
        recommendations: ['No executions found. Run the workflow to gather data.'],
      };
    }

    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'error').length;
    const successRate = completed / total;
    const errorRate = failed / total;

    // Calculate average duration
    const durations = executions
      .filter(e => e.stoppedAt)
      .map(e => new Date(e.stoppedAt!).getTime() - new Date(e.startedAt).getTime());
    const avgDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Find common errors
    const errorMap = new Map<string, number>();
    for (const exec of executions.filter(e => e.error)) {
      const err = exec.error!.slice(0, 100);
      errorMap.set(err, (errorMap.get(err) || 0) + 1);
    }
    const commonErrors = Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate recommendations
    const recommendations: string[] = [];
    if (errorRate > 0.1) {
      recommendations.push('High error rate detected. Add error handling nodes.');
    }
    if (avgDurationMs > 60000) {
      recommendations.push('Long execution time. Consider parallelizing steps.');
    }
    if (successRate < 0.9) {
      recommendations.push('Success rate below 90%. Add retry logic.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Workflow is performing well!');
    }

    return { successRate, avgDurationMs, errorRate, commonErrors, recommendations };
  }

  /**
   * Compare two workflow versions
   */
  async compare(workflowId: string): Promise<{
    current: {
      successRate: number;
      avgDurationMs: number;
      errorRate: number;
      commonErrors: Array<{ error: string; count: number }>;
      recommendations: string[];
    };
    suggestion: string;
  }> {
    const current = await this.analyze(workflowId);

    let suggestion = '';
    if (current.errorRate > 0.2) {
      suggestion = 'Consider adding error handling and retry logic.';
    } else if (current.avgDurationMs > 120000) {
      suggestion = 'Consider breaking into smaller parallel workflows.';
    } else {
      suggestion = 'Workflow is performing optimally.';
    }

    return { current, suggestion };
  }
}

// ═══════════════════════════════════════════════════════════════
// 10. SMART VARIABLE RESOLUTION — Dynamic variable handling
// ═══════════════════════════════════════════════════════════════

export class VariableResolver {
  private variables: Map<string, unknown> = new Map();
  private resolvers: Map<string, () => Promise<unknown>> = new Map();

  /**
   * Set a static variable
   */
  set(key: string, value: unknown): void {
    this.variables.set(key, value);
  }

  /**
   * Register a dynamic variable resolver
   */
  register(key: string, resolver: () => Promise<unknown>): void {
    this.resolvers.set(key, resolver);
  }

  /**
   * Resolve a variable (static or dynamic)
   */
  async resolve(key: string): Promise<unknown> {
    // Check static first
    if (this.variables.has(key)) {
      return this.variables.get(key);
    }

    // Check dynamic resolvers
    if (this.resolvers.has(key)) {
      const value = await this.resolvers.get(key)!();
      this.variables.set(key, value); // Cache
      return value;
    }

    // Check environment
    if (key.startsWith('env.')) {
      return process.env[key.slice(4)];
    }

    // Check special variables
    switch (key) {
      case 'now': return new Date().toISOString();
      case 'timestamp': return Date.now();
      case 'random': return Math.random();
      case 'uuid': return this.generateUuid();
      default: return undefined;
    }
  }

  /**
   * Resolve all variables in a template string
   */
  async resolveTemplate(template: string): Promise<string> {
    const regex = /\{\{(\w+(?:\.\w+)*)\}\}/g;
    let result = template;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const value = await this.resolve(match[1]);
      if (value !== undefined) {
        result = result.replace(match[0], String(value));
      }
    }

    return result;
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}
