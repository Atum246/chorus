/**
 * 🎵 Chorus — n8n Workflow Builder
 * Programmatic workflow construction
 */

import { nanoid } from 'nanoid';
import type { N8nWorkflow, N8nNode, N8nConnections } from '../types/index.js';

export class WorkflowBuilder {
  private workflow: Partial<N8nWorkflow>;
  private nodes: N8nNode[] = [];
  private connections: N8nConnections = {};

  constructor(name?: string) {
    this.workflow = {
      name: name || `Chorus-${nanoid(8)}`,
      active: false,
      nodes: [],
      connections: {},
      settings: {
        saveExecutionProgress: true,
        callerPolicy: 'workflowsFromSameOwner',
      },
    };
  }

  /**
   * Add a trigger node
   */
  addTrigger(type: string, params: Record<string, unknown> = {}, name?: string): this {
    const node: N8nNode = {
      id: nanoid(10),
      name: name || `${type}-${nanoid(4)}`,
      type,
      typeVersion: 1,
      position: [this.nodes.length * 200, 300],
      parameters: params,
    };
    this.nodes.push(node);
    return this;
  }

  /**
   * Add a webhook trigger
   */
  addWebhook(path: string, method: string = 'POST', params: Record<string, unknown> = {}): this {
    return this.addTrigger('n8n-nodes-base.webhook', {
      path,
      httpMethod: method,
      responseMode: 'lastNode',
      ...params,
    }, `Webhook-${path}`);
  }

  /**
   * Add a manual trigger
   */
  addManualTrigger(): this {
    return this.addTrigger('n8n-nodes-base.manualTrigger', {}, 'Manual Trigger');
  }

  /**
   * Add a schedule trigger
   */
  addScheduleTrigger(rule: Record<string, unknown>): this {
    return this.addTrigger('n8n-nodes-base.scheduleTrigger', { rule }, 'Schedule');
  }

  /**
   * Add an action node
   */
  addNode(type: string, params: Record<string, unknown> = {}, name?: string): this {
    const node: N8nNode = {
      id: nanoid(10),
      name: name || `${type.split('.').pop()}-${nanoid(4)}`,
      type,
      typeVersion: 1,
      position: [this.nodes.length * 200, 300],
      parameters: params,
    };
    this.nodes.push(node);

    // Auto-connect to previous node if exists
    if (this.nodes.length > 1) {
      const prevNode = this.nodes[this.nodes.length - 2];
      this.connect(prevNode.name, node.name);
    }

    return this;
  }

  /**
   * Add an HTTP request node
   */
  addHttpRequest(url: string, method: string = 'GET', options: Record<string, unknown> = {}): this {
    return this.addNode('n8n-nodes-base.httpRequest', {
      url,
      method,
      ...options,
    }, `HTTP-${method}-${nanoid(4)}`);
  }

  /**
   * Add a code (function) node
   */
  addCode(code: string, name?: string): this {
    return this.addNode('n8n-nodes-base.code', {
      language: 'javaScript',
      jsCode: code,
    }, name || `Code-${nanoid(4)}`);
  }

  /**
   * Add an IF node
   */
  addIf(condition: Record<string, unknown>, name?: string): this {
    return this.addNode('n8n-nodes-base.if', condition, name || `If-${nanoid(4)}`);
  }

  /**
   * Add a Set node (data transformation)
   */
  addSet(values: Record<string, unknown>, name?: string): this {
    return this.addNode('n8n-nodes-base.set', {
      mode: 'manual',
      assignments: { assignments: Object.entries(values).map(([key, value]) => ({
        id: nanoid(8),
        name: key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        type: typeof value === 'number' ? 'number' : 'string',
      }))},
    }, name || `Set-${nanoid(4)}`);
  }

  /**
   * Add a Merge node
   */
  addMerge(mode: string = 'append', name?: string): this {
    return this.addNode('n8n-nodes-base.merge', { mode }, name || `Merge-${nanoid(4)}`);
  }

  /**
   * Add a Switch node (multi-path routing)
   */
  addSwitch(rules: Array<{ value: string; output: number }>, name?: string): this {
    return this.addNode('n8n-nodes-base.switch', {
      rules: { rules: rules.map((r, i) => ({ ...r, output: i })) },
    }, name || `Switch-${nanoid(4)}`);
  }

  /**
   * Add a Wait node
   */
  addWait(duration: number, unit: string = 'seconds'): this {
    return this.addNode('n8n-nodes-base.wait', {
      amount: duration,
      unit,
    }, `Wait-${duration}${unit[0]}`);
  }

  /**
   * Add an Error Trigger
   */
  addErrorTrigger(): this {
    return this.addTrigger('n8n-nodes-base.errorTrigger', {}, 'Error Handler');
  }

  /**
   * Add a Respond to Webhook node
   */
  addRespondToWebhook(data: Record<string, unknown> = {}): this {
    return this.addNode('n8n-nodes-base.respondToWebhook', {
      respondWith: 'json',
      responseBody: JSON.stringify(data),
    }, 'Respond');
  }

  /**
   * Connect two nodes
   */
  connect(from: string, to: string, outputType: string = 'main', outputIndex: number = 0): this {
    if (!this.connections[from]) {
      this.connections[from] = {};
    }
    if (!this.connections[from][outputType]) {
      this.connections[from][outputType] = [];
    }
    while (this.connections[from][outputType].length <= outputIndex) {
      this.connections[from][outputType].push([]);
    }
    this.connections[from][outputType][outputIndex].push({
      node: to,
      type: 'main',
      index: 0,
    });
    return this;
  }

  /**
   * Build the final workflow
   */
  build(): Partial<N8nWorkflow> {
    return {
      ...this.workflow,
      nodes: this.nodes,
      connections: this.connections,
    };
  }

  /**
   * Build and return as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }
}

/**
 * Quick builder functions for common patterns
 */
export const Patterns = {
  /**
   * Simple webhook → process → respond
   */
  webhookPipeline(
    path: string,
    processingCode: string,
    name?: string
  ): Partial<N8nWorkflow> {
    return new WorkflowBuilder(name)
      .addWebhook(path)
      .addCode(processingCode, 'Process')
      .addRespondToWebhook()
      .build();
  },

  /**
   * Scheduled data fetcher
   */
  scheduledFetcher(
    schedule: Record<string, unknown>,
    url: string,
    transformCode: string,
    name?: string
  ): Partial<N8nWorkflow> {
    return new WorkflowBuilder(name)
      .addScheduleTrigger(schedule)
      .addHttpRequest(url)
      .addCode(transformCode, 'Transform')
      .build();
  },

  /**
   * Webhook with conditional branching
   */
  webhookConditional(
    path: string,
    condition: Record<string, unknown>,
    trueCode: string,
    falseCode: string,
    name?: string
  ): Partial<N8nWorkflow> {
    const builder = new WorkflowBuilder(name);
    const webhookNode = `Webhook-${path}`;
    const ifNode = 'Condition';
    const trueNode = 'True-Branch';
    const falseNode = 'False-Branch';

    builder
      .addWebhook(path)
      .addIf(condition, ifNode)
      .addCode(trueCode, trueNode)
      .addCode(falseCode, falseNode);

    const workflow = builder.build();
    // Manual connections for branching
    workflow.connections = {
      ...workflow.connections,
      [ifNode]: {
        main: [
          [{ node: trueNode, type: 'main', index: 0 }],
          [{ node: falseNode, type: 'main', index: 0 }],
        ],
      },
    };

    return workflow;
  },

  /**
   * Agent-style workflow: receive goal → process → loop if needed
   */
  agentLoop(
    webhookPath: string,
    goalProcessingCode: string,
    actionCode: string,
    evaluationCode: string,
    name?: string
  ): Partial<N8nWorkflow> {
    return new WorkflowBuilder(name)
      .addWebhook(webhookPath)
      .addCode(goalProcessingCode, 'Parse-Goal')
      .addCode(actionCode, 'Execute-Action')
      .addCode(evaluationCode, 'Evaluate')
      .addRespondToWebhook()
      .build();
  },
};
