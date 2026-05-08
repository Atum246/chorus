/**
 * 🎵 Chorus — Tool Registry
 * Manages and executes tools available to agents
 */

import { nanoid } from 'nanoid';
import { childLogger } from '../core/logger.js';
import { ToolError } from '../core/errors.js';
import { eventBus } from '../core/events.js';
import type {
  ToolDefinition,
  ToolParameter,
  ToolResult,
  ToolExecutionContext,
  N8nWorkflow,
} from '../types/index.js';
import { N8nClient, WorkflowBuilder } from '../n8n/index.js';

const logger = childLogger('tools');

// ═══════════════════════════════════════════════════════════════
// Tool Executor Function Type
// ═══════════════════════════════════════════════════════════════

export type ToolExecutor = (
  inputs: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

// ═══════════════════════════════════════════════════════════════
// Registered Tool
// ═══════════════════════════════════════════════════════════════

export interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}

// ═══════════════════════════════════════════════════════════════
// Tool Registry
// ═══════════════════════════════════════════════════════════════

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private n8nClient?: N8nClient;

  constructor(n8nClient?: N8nClient) {
    this.n8nClient = n8nClient;
    this.registerBuiltinTools();
  }

  /**
   * Register a new tool
   */
  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.name, tool);
    logger.info({ name: tool.definition.name, category: tool.definition.category }, 'Tool registered');
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  list(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tool definitions (for LLM)
   */
  listDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute a tool
   */
  async execute(
    name: string,
    inputs: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(name, 'Tool not found');
    }

    // Validate required inputs
    for (const param of tool.definition.parameters) {
      if (param.required && !(param.name in inputs)) {
        throw new ToolError(name, `Missing required parameter: ${param.name}`);
      }
    }

    const startTime = Date.now();

    try {
      logger.info({ name, inputs }, 'Executing tool');

      eventBus.emitChorus({
        type: 'step:started',
        agentId: context.agentId,
        timestamp: new Date().toISOString(),
        data: { tool: name, inputs },
        severity: 'info',
      });

      const result = await tool.executor(inputs, context);

      eventBus.emitChorus({
        type: result.success ? 'step:completed' : 'step:failed',
        agentId: context.agentId,
        timestamp: new Date().toISOString(),
        data: { tool: name, result },
        severity: result.success ? 'info' : 'error',
      });

      logger.info({
        name,
        success: result.success,
        durationMs: Date.now() - startTime,
        tokensUsed: result.tokensUsed,
      }, 'Tool execution complete');

      return result;
    } catch (error) {
      const result: ToolResult = {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokensUsed: 0,
        cost: 0,
        durationMs: Date.now() - startTime,
      };

      eventBus.emitChorus({
        type: 'step:failed',
        agentId: context.agentId,
        timestamp: new Date().toISOString(),
        data: { tool: name, error: result.error },
        severity: 'error',
      });

      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Built-in Tools
  // ═══════════════════════════════════════════════════════════

  private registerBuiltinTools(): void {
    // 1. Execute n8n Workflow
    this.register({
      definition: {
        name: 'n8n_execute_workflow',
        description: 'Execute an n8n workflow by ID with optional input data',
        category: 'n8n',
        parameters: [
          { name: 'workflowId', type: 'string', description: 'The ID of the workflow to execute', required: true },
          { name: 'data', type: 'object', description: 'Input data for the workflow', required: false },
        ],
      },
      executor: async (inputs, context) => {
        if (!this.n8nClient) throw new ToolError('n8n_execute_workflow', 'n8n client not configured');

        const execution = await this.n8nClient.executeWorkflow(
          inputs.workflowId as string,
          inputs.data as Record<string, unknown>
        );

        const result = await this.n8nClient.waitForExecution(execution.id);

        return {
          success: result.status === 'completed',
          output: result.data,
          error: result.status === 'error' ? result.error : undefined,
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });

    // 2. Trigger n8n Webhook
    this.register({
      definition: {
        name: 'n8n_trigger_webhook',
        description: 'Trigger an n8n webhook endpoint',
        category: 'n8n',
        parameters: [
          { name: 'path', type: 'string', description: 'Webhook path', required: true },
          { name: 'method', type: 'string', description: 'HTTP method', required: false, default: 'POST', enum: ['GET', 'POST', 'PUT'] },
          { name: 'data', type: 'object', description: 'Request body', required: false },
        ],
      },
      executor: async (inputs) => {
        if (!this.n8nClient) throw new ToolError('n8n_trigger_webhook', 'n8n client not configured');

        const result = await this.n8nClient.triggerWebhook(
          inputs.path as string,
          (inputs.method as 'GET' | 'POST' | 'PUT') || 'POST',
          inputs.data as Record<string, unknown>
        );

        return {
          success: true,
          output: result,
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });

    // 3. List n8n Workflows
    this.register({
      definition: {
        name: 'n8n_list_workflows',
        description: 'List all available n8n workflows',
        category: 'n8n',
        parameters: [
          { name: 'active', type: 'boolean', description: 'Filter by active status', required: false },
          { name: 'limit', type: 'number', description: 'Max results', required: false },
        ],
      },
      executor: async (inputs) => {
        if (!this.n8nClient) throw new ToolError('n8n_list_workflows', 'n8n client not configured');

        const result = await this.n8nClient.listWorkflows({
          active: inputs.active as boolean | undefined,
          limit: (inputs.limit as number) || 50,
        });

        return {
          success: true,
          output: result.workflows.map(w => ({
            id: w.id,
            name: w.name,
            active: w.active,
            nodeCount: w.nodes?.length || 0,
          })),
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });

    // 4. Analyze Workflow
    this.register({
      definition: {
        name: 'n8n_analyze_workflow',
        description: 'Analyze an n8n workflow structure and capabilities',
        category: 'n8n',
        parameters: [
          { name: 'workflowId', type: 'string', description: 'Workflow ID to analyze', required: true },
        ],
      },
      executor: async (inputs) => {
        if (!this.n8nClient) throw new ToolError('n8n_analyze_workflow', 'n8n client not configured');

        const workflow = await this.n8nClient.getWorkflow(inputs.workflowId as string);
        const analysis = this.n8nClient.analyzeWorkflow(workflow);

        return {
          success: true,
          output: analysis,
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });

    // 5. Create Workflow
    this.register({
      definition: {
        name: 'n8n_create_workflow',
        description: 'Create a new n8n workflow programmatically',
        category: 'n8n',
        parameters: [
          { name: 'name', type: 'string', description: 'Workflow name', required: true },
          { name: 'nodes', type: 'array', description: 'Workflow nodes', required: true },
          { name: 'connections', type: 'object', description: 'Node connections', required: false },
        ],
      },
      executor: async (inputs) => {
        if (!this.n8nClient) throw new ToolError('n8n_create_workflow', 'n8n client not configured');

        const workflow = await this.n8nClient.createWorkflow({
          name: inputs.name as string,
          nodes: inputs.nodes as N8nWorkflow['nodes'],
          connections: (inputs.connections || {}) as N8nWorkflow['connections'],
        });

        return {
          success: true,
          output: { id: workflow.id, name: workflow.name },
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });

    // 6. Wait/Sleep
    this.register({
      definition: {
        name: 'wait',
        description: 'Wait for a specified duration (useful between steps)',
        category: 'utility',
        parameters: [
          { name: 'seconds', type: 'number', description: 'Seconds to wait', required: true },
        ],
      },
      executor: async (inputs) => {
        const seconds = Math.min(inputs.seconds as number, 300); // Max 5 min
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return {
          success: true,
          output: `Waited ${seconds} seconds`,
          tokensUsed: 0,
          cost: 0,
          durationMs: seconds * 1000,
        };
      },
    });

    // 7. Transform Data
    this.register({
      definition: {
        name: 'transform_data',
        description: 'Transform data using JSON path extraction, filtering, mapping, or sorting',
        category: 'data',
        parameters: [
          { name: 'data', type: 'object', description: 'Input data to transform', required: true },
          { name: 'operation', type: 'string', description: 'Operation type', required: true, enum: ['extract', 'filter', 'map', 'sort', 'group', 'merge', 'flatten'] },
          { name: 'config', type: 'object', description: 'Operation configuration', required: true },
        ],
      },
      executor: async (inputs) => {
        const data = inputs.data as unknown;
        const operation = inputs.operation as string;
        const config = inputs.config as Record<string, unknown>;

        let result: unknown;

        switch (operation) {
          case 'extract': {
            const path = config.path as string;
            result = extractByPath(data, path);
            break;
          }
          case 'filter': {
            const arr = Array.isArray(data) ? data : [data];
            const field = config.field as string;
            const value = config.value;
            const op = config.operator as string || 'eq';
            result = arr.filter(item => compareValues(extractByPath(item, field), value, op));
            break;
          }
          case 'sort': {
            const arr = Array.isArray(data) ? data : [data];
            const field = config.field as string;
            const direction = config.direction as string || 'asc';
            result = [...arr].sort((a, b) => {
              const va = extractByPath(a, field);
              const vb = extractByPath(b, field);
              return direction === 'asc' ? compareAsc(va, vb) : compareAsc(vb, va);
            });
            break;
          }
          case 'group': {
            const arr = Array.isArray(data) ? data : [data];
            const field = config.field as string;
            const groups: Record<string, unknown[]> = {};
            for (const item of arr) {
              const key = String(extractByPath(item, field));
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
            }
            result = groups;
            break;
          }
          case 'flatten': {
            result = Array.isArray(data) ? data.flat(config.depth as number || 1) : [data];
            break;
          }
          case 'merge': {
            const items = Array.isArray(data) ? data : [data];
            result = Object.assign({}, ...items);
            break;
          }
          default:
            result = data;
        }

        return {
          success: true,
          output: result,
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });

    // 8. HTTP Request
    this.register({
      definition: {
        name: 'http_request',
        description: 'Make an HTTP request to any URL',
        category: 'network',
        parameters: [
          { name: 'url', type: 'string', description: 'Request URL', required: true },
          { name: 'method', type: 'string', description: 'HTTP method', required: false, default: 'GET', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          { name: 'headers', type: 'object', description: 'Request headers', required: false },
          { name: 'body', type: 'object', description: 'Request body', required: false },
          { name: 'timeout', type: 'number', description: 'Timeout in ms', required: false },
        ],
      },
      executor: async (inputs) => {
        const { default: axios } = await import('axios');
        const startTime = Date.now();

        try {
          const response = await axios({
            url: inputs.url as string,
            method: (inputs.method as string || 'GET').toUpperCase(),
            headers: inputs.headers as Record<string, string>,
            data: inputs.body,
            timeout: (inputs.timeout as number) || 30000,
          });

          return {
            success: true,
            output: {
              status: response.status,
              headers: response.headers,
              data: response.data,
            },
            tokensUsed: 0,
            cost: 0,
            durationMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            output: null,
            error: error instanceof Error ? error.message : 'HTTP request failed',
            tokensUsed: 0,
            cost: 0,
            durationMs: Date.now() - startTime,
          };
        }
      },
    });

    // 9. Store Memory
    this.register({
      definition: {
        name: 'store_memory',
        description: 'Store important information in long-term memory',
        category: 'memory',
        parameters: [
          { name: 'content', type: 'string', description: 'Content to remember', required: true },
          { name: 'importance', type: 'number', description: 'Importance (0-1)', required: false, default: 0.5 },
          { name: 'namespace', type: 'string', description: 'Memory namespace', required: false, default: 'default' },
        ],
      },
      executor: async (inputs, context) => {
        // Memory storage is handled by the agent engine
        return {
          success: true,
          output: { stored: true, content: inputs.content },
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
          sideEffects: ['memory_stored'],
        };
      },
    });

    // 10. Search Memory
    this.register({
      definition: {
        name: 'search_memory',
        description: 'Search long-term memory for relevant information',
        category: 'memory',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
          { name: 'limit', type: 'number', description: 'Max results', required: false, default: 5 },
        ],
      },
      executor: async (inputs) => {
        // Memory search is handled by the agent engine
        return {
          success: true,
          output: { query: inputs.query },
          tokensUsed: 0,
          cost: 0,
          durationMs: 0,
        };
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function extractByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function compareValues(a: unknown, b: unknown, op: string): boolean {
  switch (op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'gt': return (a as number) > (b as number);
    case 'gte': return (a as number) >= (b as number);
    case 'lt': return (a as number) < (b as number);
    case 'lte': return (a as number) <= (b as number);
    case 'contains': return String(a).includes(String(b));
    case 'startsWith': return String(a).startsWith(String(b));
    case 'endsWith': return String(a).endsWith(String(b));
    default: return false;
  }
}

function compareAsc(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return (a as number) - (b as number);
}
