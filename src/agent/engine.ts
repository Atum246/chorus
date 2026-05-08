/**
 * 🎵 Chorus — Agent Engine
 * The brain: plans, executes, reflects, and self-heals
 */

import { nanoid } from 'nanoid';
import { childLogger } from '../core/logger.js';
import { eventBus } from '../core/events.js';
import {
  MaxStepsExceededError,
  AgentTimeoutError,
  BudgetExceededError,
  ChorusError,
} from '../core/errors.js';
import { LLMProvider, Prompts } from '../llm/index.js';
import { MemoryStore } from '../memory/index.js';
import { ToolRegistry } from '../tools/index.js';
import { GuardrailsManager } from '../guardrails/index.js';
import { N8nClient } from '../n8n/index.js';
import type {
  AgentDefinition,
  AgentState,
  Plan,
  PlanStep,
  StepResult,
  Reflection,
  ConversationMessage,
  Episode,
  LLMMessage,
  LLMTool,
  ToolExecutionContext,
} from '../types/index.js';

const logger = childLogger('agent-engine');

// ═══════════════════════════════════════════════════════════════
// Agent Engine
// ═══════════════════════════════════════════════════════════════

export class AgentEngine {
  private definition: AgentDefinition;
  private state: AgentState;
  private llm: LLMProvider;
  private memory: MemoryStore;
  private tools: ToolRegistry;
  private guardrails: GuardrailsManager;
  private n8nClient?: N8nClient;
  private sessionId: string;

  constructor(
    definition: AgentDefinition,
    llm: LLMProvider,
    memory: MemoryStore,
    tools: ToolRegistry,
    guardrailsConfig: ConstructorParameters<typeof GuardrailsManager>[1],
    n8nClient?: N8nClient
  ) {
    this.definition = definition;
    this.llm = llm;
    this.memory = memory;
    this.tools = tools;
    this.n8nClient = n8nClient;
    this.sessionId = `session-${nanoid(8)}`;

    this.guardrails = new GuardrailsManager(definition.id, guardrailsConfig);

    this.state = {
      agentId: definition.id,
      status: 'idle',
      stepCount: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      lastActivityAt: new Date().toISOString(),
      errors: [],
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Main Execution Loop
  // ═══════════════════════════════════════════════════════════

  /**
   * Process a goal — the main agent loop
   */
  async processGoal(goal: string): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info({ agentId: this.definition.id, goal }, '🎯 Processing goal');

    // Emit start event
    eventBus.emitChorus({
      type: 'agent:started',
      agentId: this.definition.id,
      timestamp: new Date().toISOString(),
      data: { goal },
      severity: 'info',
    });

    this.state.status = 'planning';
    this.state.currentGoal = goal;

    try {
      // Step 1: Build context from memory
      const context = await this.buildContext(goal);

      // Step 2: Generate plan
      const plan = await this.generatePlan(goal, context);
      this.state.currentPlan = plan;

      eventBus.emitChorus({
        type: 'plan:created',
        agentId: this.definition.id,
        timestamp: new Date().toISOString(),
        data: { planId: plan.id, steps: plan.steps.length, strategy: plan.strategy },
        severity: 'info',
      });

      // Step 3: Execute plan
      this.state.status = 'executing';
      const result = await this.executePlan(plan);

      // Step 4: Store episode in memory
      const episode: Episode = {
        id: `episode-${nanoid(8)}`,
        agentId: this.definition.id,
        goal,
        plan,
        outcome: result.success ? 'success' : 'failure',
        lessonsLearned: result.lessons,
        totalTokens: this.state.totalTokensUsed,
        totalCost: this.state.totalCost,
        durationMs: Date.now() - startTime,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
      };

      await this.memory.storeEpisode(episode);

      // Store important lessons as long-term memory
      for (const lesson of result.lessons) {
        await this.memory.store({
          namespace: this.definition.memory.namespace,
          type: 'long-term',
          content: lesson,
          importance: 0.7,
          metadata: { goal, episodeId: episode.id },
          createdAt: new Date().toISOString(),
        });
      }

      // Emit completion
      eventBus.emitChorus({
        type: result.success ? 'agent:completed' : 'agent:error',
        agentId: this.definition.id,
        timestamp: new Date().toISOString(),
        data: { goal, success: result.success, durationMs: Date.now() - startTime },
        severity: result.success ? 'info' : 'error',
      });

      this.state.status = 'idle';
      this.state.currentGoal = undefined;
      this.state.currentPlan = undefined;

      return result;
    } catch (error) {
      this.state.status = 'error';
      this.state.errors.push({
        step: this.state.stepCount,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        recovered: false,
      });

      eventBus.emitChorus({
        type: 'agent:error',
        agentId: this.definition.id,
        timestamp: new Date().toISOString(),
        data: { goal, error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'error',
      });

      return {
        success: false,
        goal,
        summary: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        steps: [],
        lessons: [`Failed to achieve goal: ${error instanceof Error ? error.message : 'Unknown error'}`],
        totalTokens: this.state.totalTokensUsed,
        totalCost: this.state.totalCost,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Planning
  // ═══════════════════════════════════════════════════════════

  private async generatePlan(goal: string, context: string): Promise<Plan> {
    logger.info('📝 Generating plan');

    const availableTools = this.tools.getNames();
    const availableWorkflows = await this.getAvailableWorkflows();

    // Get relevant memories
    const memories = await this.memory.recall(this.definition.memory.namespace, 'long-term', { limit: 5 });
    const lessons = await this.memory.getLessons(this.definition.id, 3);

    const prompt = Prompts.planGeneration(
      goal,
      availableTools,
      availableWorkflows,
      memories,
      lessons.length > 0 ? `Previous lessons:\n${lessons.join('\n')}` : undefined
    );

    const messages: LLMMessage[] = [
      { role: 'system', content: Prompts.systemPersona(this.definition) },
      { role: 'user', content: prompt },
    ];

    const response = await this.llm.complete(messages);
    this.recordUsage(response.usage);

    // Parse plan from response
    let planData: {
      strategy: string;
      steps: Array<{
        order: number;
        action: string;
        tool?: string;
        workflowId?: string;
        inputs: Record<string, unknown>;
        expectedOutput: string;
        dependencies: string[];
      }>;
      confidence: number;
      estimatedCost: number;
      estimatedTime: number;
    };

    try {
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      planData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // Fallback: single-step plan
      planData = {
        strategy: 'Direct execution',
        steps: [{
          order: 1,
          action: goal,
          tool: undefined,
          inputs: {},
          expectedOutput: 'Goal achieved',
          dependencies: [],
        }],
        confidence: 0.5,
        estimatedCost: 0.01,
        estimatedTime: 30,
      };
    }

    const plan: Plan = {
      id: `plan-${nanoid(8)}`,
      goal,
      strategy: planData.strategy,
      steps: planData.steps.map(s => ({
        id: `step-${nanoid(8)}`,
        order: s.order,
        action: s.action,
        tool: s.tool || undefined,
        workflowId: s.workflowId || undefined,
        inputs: s.inputs,
        expectedOutput: s.expectedOutput,
        dependencies: s.dependencies || [],
        status: 'pending' as const,
      })),
      estimatedCost: planData.estimatedCost,
      estimatedTime: planData.estimatedTime,
      confidence: planData.confidence,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    logger.info({
      planId: plan.id,
      steps: plan.steps.length,
      strategy: plan.strategy,
      confidence: plan.confidence,
    }, 'Plan generated');

    return plan;
  }

  // ═══════════════════════════════════════════════════════════
  // Execution
  // ═══════════════════════════════════════════════════════════

  private async executePlan(plan: Plan): Promise<AgentResult> {
    logger.info({ planId: plan.id, steps: plan.steps.length }, '⚡ Executing plan');

    const completedSteps: PlanStep[] = [];
    const lessons: string[] = [];
    let shouldContinue = true;

    for (const step of plan.steps) {
      if (!shouldContinue) break;

      // Check guardrails
      this.guardrails.executionTimer.enforce();

      if (this.state.stepCount >= (this.definition.guardrails?.maxExecutionTimeMs || 25)) {
        throw new MaxStepsExceededError(this.state.stepCount);
      }

      // Wait for dependencies
      const depsCompleted = step.dependencies.every(
        dep => completedSteps.find(s => s.id === dep || s.action === dep)?.status === 'completed'
      );

      if (!depsCompleted) {
        logger.warn({ step: step.order }, 'Dependencies not met, skipping');
        step.status = 'skipped';
        continue;
      }

      // Execute step
      step.status = 'running';
      this.state.stepCount++;

      logger.info({
        step: step.order,
        action: step.action,
        tool: step.tool,
      }, 'Executing step');

      try {
        const result = await this.executeStep(step, completedSteps, plan);
        step.result = result;
        step.status = result.success ? 'completed' : 'failed';

        if (result.success) {
          completedSteps.push(step);

          // Reflect on progress
          if (this.definition.memory.useShortTerm && this.state.stepCount % 3 === 0) {
            this.state.status = 'reflecting';
            const reflection = await this.reflect(plan, completedSteps, step);
            if (reflection) {
              step.reflections = [reflection];
              lessons.push(...(reflection.suggestedAction ? [reflection.suggestedAction] : []));
            }
            this.state.status = 'executing';
          }
        } else {
          // Self-healing on failure
          if (this.definition.guardrails?.maxExecutionTimeMs) {
            this.state.status = 'reflecting';
            const healed = await this.selfHeal(step, completedSteps, plan);
            if (healed) {
              step.status = 'completed';
              completedSteps.push(step);
              lessons.push(`Self-healed: ${result.error}`);
            } else {
              // Try replanning
              const replanned = await this.replan(plan, completedSteps, step, result.error || 'Unknown error');
              if (replanned) {
                shouldContinue = true;
                continue;
              }
              shouldContinue = false;
            }
            this.state.status = 'executing';
          } else {
            shouldContinue = false;
          }
        }
      } catch (error) {
        step.status = 'failed';
        step.result = {
          success: false,
          output: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };

        this.state.errors.push({
          step: this.state.stepCount,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          recovered: false,
        });

        if (error instanceof BudgetExceededError || error instanceof AgentTimeoutError) {
          shouldContinue = false;
        }
      }
    }

    const allCompleted = plan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
    plan.status = allCompleted ? 'completed' : 'failed';

    // Generate summary
    const summary = await this.generateSummary(plan, completedSteps);

    return {
      success: allCompleted,
      goal: plan.goal,
      summary,
      steps: completedSteps,
      lessons,
      totalTokens: this.state.totalTokensUsed,
      totalCost: this.state.totalCost,
      durationMs: 0, // Set by caller
    };
  }

  private async executeStep(
    step: PlanStep,
    previousSteps: PlanStep[],
    plan: Plan
  ): Promise<StepResult> {
    const startTime = Date.now();

    // If step uses a specific tool
    if (step.tool) {
      const context: ToolExecutionContext = {
        agentId: this.definition.id,
        stepId: step.id,
        runId: plan.id,
        budgetRemaining: this.guardrails.budgetTracker.remaining(),
        timeoutMs: this.guardrails.executionTimer.remaining(),
      };

      const toolResult = await this.tools.execute(step.tool, step.inputs, context);

      this.guardrails.budgetTracker.addCost(toolResult.cost);
      this.recordUsage({
        totalTokens: toolResult.tokensUsed,
        estimatedCost: toolResult.cost,
      });

      return {
        success: toolResult.success,
        output: toolResult.output,
        tokensUsed: toolResult.tokensUsed,
        cost: toolResult.cost,
        durationMs: Date.now() - startTime,
        error: toolResult.error,
      };
    }

    // If step uses an n8n workflow
    if (step.workflowId && this.n8nClient) {
      try {
        const execution = await this.n8nClient.executeWorkflow(step.workflowId, step.inputs);
        const result = await this.n8nClient.waitForExecution(execution.id);

        return {
          success: result.status === 'completed',
          output: result.data,
          tokensUsed: 0,
          cost: 0,
          durationMs: Date.now() - startTime,
          error: result.status === 'error' ? result.error : undefined,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: error instanceof Error ? error.message : 'Workflow execution failed',
          tokensUsed: 0,
          cost: 0,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Otherwise, use LLM to execute the step
    const previousResults = previousSteps.map(s => ({
      step: s.action,
      output: s.result?.output,
    }));

    const prompt = Prompts.executeStep(step, previousResults, plan.strategy);

    const messages: LLMMessage[] = [
      { role: 'system', content: Prompts.systemPersona(this.definition) },
      { role: 'user', content: prompt },
    ];

    // Add tools for LLM
    const llmTools = this.buildLLMTools();

    const response = await this.llm.complete(messages, llmTools);
    this.recordUsage(response.usage);

    // Handle tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolResults = await this.handleToolCalls(response.toolCalls, plan.id);
      return {
        success: true,
        output: toolResults,
        tokensUsed: response.usage.totalTokens,
        cost: response.usage.estimatedCost,
        durationMs: Date.now() - startTime,
      };
    }

    // Parse LLM response
    let output: unknown;
    try {
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      output = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      output = response.content;
    }

    return {
      success: true,
      output,
      tokensUsed: response.usage.totalTokens,
      cost: response.usage.estimatedCost,
      durationMs: Date.now() - startTime,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Reflection
  // ═══════════════════════════════════════════════════════════

  private async reflect(
    plan: Plan,
    completedSteps: PlanStep[],
    currentStep: PlanStep
  ): Promise<Reflection | null> {
    logger.info('🤔 Reflecting on progress');

    const prompt = Prompts.reflect(plan.goal, plan, completedSteps, currentStep);

    const messages: LLMMessage[] = [
      { role: 'system', content: Prompts.systemPersona(this.definition) },
      { role: 'user', content: prompt },
    ];

    const response = await this.llm.complete(messages);
    this.recordUsage(response.usage);

    try {
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const data = JSON.parse(jsonMatch ? jsonMatch[0] : content);

      const reflection: Reflection = {
        id: `reflection-${nanoid(8)}`,
        stepId: currentStep.id,
        type: data.onTrack ? 'insight' : 'adjustment',
        content: data.insights?.join('; ') || 'No insights',
        suggestedAction: data.suggestedAdjustments?.[0],
        timestamp: new Date().toISOString(),
      };

      eventBus.emitChorus({
        type: 'reflection:created',
        agentId: this.definition.id,
        timestamp: new Date().toISOString(),
        data: { reflection, onTrack: data.onTrack },
        severity: 'info',
      });

      return reflection;
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Self-Healing
  // ═══════════════════════════════════════════════════════════

  private async selfHeal(
    failedStep: PlanStep,
    completedSteps: PlanStep[],
    plan: Plan
  ): Promise<boolean> {
    logger.info({ step: failedStep.order }, '🔧 Attempting self-healing');

    const prompt = Prompts.selfHeal(
      failedStep.result?.error || 'Unknown error',
      `Plan: ${plan.strategy}\nFailed step: ${failedStep.action}`,
      this.state.errors.map(e => e.error),
      this.tools.getNames()
    );

    const messages: LLMMessage[] = [
      { role: 'system', content: Prompts.systemPersona(this.definition) },
      { role: 'user', content: prompt },
    ];

    const response = await this.llm.complete(messages);
    this.recordUsage(response.usage);

    try {
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const data = JSON.parse(jsonMatch ? jsonMatch[0] : content);

      if (data.strategy === 'retry' || data.strategy === 'alternative') {
        // Modify step inputs and retry
        if (data.modifiedInputs) {
          failedStep.inputs = { ...failedStep.inputs, ...data.modifiedInputs };
        }

        const result = await this.executeStep(failedStep, completedSteps, plan);
        failedStep.result = result;

        if (result.success) {
          this.state.errors[this.state.errors.length - 1].recovered = true;
          this.state.errors[this.state.errors.length - 1].recoveryAction = data.action;
          logger.info({ step: failedStep.order }, '✅ Self-healing successful');
          return true;
        }
      }

      if (data.strategy === 'skip') {
        logger.info({ step: failedStep.order }, '⏭️ Skipping failed step');
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Replanning
  // ═══════════════════════════════════════════════════════════

  private async replan(
    plan: Plan,
    completedSteps: PlanStep[],
    failedStep: PlanStep,
    error: string
  ): Promise<boolean> {
    logger.info('🔄 Replanning');

    plan.status = 'replanning';

    const prompt = Prompts.replan(
      plan.goal,
      plan,
      completedSteps,
      failedStep,
      error,
      this.tools.getNames()
    );

    const messages: LLMMessage[] = [
      { role: 'system', content: Prompts.systemPersona(this.definition) },
      { role: 'user', content: prompt },
    ];

    const response = await this.llm.complete(messages);
    this.recordUsage(response.usage);

    try {
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const data = JSON.parse(jsonMatch ? jsonMatch[0] : content);

      if (data.steps && data.steps.length > 0) {
        // Replace remaining steps with new plan
        const completedIds = new Set(completedSteps.map(s => s.id));
        const remainingOld = plan.steps.filter(s => !completedIds.has(s.id));
        const newSteps: PlanStep[] = data.steps.map((s: PlanStep, i: number) => ({
          id: `step-${nanoid(8)}`,
          order: completedSteps.length + i + 1,
          action: s.action,
          tool: s.tool,
          workflowId: s.workflowId,
          inputs: s.inputs || {},
          expectedOutput: s.expectedOutput || 'Result',
          dependencies: s.dependencies || [],
          status: 'pending' as const,
        }));

        plan.steps = [...completedSteps, ...newSteps];
        plan.strategy = data.strategy || plan.strategy + ' (replanned)';
        plan.status = 'active';

        logger.info({
          newSteps: newSteps.length,
          totalSteps: plan.steps.length,
        }, 'Plan updated');

        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════

  private async buildContext(goal: string): Promise<string> {
    const parts: string[] = [];

    // Add relevant memories
    const memories = await this.memory.search(goal, this.definition.memory.namespace, 5);
    if (memories.length > 0) {
      parts.push('Relevant memories:\n' + memories.map(m => `- ${m.content}`).join('\n'));
    }

    // Add recent conversation
    const conversation = await this.memory.getConversation(this.sessionId, 5);
    if (conversation.length > 0) {
      parts.push('Recent conversation:\n' + conversation.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n'));
    }

    // Add lessons
    const lessons = await this.memory.getLessons(this.definition.id, 3);
    if (lessons.length > 0) {
      parts.push('Past lessons:\n' + lessons.map(l => `- ${l}`).join('\n'));
    }

    return parts.join('\n\n') || 'No prior context available.';
  }

  private async getAvailableWorkflows(): Promise<Array<{ id: string; name: string; description?: string }>> {
    if (!this.n8nClient) return [];

    try {
      const { workflows } = await this.n8nClient.listWorkflows({ active: true });
      return workflows.map(w => ({
        id: w.id,
        name: w.name,
        description: `${w.nodes?.length || 0} nodes`,
      }));
    } catch {
      return [];
    }
  }

  private buildLLMTools(): LLMTool[] {
    return this.tools.listDefinitions().map(def => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            def.parameters.map(p => [
              p.name,
              {
                type: p.type,
                description: p.description,
                ...(p.enum ? { enum: p.enum } : {}),
                ...(p.default !== undefined ? { default: p.default } : {}),
              },
            ])
          ),
          required: def.parameters.filter(p => p.required).map(p => p.name),
        },
      },
    }));
  }

  private async handleToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
    runId: string
  ): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const tc of toolCalls) {
      const context: ToolExecutionContext = {
        agentId: this.definition.id,
        stepId: tc.id,
        runId,
        budgetRemaining: this.guardrails.budgetTracker.remaining(),
        timeoutMs: this.guardrails.executionTimer.remaining(),
      };

      try {
        const args = JSON.parse(tc.function.arguments);
        const result = await this.tools.execute(tc.function.name, args, context);
        results.push(result.output);
      } catch (error) {
        results.push({ error: error instanceof Error ? error.message : 'Tool execution failed' });
      }
    }

    return results;
  }

  private async generateSummary(plan: Plan, completedSteps: PlanStep[]): Promise<string> {
    const prompt = Prompts.summarize(
      plan.goal,
      plan.status === 'completed' ? 'Success' : 'Failed',
      completedSteps
    );

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a concise summarizer.' },
      { role: 'user', content: prompt },
    ];

    try {
      const response = await this.llm.complete(messages);
      this.recordUsage(response.usage);
      return response.content || 'Goal processing completed.';
    } catch {
      return `Goal: ${plan.goal}\nStatus: ${plan.status}\nSteps: ${completedSteps.filter(s => s.status === 'completed').length}/${plan.steps.length} completed`;
    }
  }

  private recordUsage(usage: { totalTokens: number; estimatedCost: number }): void {
    this.state.totalTokensUsed += usage.totalTokens;
    this.state.totalCost += usage.estimatedCost;
    this.state.lastActivityAt = new Date().toISOString();
  }

  // ═══════════════════════════════════════════════════════════
  // State Management
  // ═══════════════════════════════════════════════════════════

  getState(): AgentState {
    return { ...this.state };
  }

  getDefinition(): AgentDefinition {
    return { ...this.definition };
  }

  pause(): void {
    this.state.status = 'paused';
    eventBus.emitChorus({
      type: 'agent:paused',
      agentId: this.definition.id,
      timestamp: new Date().toISOString(),
      data: {},
      severity: 'info',
    });
  }

  resume(): void {
    this.state.status = 'idle';
    eventBus.emitChorus({
      type: 'agent:resumed',
      agentId: this.definition.id,
      timestamp: new Date().toISOString(),
      data: {},
      severity: 'info',
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Result Types
// ═══════════════════════════════════════════════════════════════

export interface AgentResult {
  success: boolean;
  goal: string;
  summary: string;
  steps: PlanStep[];
  lessons: string[];
  totalTokens: number;
  totalCost: number;
  durationMs: number;
}
