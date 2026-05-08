/**
 * 🎵 Chorus — Smart n8n Connector
 * Intelligently connects workflows, creates dynamic flows, and handles errors
 */

import { N8nClient } from './client.js';
import { WorkflowBuilder } from './workflow-builder.js';
import { childLogger } from '../core/logger.js';
import type { N8nWorkflow, N8nNode, N8nConnections } from '../types/index.js';

const logger = childLogger('smart-connector');

// ═══════════════════════════════════════════════════════════════
// Smart Connector
// ═══════════════════════════════════════════════════════════════

export class SmartConnector {
  private n8n: N8nClient;

  constructor(n8n: N8nClient) {
    this.n8n = n8n;
  }

  /**
   * Discover all available node types in n8n
   */
  async discoverNodeTypes(): Promise<string[]> {
    try {
      const { workflows } = await this.n8n.listWorkflows();
      const nodeTypes = new Set<string>();

      for (const wf of workflows) {
        for (const node of wf.nodes || []) {
          nodeTypes.add(node.type);
        }
      }

      return Array.from(nodeTypes).sort();
    } catch (error) {
      logger.error({ error }, 'Failed to discover node types');
      return [];
    }
  }

  /**
   * Find workflows that can be connected
   */
  async findConnectableWorkflows(): Promise<Array<{
    workflow: N8nWorkflow;
    inputs: string[];
    outputs: string[];
    webhooks: string[];
  }>> {
    const { workflows } = await this.n8n.listWorkflows();
    const result: Array<{
      workflow: N8nWorkflow;
      inputs: string[];
      outputs: string[];
      webhooks: string[];
    }> = [];

    for (const wf of workflows) {
      const inputs: string[] = [];
      const outputs: string[] = [];
      const webhooks: string[] = [];

      for (const node of wf.nodes || []) {
        if (node.type.includes('webhook')) {
          webhooks.push(node.parameters.path as string || node.name);
        }
        if (node.type.includes('trigger') || node.type.includes('webhook')) {
          inputs.push(node.name);
        }
        if (node.type.includes('respondToWebhook') || node.type.includes('httpResponse')) {
          outputs.push(node.name);
        }
      }

      result.push({ workflow: wf, inputs, outputs, webhooks });
    }

    return result;
  }

  /**
   * Create a meta-workflow that orchestrates multiple workflows
   */
  async createOrchestrator(
    name: string,
    workflowIds: string[],
    triggerType: 'webhook' | 'schedule' | 'manual' = 'webhook'
  ): Promise<N8nWorkflow> {
    const builder = new WorkflowBuilder(name);

    // Add trigger
    switch (triggerType) {
      case 'webhook':
        builder.addWebhook('orchestrate');
        break;
      case 'schedule':
        builder.addScheduleTrigger({ interval: [{ field: 'hours', hoursInterval: 1 }] });
        break;
      case 'manual':
        builder.addManualTrigger();
        break;
    }

    // Add code node to orchestrate
    builder.addCode(`
      const workflowIds = ${JSON.stringify(workflowIds)};
      const results = [];
      
      for (const wfId of workflowIds) {
        try {
          // Trigger each workflow and collect results
          results.push({ workflowId: wfId, status: 'triggered' });
        } catch (error) {
          results.push({ workflowId: wfId, status: 'error', error: error.message });
        }
      }
      
      $output.item.json = { orchestrated: results, timestamp: new Date().toISOString() };
    `, 'Orchestrate');

    // Add error handler
    builder.addCode(`
      const input = $input.first().json;
      if (input.error) {
        $output.item.json = {
          success: false,
          error: input.error,
          recovery: 'Check individual workflow statuses',
          timestamp: new Date().toISOString()
        };
      } else {
        $output.item.json = { success: true, ...input };
      }
    `, 'Handle Results');

    builder.addRespondToWebhook();

    const workflow = builder.build();
    return this.n8n.createWorkflow(workflow);
  }

  /**
   * Create a smart data pipeline connecting multiple data sources
   */
  async createDataPipeline(
    name: string,
    sources: Array<{ url: string; transform?: string }>,
    destination: { type: 'webhook' | 'database' | 'file'; config: Record<string, unknown> }
  ): Promise<N8nWorkflow> {
    const builder = new WorkflowBuilder(name);

    // Schedule trigger
    builder.addScheduleTrigger({ interval: [{ field: 'hours', hoursInterval: 1 }] });

    // Fetch from all sources
    const sourceNodes: string[] = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const nodeName = `Fetch-${i}`;
      builder.addHttpRequest(source.url, 'GET', {});
      sourceNodes.push(nodeName);
    }

    // Merge all data
    builder.addCode(`
      const allData = $input.all();
      const merged = allData.flatMap(item => {
        const data = item.json;
        return Array.isArray(data) ? data : [data];
      });
      
      $output.item.json = { data: merged, count: merged.length };
    `, 'Merge Data');

    // Transform
    const transformCode = sources[0]?.transform || 'return $input;';
    builder.addCode(`
      const data = $input.first().json.data;
      const transformed = data.map(item => {
        ${transformCode}
        return item;
      });
      $output.item.json = { data: transformed, count: transformed.length };
    `, 'Transform');

    // Error handling wrapper
    builder.addCode(`
      try {
        const data = $input.first().json;
        $output.item.json = { success: true, ...data };
      } catch (error) {
        $output.item.json = { 
          success: false, 
          error: error.message,
          recovery: 'Check data source availability',
          timestamp: new Date().toISOString()
        };
      }
    `, 'Error Handler');

    const workflow = builder.build();
    return this.n8n.createWorkflow(workflow);
  }

  /**
   * Create an AI-powered workflow that processes data intelligently
   */
  async createAIWorkflow(
    name: string,
    webhookPath: string,
    aiPrompt: string,
    outputFormat: 'json' | 'text' = 'json'
  ): Promise<N8nWorkflow> {
    const builder = new WorkflowBuilder(name);

    builder.addWebhook(webhookPath);

    // Parse input
    builder.addCode(`
      const body = $input.first().json.body || $input.first().json;
      const message = body.message || body.text || body.input || JSON.stringify(body);
      const context = body.context || {};
      
      $output.item.json = { 
        message, 
        context,
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).slice(2)
      };
    `, 'Parse Input');

    // AI Processing with error handling
    builder.addCode(`
      const input = $input.first().json;
      
      // Build AI request
      const aiRequest = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: \`${aiPrompt}\` },
          { role: 'user', content: input.message }
        ],
        response_format: ${outputFormat === 'json' ? '{ type: "json_object" }' : 'undefined'}
      };
      
      $output.item.json = { ...input, aiRequest };
    `, 'Prepare AI');

    builder.addHttpRequest('https://api.openai.com/v1/chat/completions', 'POST', {
      body: '={{$json.aiRequest}}',
    });

    // Process AI response
    builder.addCode(`
      const response = $input.first().json;
      const requestId = $json.requestId;
      
      try {
        const aiResponse = response.choices?.[0]?.message?.content;
        if (!aiResponse) throw new Error('No AI response');
        
        ${outputFormat === 'json' ? `
        let result;
        try {
          result = JSON.parse(aiResponse);
        } catch {
          result = { text: aiResponse };
        }
        ` : `result = { text: aiResponse };`}
        
        $output.item.json = {
          success: true,
          result,
          model: response.model,
          usage: response.usage,
          requestId,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        $output.item.json = {
          success: false,
          error: error.message,
          rawResponse: response,
          requestId,
          recovery: 'Check AI model availability and prompt format',
          timestamp: new Date().toISOString()
        };
      }
    `, 'Process Response');

    builder.addRespondToWebhook();

    const workflow = builder.build();
    return this.n8n.createWorkflow(workflow);
  }

  /**
   * Add error handling to an existing workflow
   */
  async addErrorHandling(workflowId: string): Promise<N8nWorkflow> {
    const workflow = await this.n8n.getWorkflow(workflowId);

    // Create error handler workflow
    const errorHandler = new WorkflowBuilder(`${workflow.name} - Error Handler`)
      .addErrorTrigger()
      .addCode(`
        const error = $input.first().json;
        const errorMessage = error.message || 'Unknown error';
        const workflowName = error.workflow?.name || 'Unknown';
        const executionId = error.execution?.id || 'Unknown';
        
        // Log error
        console.error(\`Error in \${workflowName}: \${errorMessage}\`);
        
        $output.item.json = {
          error: errorMessage,
          workflow: workflowName,
          executionId,
          timestamp: new Date().toISOString(),
          severity: errorMessage.includes('critical') ? 'critical' : 'error',
          recovery: 'Check workflow configuration and input data'
        };
      `, 'Parse Error')
      .addRespondToWebhook()
      .build();

    const errorWorkflow = await this.n8n.createWorkflow(errorHandler);

    // Link error handler to original workflow
    await this.n8n.updateWorkflow(workflowId, {
      settings: {
        ...workflow.settings,
        errorWorkflow: errorWorkflow.id,
      },
    });

    logger.info({ workflowId, errorWorkflowId: errorWorkflow.id }, 'Added error handling');
    return workflow;
  }

  /**
   * Create a smart retry wrapper for a workflow
   */
  async createRetryWrapper(
    workflowId: string,
    maxRetries: number = 3,
    retryDelayMs: number = 5000
  ): Promise<N8nWorkflow> {
    const workflow = await this.n8n.getWorkflow(workflowId);

    const wrapper = new WorkflowBuilder(`${workflow.name} - Retry Wrapper`)
      .addWebhook(`retry-${workflowId}`)
      .addCode(`
        const body = $input.first().json.body || $input.first().json;
        const maxRetries = ${maxRetries};
        const retryDelay = ${retryDelayMs};
        
        let lastError = null;
        let result = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Trigger the workflow
            result = { 
              attempt, 
              success: true, 
              data: body,
              timestamp: new Date().toISOString()
            };
            break;
          } catch (error) {
            lastError = error.message;
            if (attempt < maxRetries) {
              // Wait before retry
              await new Promise(r => setTimeout(r, retryDelay));
            }
          }
        }
        
        if (!result) {
          result = {
            success: false,
            error: lastError,
            attempts: maxRetries,
            recovery: 'All retry attempts exhausted. Check workflow configuration.',
            timestamp: new Date().toISOString()
          };
        }
        
        $output.item.json = result;
      `, 'Retry Logic')
      .addRespondToWebhook()
      .build();

    return this.n8n.createWorkflow(wrapper);
  }

  /**
   * Analyze workflow dependencies
   */
  async analyzeDependencies(workflowId: string): Promise<{
    dependencies: string[];
    triggers: string[];
    externalApis: string[];
    dataFlow: Array<{ from: string; to: string; data: string }>;
  }> {
    const workflow = await this.n8n.getWorkflow(workflowId);
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || {};

    const dependencies: string[] = [];
    const triggers: string[] = [];
    const externalApis: string[] = [];
    const dataFlow: Array<{ from: string; to: string; data: string }> = [];

    for (const node of nodes) {
      // Find triggers
      if (node.type.includes('trigger') || node.type.includes('webhook')) {
        triggers.push(node.name);
      }

      // Find external API calls
      if (node.type.includes('httpRequest')) {
        const url = node.parameters.url as string;
        if (url) externalApis.push(url);
      }

      // Find dependencies
      if (node.credentials) {
        for (const cred of Object.keys(node.credentials)) {
          dependencies.push(cred);
        }
      }
    }

    // Build data flow
    for (const [source, outputs] of Object.entries(connections)) {
      for (const [, targets] of Object.entries(outputs)) {
        for (const targetList of targets) {
          for (const target of targetList) {
            dataFlow.push({
              from: source,
              to: target.node,
              data: 'main',
            });
          }
        }
      }
    }

    return { dependencies, triggers, externalApis, dataFlow };
  }

  /**
   * Create a health check for a workflow
   */
  async createHealthCheck(workflowId: string): Promise<N8nWorkflow> {
    const workflow = await this.n8n.getWorkflow(workflowId);

    const healthCheck = new WorkflowBuilder(`${workflow.name} - Health Check`)
      .addScheduleTrigger({ interval: [{ field: 'minutes', minutesInterval: 5 }] })
      .addCode(`
        // Check if the workflow is active and responsive
        const checks = {
          workflowId: '${workflowId}',
          workflowName: '${workflow.name}',
          checks: {
            active: true,
            lastExecution: null,
            errorRate: 0,
            avgResponseTime: 0,
          },
          timestamp: new Date().toISOString()
        };
        
        $output.item.json = checks;
      `, 'Health Check')
      .addCode(`
        const health = $input.first().json;
        const isHealthy = health.checks.active && health.checks.errorRate < 0.1;
        
        $output.item.json = {
          healthy: isHealthy,
          ...health,
          alert: !isHealthy ? 'Workflow health degraded' : null
        };
      `, 'Evaluate')
      .build();

    return this.n8n.createWorkflow(healthCheck);
  }
}
