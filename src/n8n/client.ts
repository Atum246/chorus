/**
 * 🎵 Chorus — n8n API Client
 * Full-featured n8n integration via REST API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { childLogger } from '../core/logger.js';
import { N8nConnectionError, N8nWorkflowError } from '../core/errors.js';
import type {
  N8nConfig,
  N8nWorkflow,
  N8nExecution,
  N8nNode,
  N8nConnections,
} from '../types/index.js';

const logger = childLogger('n8n-client');

export class N8nClient {
  private http: AxiosInstance;
  private config: N8nConfig;

  constructor(config: N8nConfig) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: config.timeout,
    });

    // Response interceptor for error handling
    this.http.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          if (status === 401) {
            throw new N8nConnectionError('Invalid n8n API key', { status, data });
          }
          if (status === 404) {
            throw new N8nWorkflowError('Resource not found', { status, data });
          }
          throw new N8nConnectionError(`n8n API error: ${status}`, { status, data });
        }
        if (error.code === 'ECONNREFUSED') {
          throw new N8nConnectionError('Cannot connect to n8n. Is it running?', {
            baseUrl: this.config.baseUrl,
          });
        }
        throw new N8nConnectionError(`n8n request failed: ${error.message}`);
      }
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Workflow Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * List all workflows
   */
  async listWorkflows(options?: {
    active?: boolean;
    tags?: string[];
    limit?: number;
    cursor?: string;
  }): Promise<{ workflows: N8nWorkflow[]; nextCursor?: string }> {
    const params: Record<string, unknown> = {};
    if (options?.active !== undefined) params.active = options.active;
    if (options?.tags) params.tags = options.tags.join(',');
    if (options?.limit) params.limit = options.limit;
    if (options?.cursor) params.cursor = options.cursor;

    const response = await this.http.get('/api/v1/workflows', { params });
    logger.debug({ count: response.data.data?.length }, 'Listed workflows');
    return {
      workflows: response.data.data || [],
      nextCursor: response.data.nextCursor,
    };
  }

  /**
   * Get a specific workflow
   */
  async getWorkflow(workflowId: string): Promise<N8nWorkflow> {
    const response = await this.http.get(`/api/v1/workflows/${workflowId}`);
    logger.debug({ workflowId }, 'Got workflow');
    return response.data;
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.http.post('/api/v1/workflows', workflow);
    logger.info({ workflowId: response.data.id, name: workflow.name }, 'Created workflow');
    return response.data;
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(workflowId: string, updates: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.http.patch(`/api/v1/workflows/${workflowId}`, updates);
    logger.info({ workflowId }, 'Updated workflow');
    return response.data;
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.http.delete(`/api/v1/workflows/${workflowId}`);
    logger.info({ workflowId }, 'Deleted workflow');
  }

  /**
   * Activate/deactivate a workflow
   */
  async activateWorkflow(workflowId: string, active: boolean): Promise<N8nWorkflow> {
    const response = await this.http.patch(`/api/v1/workflows/${workflowId}`, { active });
    logger.info({ workflowId, active }, `${active ? 'Activated' : 'Deactivated'} workflow`);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════
  // Workflow Execution
  // ═══════════════════════════════════════════════════════════

  /**
   * Execute a workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    data?: Record<string, unknown>
  ): Promise<N8nExecution> {
    const response = await this.http.post(`/api/v1/workflows/${workflowId}/run`, {
      startNodes: [],
      runData: data || {},
    });
    logger.info({ workflowId, executionId: response.data.id }, 'Triggered workflow execution');
    return response.data;
  }

  /**
   * Trigger a webhook-based workflow
   */
  async triggerWebhook(
    webhookPath: string,
    method: 'GET' | 'POST' | 'PUT',
    data?: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<unknown> {
    const url = `${this.config.webhookBaseUrl || this.config.baseUrl}/webhook/${webhookPath}`;
    logger.debug({ url, method }, 'Triggering webhook');

    const response = await this.http.request({
      method,
      url,
      data,
      headers: headers || {},
    });

    logger.info({ webhookPath, status: response.status }, 'Webhook triggered');
    return response.data;
  }

  /**
   * Trigger a webhook-test based workflow (for testing)
   */
  async triggerWebhookTest(
    webhookPath: string,
    method: 'GET' | 'POST' | 'PUT',
    data?: Record<string, unknown>
  ): Promise<unknown> {
    const url = `${this.config.webhookBaseUrl || this.config.baseUrl}/webhook-test/${webhookPath}`;
    const response = await this.http.request({ method, url, data });
    logger.info({ webhookPath }, 'Webhook test triggered');
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════
  // Execution Monitoring
  // ═══════════════════════════════════════════════════════════

  /**
   * Get execution details
   */
  async getExecution(executionId: string): Promise<N8nExecution> {
    const response = await this.http.get(`/api/v1/executions/${executionId}`);
    return response.data;
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(options?: {
    workflowId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ executions: N8nExecution[]; nextCursor?: string }> {
    const params: Record<string, unknown> = {};
    if (options?.workflowId) params.workflowId = options.workflowId;
    if (options?.status) params.status = options.status;
    if (options?.limit) params.limit = options.limit;
    if (options?.cursor) params.cursor = options.cursor;

    const response = await this.http.get('/api/v1/executions', { params });
    return {
      executions: response.data.data || [],
      nextCursor: response.data.nextCursor,
    };
  }

  /**
   * Wait for an execution to complete
   */
  async waitForExecution(
    executionId: string,
    timeoutMs: number = 60000,
    pollIntervalMs: number = 2000
  ): Promise<N8nExecution> {
    const startTime = Date.now();

    while (true) {
      const execution = await this.getExecution(executionId);

      if (execution.status === 'completed' || execution.status === 'error') {
        return execution;
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new N8nWorkflowError('Execution timeout', { executionId, timeoutMs });
      }

      await sleep(pollIntervalMs);
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    await this.http.post(`/api/v1/executions/${executionId}/stop`);
    logger.info({ executionId }, 'Cancelled execution');
  }

  // ═══════════════════════════════════════════════════════════
  // Workflow Analysis
  // ═══════════════════════════════════════════════════════════

  /**
   * Analyze a workflow's structure
   */
  analyzeWorkflow(workflow: N8nWorkflow): WorkflowAnalysis {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};

    const nodeTypes = nodes.map(n => n.type);
    const triggerNodes = nodes.filter(n => n.type.toLowerCase().includes('trigger'));
    const webhookNodes = nodes.filter(n => n.type.toLowerCase().includes('webhook'));
    const actionNodes = nodes.filter(n =>
      !n.type.toLowerCase().includes('trigger') &&
      !n.type.toLowerCase().includes('webhook')
    );

    // Find entry points
    const entryPoints = triggerNodes.map(n => n.name);

    // Build execution graph
    const graph = this.buildExecutionGraph(nodes, connections);

    // Estimate complexity
    const complexity = this.estimateComplexity(nodes, connections);

    return {
      nodeCount: nodes.length,
      nodeTypes: [...new Set(nodeTypes)],
      triggerNodes: triggerNodes.map(n => ({ name: n.name, type: n.type })),
      webhookNodes: webhookNodes.map(n => ({ name: n.name, type: n.type, path: n.parameters.path as string })),
      actionNodes: actionNodes.map(n => ({ name: n.name, type: n.type })),
      entryPoints,
      executionGraph: graph,
      complexity,
      hasWebhooks: webhookNodes.length > 0,
      hasLoops: this.detectLoops(connections),
      estimatedExecutionTimeMs: complexity * 500, // rough estimate
    };
  }

  /**
   * Build execution graph from nodes and connections
   */
  private buildExecutionGraph(
    nodes: N8nNode[],
    connections: N8nConnections
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const node of nodes) {
      graph.set(node.name, []);
    }

    for (const [source, outputs] of Object.entries(connections)) {
      for (const [, targets] of Object.entries(outputs)) {
        for (const targetList of targets) {
          for (const target of targetList) {
            const existing = graph.get(source) || [];
            existing.push(target.node);
            graph.set(source, existing);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Estimate workflow complexity (1-10)
   */
  private estimateComplexity(nodes: N8nNode[], connections: N8nConnections): number {
    let score = 1;
    score += Math.min(nodes.length * 0.3, 3);
    score += Math.min(Object.keys(connections).length * 0.2, 2);

    const hasSwitch = nodes.some(n => n.type.includes('switch') || n.type.includes('if'));
    if (hasSwitch) score += 1;

    const hasMerge = nodes.some(n => n.type.includes('merge'));
    if (hasMerge) score += 1;

    const hasCode = nodes.some(n => n.type.includes('code') || n.type.includes('function'));
    if (hasCode) score += 1;

    const hasLoop = this.detectLoops(connections);
    if (hasLoop) score += 1;

    return Math.min(Math.round(score), 10);
  }

  /**
   * Detect loops in workflow
   */
  private detectLoops(connections: N8nConnections): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const adjacency = new Map<string, string[]>();
    for (const [source, outputs] of Object.entries(connections)) {
      const targets: string[] = [];
      for (const [, targetList] of Object.entries(outputs)) {
        for (const t of targetList) {
          for (const item of t) {
            targets.push(item.node);
          }
        }
      }
      adjacency.set(source, targets);
    }

    const dfs = (node: string): boolean => {
      visited.add(node);
      stack.add(node);

      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (stack.has(neighbor)) {
          return true;
        }
      }

      stack.delete(node);
      return false;
    };

    for (const node of adjacency.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // Credential Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * List available credentials
   */
  async listCredentials(): Promise<unknown[]> {
    const response = await this.http.get('/api/v1/credentials');
    return response.data.data || [];
  }

  /**
   * Test connection to n8n
   */
  async testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const response = await this.http.get('/api/v1/workflows', { params: { limit: 1 } });
      return {
        success: true,
        version: response.headers['x-n8n-version'] || 'unknown',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface WorkflowAnalysis {
  nodeCount: number;
  nodeTypes: string[];
  triggerNodes: Array<{ name: string; type: string }>;
  webhookNodes: Array<{ name: string; type: string; path?: string }>;
  actionNodes: Array<{ name: string; type: string }>;
  entryPoints: string[];
  executionGraph: Map<string, string[]>;
  complexity: number;
  hasWebhooks: boolean;
  hasLoops: boolean;
  estimatedExecutionTimeMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
