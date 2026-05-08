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

// ═══════════════════════════════════════════════════════════════
// Superpower Tools Tests
// ═══════════════════════════════════════════════════════════════

describe('Superpower Tools', () => {
  let registry: ToolRegistry;

  beforeAll(() => {
    registry = new ToolRegistry();
  });

  it('should have all superpower tools registered', () => {
    const names = registry.getNames();
    expect(names).toContain('web_search');
    expect(names).toContain('web_scrape');
    expect(names).toContain('file_read');
    expect(names).toContain('file_write');
    expect(names).toContain('file_list');
    expect(names).toContain('code_execute');
    expect(names).toContain('code_eval');
    expect(names).toContain('json_transform');
    expect(names).toContain('csv_parse');
    expect(names).toContain('text_extract');
    expect(names).toContain('date_calc');
    expect(names).toContain('uuid_generate');
    expect(names).toContain('hash_generate');
    expect(names).toContain('base64_encode');
    expect(names).toContain('json_parse');
    expect(names).toContain('system_info');
    expect(names).toContain('shell_exec');
    expect(names).toContain('api_call');
    expect(names).toContain('graphql_query');
    expect(names).toContain('notify_webhook');
    expect(names).toContain('notify_slack');
  });

  it('should execute code_eval', async () => {
    const result = await registry.execute('code_eval', { expression: '2 + 2 * 3' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ expression: '2 + 2 * 3', result: 8 });
  });

  it('should execute uuid_generate', async () => {
    const result = await registry.execute('uuid_generate', {}, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should execute hash_generate', async () => {
    const result = await registry.execute('hash_generate', { text: 'hello', algorithm: 'sha256' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).hash).toHaveLength(64);
    expect((result.output as any).algorithm).toBe('sha256');
  });

  it('should execute base64_encode', async () => {
    const result = await registry.execute('base64_encode', { text: 'hello world', mode: 'encode' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).encoded).toBe('aGVsbG8gd29ybGQ=');
  });

  it('should execute base64_decode', async () => {
    const result = await registry.execute('base64_encode', { text: 'aGVsbG8gd29ybGQ=', mode: 'decode' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).decoded).toBe('hello world');
  });

  it('should execute json_parse', async () => {
    const result = await registry.execute('json_parse', { text: '{"name":"Alice","age":30}' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).valid).toBe(true);
    expect((result.output as any).parsed).toEqual({ name: 'Alice', age: 30 });
  });

  it('should execute json_parse with invalid JSON', async () => {
    const result = await registry.execute('json_parse', { text: 'not json' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).valid).toBe(false);
  });

  it('should execute csv_parse', async () => {
    const result = await registry.execute('csv_parse', { csv: 'name,age\nAlice,30\nBob,25' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).headers).toEqual(['name', 'age']);
    expect((result.output as any).rows).toHaveLength(2);
    expect((result.output as any).rows[0]).toEqual({ name: 'Alice', age: '30' });
  });

  it('should execute json_transform', async () => {
    const result = await registry.execute('json_transform', {
      data: { user: { name: 'Alice', address: { city: 'NYC' } } },
      query: 'user.address.city',
    }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).result).toBe('NYC');
  });

  it('should execute date_calc now', async () => {
    const result = await registry.execute('date_calc', { operation: 'now' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).now).toBeDefined();
  });

  it('should execute system_info', async () => {
    const result = await registry.execute('system_info', {}, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).platform).toBeDefined();
    expect((result.output as any).nodeVersion).toBeDefined();
  });

  it('should execute code_execute', async () => {
    const result = await registry.execute('code_execute', { code: 'return 2 + 2;' }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).result).toBe(4);
  });

  it('should execute text_extract for emails', async () => {
    const result = await registry.execute('text_extract', {
      text: 'Contact us at support@example.com or sales@company.org',
      extractType: 'emails',
    }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).matches).toContain('support@example.com');
    expect((result.output as any).matches).toContain('sales@company.org');
  });

  it('should execute text_extract for URLs', async () => {
    const result = await registry.execute('text_extract', {
      text: 'Visit https://example.com and http://test.org/path',
      extractType: 'urls',
    }, {
      agentId: 'test', stepId: 'test', runId: 'test', budgetRemaining: 100, timeoutMs: 30000,
    });
    expect(result.success).toBe(true);
    expect((result.output as any).matches.length).toBeGreaterThanOrEqual(2);
  });

  it('should count total tools correctly', () => {
    const names = registry.getNames();
    // 10 n8n/utility tools + 30+ superpower tools
    expect(names.length).toBeGreaterThan(35);
  });
});
