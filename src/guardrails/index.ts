/**
 * 🎵 Chorus — Guardrails
 * Safety, budget control, rate limiting, and execution constraints
 */

import { childLogger } from '../core/logger.js';
import { BudgetExceededError, GuardrailViolationError, MaxStepsExceededError, AgentTimeoutError } from '../core/errors.js';
import { eventBus } from '../core/events.js';
import type { GuardrailsConfig, RateLimitConfig } from '../types/index.js';

const logger = childLogger('guardrails');

// ═══════════════════════════════════════════════════════════════
// Budget Tracker
// ═══════════════════════════════════════════════════════════════

export class BudgetTracker {
  private budget: number;
  private spent: number = 0;
  private agentId: string;
  private warningThresholds: number[] = [0.5, 0.75, 0.9];

  constructor(agentId: string, budget: number) {
    this.agentId = agentId;
    this.budget = budget;
  }

  /**
   * Check if a cost is within budget
   */
  check(cost: number): boolean {
    const newTotal = this.spent + cost;

    // Check warning thresholds
    for (const threshold of this.warningThresholds) {
      if (this.spent < this.budget * threshold && newTotal >= this.budget * threshold) {
        eventBus.emitChorus({
          type: 'budget:warning',
          agentId: this.agentId,
          timestamp: new Date().toISOString(),
          data: { threshold, spent: newTotal, budget: this.budget },
          severity: 'warn',
        });
        logger.warn({
          agentId: this.agentId,
          threshold: `${threshold * 100}%`,
          spent: newTotal.toFixed(4),
          budget: this.budget.toFixed(4),
        }, 'Budget warning threshold reached');
      }
    }

    if (newTotal > this.budget) {
      eventBus.emitChorus({
        type: 'budget:exceeded',
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        data: { spent: newTotal, budget: this.budget },
        severity: 'critical',
      });
      return false;
    }

    return true;
  }

  /**
   * Record a cost
   */
  addCost(cost: number): void {
    this.spent += cost;
  }

  /**
   * Get remaining budget
   */
  remaining(): number {
    return Math.max(0, this.budget - this.spent);
  }

  /**
   * Get spent amount
   */
  getSpent(): number {
    return this.spent;
  }

  /**
   * Get budget total
   */
  getBudget(): number {
    return this.budget;
  }

  /**
   * Check and throw if over budget
   */
  enforce(cost: number): void {
    if (!this.check(cost)) {
      throw new BudgetExceededError(this.budget, this.spent + cost);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Rate Limiter
// ═══════════════════════════════════════════════════════════════

export class RateLimiter {
  private requests: number[] = [];
  private tokens: number[] = [];
  private workflowRuns: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed
   */
  checkRequest(): boolean {
    this.cleanOld(this.requests, 60000);
    return this.requests.length < this.config.maxRequestsPerMinute;
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.requests.push(Date.now());
  }

  /**
   * Check if token usage is allowed
   */
  checkTokens(count: number): boolean {
    this.cleanOld(this.tokens, 60000);
    const totalTokens = this.tokens.reduce((a, b) => a + b, 0) + count;
    return totalTokens <= this.config.maxTokensPerMinute;
  }

  /**
   * Record token usage
   */
  recordTokens(count: number): void {
    this.tokens.push(count);
  }

  /**
   * Check if a workflow run is allowed
   */
  checkWorkflowRun(): boolean {
    this.cleanOld(this.workflowRuns, 3600000);
    return this.workflowRuns.length < this.config.maxWorkflowRunsPerHour;
  }

  /**
   * Record a workflow run
   */
  recordWorkflowRun(): void {
    this.workflowRuns.push(Date.now());
  }

  /**
   * Wait until a request is allowed
   */
  async waitForSlot(): Promise<void> {
    while (!this.checkRequest()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.recordRequest();
  }

  private cleanOld(list: number[], windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    while (list.length > 0 && list[0] < cutoff) {
      list.shift();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Domain Guard
// ═══════════════════════════════════════════════════════════════

export class DomainGuard {
  private allowed: string[];
  private blocked: string[];

  constructor(allowed: string[], blocked: string[]) {
    this.allowed = allowed;
    this.blocked = blocked;
  }

  /**
   * Check if a URL is allowed
   */
  check(url: string): { allowed: boolean; reason?: string } {
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname;

      // Check blocklist first
      if (this.blocked.length > 0) {
        for (const blocked of this.blocked) {
          if (domain === blocked || domain.endsWith(`.${blocked}`)) {
            return { allowed: false, reason: `Domain ${domain} is blocked` };
          }
        }
      }

      // Check allowlist if configured
      if (this.allowed.length > 0) {
        const isAllowed = this.allowed.some(
          allowed => domain === allowed || domain.endsWith(`.${allowed}`)
        );
        if (!isAllowed) {
          return { allowed: false, reason: `Domain ${domain} is not in allowlist` };
        }
      }

      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Execution Timer
// ═══════════════════════════════════════════════════════════════

export class ExecutionTimer {
  private startTime: number;
  private maxTimeMs: number;
  private agentId: string;

  constructor(agentId: string, maxTimeMs: number) {
    this.agentId = agentId;
    this.maxTimeMs = maxTimeMs;
    this.startTime = Date.now();
  }

  /**
   * Check if execution time is still within limits
   */
  check(): boolean {
    return Date.now() - this.startTime < this.maxTimeMs;
  }

  /**
   * Enforce time limit
   */
  enforce(): void {
    if (!this.check()) {
      throw new AgentTimeoutError(this.maxTimeMs);
    }
  }

  /**
   * Get elapsed time
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get remaining time
   */
  remaining(): number {
    return Math.max(0, this.maxTimeMs - this.elapsed());
  }
}

// ═══════════════════════════════════════════════════════════════
// Approval Gate
// ═══════════════════════════════════════════════════════════════

export class ApprovalGate {
  private requireApproval: string[];
  private approved: Set<string> = new Set();

  constructor(requireApproval: string[]) {
    this.requireApproval = requireApproval;
  }

  /**
   * Check if an action requires approval
   */
  needsApproval(action: string): boolean {
    return this.requireApproval.some(pattern => {
      if (pattern === '*') return true;
      if (pattern.endsWith('*')) {
        return action.startsWith(pattern.slice(0, -1));
      }
      return action === pattern;
    });
  }

  /**
   * Approve an action
   */
  approve(action: string): void {
    this.approved.add(action);
  }

  /**
   * Check if an action is approved
   */
  isApproved(action: string): boolean {
    return this.approved.has(action);
  }

  /**
   * Enforce approval requirement
   */
  enforce(action: string): void {
    if (this.needsApproval(action) && !this.isApproved(action)) {
      throw new GuardrailViolationError(
        'approval_required',
        `Action "${action}" requires approval before execution`
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Guardrails Manager
// ═══════════════════════════════════════════════════════════════

export class GuardrailsManager {
  private config: GuardrailsConfig;
  private budget: BudgetTracker;
  private rateLimiter: RateLimiter;
  private domainGuard: DomainGuard;
  private timer: ExecutionTimer;
  private approvalGate: ApprovalGate;

  constructor(agentId: string, config: GuardrailsConfig) {
    this.config = config;
    this.budget = new BudgetTracker(agentId, config.maxBudgetPerRun);
    this.rateLimiter = new RateLimiter(config.rateLimits);
    this.domainGuard = new DomainGuard(config.allowedDomains, config.blockedDomains);
    this.timer = new ExecutionTimer(agentId, config.maxExecutionTimeMs);
    this.approvalGate = new ApprovalGate(config.requireApproval);
  }

  get budgetTracker(): BudgetTracker { return this.budget; }
  get rateLimits(): RateLimiter { return this.rateLimiter; }
  get domains(): DomainGuard { return this.domainGuard; }
  get executionTimer(): ExecutionTimer { return this.timer; }
  get approvals(): ApprovalGate { return this.approvalGate; }

  /**
   * Run all guardrail checks
   */
  checkAll(action: string, cost: number, url?: string): void {
    this.timer.enforce();
    this.budget.enforce(cost);

    if (!this.rateLimiter.checkRequest()) {
      throw new GuardrailViolationError('rate_limit', 'Rate limit exceeded');
    }

    if (url) {
      const domainCheck = this.domainGuard.check(url);
      if (!domainCheck.allowed) {
        throw new GuardrailViolationError('domain', domainCheck.reason!);
      }
    }

    this.approvalGate.enforce(action);
  }

  /**
   * Get status summary
   */
  getStatus(): {
    budgetRemaining: number;
    budgetSpent: number;
    timeRemaining: number;
    timeElapsed: number;
  } {
    return {
      budgetRemaining: this.budget.remaining(),
      budgetSpent: this.budget.getSpent(),
      timeRemaining: this.timer.remaining(),
      timeElapsed: this.timer.elapsed(),
    };
  }
}
