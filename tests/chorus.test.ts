/**
 * 🎵 Chorus — Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WorkflowBuilder, Patterns } from '../src/n8n/workflow-builder.js';
import { TemplateManager } from '../src/n8n/templates.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { BudgetTracker, RateLimiter, DomainGuard, ExecutionTimer, ApprovalGate } from '../src/guardrails/index.js';
import { PROVIDERS, listProviders, getProvider, calculateCost } from '../src/llm/universal-connector.js';
import { MemoryStore } from '../src/memory/store.js';

// ═══════════════════════════════════════════════════════════════
// Workflow Builder Tests
// ═══════════════════════════════════════════════════════════════

describe('WorkflowBuilder', () => {
  it('should build a simple webhook workflow', () => {
    const workflow = new WorkflowBuilder('Test Workflow')
      .addWebhook('test')
      .addCode('return $input;')
      .addRespondToWebhook()
      .build();

    expect(workflow.name).toBe('Test Workflow');
    expect(workflow.nodes).toHaveLength(3);
    expect(workflow.nodes![0].type).toBe('n8n-nodes-base.webhook');
    expect(workflow.nodes![1].type).toBe('n8n-nodes-base.code');
    expect(workflow.nodes![2].type).toBe('n8n-nodes-base.respondToWebhook');
  });

  it('should auto-connect nodes', () => {
    const workflow = new WorkflowBuilder()
      .addManualTrigger()
      .addHttpRequest('https://api.example.com')
      .addCode('return $input;')
      .build();

    expect(workflow.connections).toBeDefined();
    const connections = workflow.connections!;
    expect(connections['Manual Trigger']).toBeDefined();
  });

  it('should build from patterns', () => {
    const workflow = Patterns.webhookPipeline('process', 'return $input;', 'Pipeline Test');
    expect(workflow.name).toBe('Pipeline Test');
    expect(workflow.nodes).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// Template Manager Tests
// ═══════════════════════════════════════════════════════════════

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeAll(() => {
    manager = new TemplateManager();
  });

  it('should list all templates', () => {
    const templates = manager.list();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('should filter by category', () => {
    const aiTemplates = manager.list('ai');
    expect(aiTemplates.every(t => t.category === 'ai')).toBe(true);
  });

  it('should get categories', () => {
    const categories = manager.getCategories();
    expect(categories).toContain('ai');
    expect(categories).toContain('data');
  });

  it('should build a template', () => {
    const workflow = manager.build('webhook-ai-processor', { path: 'test' });
    expect(workflow.nodes).toBeDefined();
    expect(workflow.nodes!.length).toBeGreaterThan(0);
  });

  it('should throw on missing required params', () => {
    expect(() => manager.build('scheduled-data-pipeline')).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// Tool Registry Tests
// ═══════════════════════════════════════════════════════════════

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeAll(() => {
    registry = new ToolRegistry();
  });

  it('should have built-in tools', () => {
    const tools = registry.list();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should list tool names', () => {
    const names = registry.getNames();
    expect(names).toContain('n8n_execute_workflow');
    expect(names).toContain('wait');
    expect(names).toContain('transform_data');
  });

  it('should execute the wait tool', async () => {
    const result = await registry.execute('wait', { seconds: 1 }, {
      agentId: 'test',
      stepId: 'test',
      runId: 'test',
      budgetRemaining: 100,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(1000);
  });

  it('should execute transform_data', async () => {
    const result = await registry.execute('transform_data', {
      data: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
      operation: 'filter',
      config: { field: 'age', operator: 'gt', value: 26 },
    }, {
      agentId: 'test',
      stepId: 'test',
      runId: 'test',
      budgetRemaining: 100,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.output).toEqual([{ name: 'Alice', age: 30 }]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Guardrails Tests
// ═══════════════════════════════════════════════════════════════

describe('BudgetTracker', () => {
  it('should track spending', () => {
    const tracker = new BudgetTracker('test', 10);
    expect(tracker.remaining()).toBe(10);

    tracker.addCost(3);
    expect(tracker.remaining()).toBe(7);
    expect(tracker.getSpent()).toBe(3);
  });

  it('should detect budget exceeded', () => {
    const tracker = new BudgetTracker('test', 5);
    expect(tracker.check(3)).toBe(true);
    tracker.addCost(3);
    expect(tracker.check(3)).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 10,
      maxTokensPerMinute: 100000,
      maxWorkflowRunsPerHour: 100,
    });

    expect(limiter.checkRequest()).toBe(true);
    limiter.recordRequest();
    expect(limiter.checkRequest()).toBe(true);
  });
});

describe('DomainGuard', () => {
  it('should allow when no restrictions', () => {
    const guard = new DomainGuard([], []);
    expect(guard.check('https://example.com').allowed).toBe(true);
  });

  it('should block blocked domains', () => {
    const guard = new DomainGuard([], ['evil.com']);
    expect(guard.check('https://evil.com/api').allowed).toBe(false);
    expect(guard.check('https://good.com/api').allowed).toBe(true);
  });

  it('should enforce allowlist', () => {
    const guard = new DomainGuard(['allowed.com'], []);
    expect(guard.check('https://allowed.com/api').allowed).toBe(true);
    expect(guard.check('https://other.com/api').allowed).toBe(false);
  });
});

describe('ExecutionTimer', () => {
  it('should track time', () => {
    const timer = new ExecutionTimer('test', 10000);
    expect(timer.check()).toBe(true);
    expect(timer.remaining()).toBeGreaterThan(0);
  });
});

describe('ApprovalGate', () => {
  it('should require approval for matching actions', () => {
    const gate = new ApprovalGate(['delete_*', 'send_email']);
    expect(gate.needsApproval('delete_user')).toBe(true);
    expect(gate.needsApproval('send_email')).toBe(true);
    expect(gate.needsApproval('read_data')).toBe(false);
  });

  it('should approve actions', () => {
    const gate = new ApprovalGate(['send_email']);
    gate.approve('send_email');
    expect(gate.isApproved('send_email')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Provider Tests
// ═══════════════════════════════════════════════════════════════

describe('Providers', () => {
  it('should list all providers', () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(10);
  });

  it('should get provider by id', () => {
    const openai = getProvider('openai');
    expect(openai).toBeDefined();
    expect(openai!.name).toBe('OpenAI');
    expect(openai!.models).toContain('gpt-4o');
  });

  it('should calculate costs', () => {
    const cost = calculateCost('openai', 'gpt-4o-mini', 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it('should return 0 cost for local providers', () => {
    const cost = calculateCost('ollama', 'llama3.1', 1000, 500);
    expect(cost).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Memory Tests
// ═══════════════════════════════════════════════════════════════

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeAll(async () => {
    store = new MemoryStore({ backend: 'in-memory', maxShortTermMessages: 10, maxLongTermEntries: 100, ttlSeconds: 3600 });
    await store.initialize();
  });

  it('should store and recall memories', async () => {
    await store.store({
      namespace: 'test',
      type: 'long-term',
      content: 'User prefers dark mode',
      importance: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const memories = await store.recall('test', 'long-term');
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].content).toBe('User prefers dark mode');
  });

  it('should search memories', async () => {
    await store.store({
      namespace: 'test',
      type: 'long-term',
      content: 'Customer complaint about shipping delays',
      importance: 0.9,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const results = await store.search('shipping');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should manage conversations', async () => {
    await store.addMessage('session-1', {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    });

    await store.addMessage('session-1', {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: new Date().toISOString(),
    });

    const history = await store.getConversation('session-1');
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Hello');
  });

  it('should get stats', async () => {
    const stats = await store.getStats();
    expect(stats.totalMemories).toBeGreaterThan(0);
  });
});
