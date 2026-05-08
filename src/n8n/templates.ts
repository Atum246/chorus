/**
 * 🎵 Chorus — Workflow Templates
 * Pre-built workflow patterns for common agent tasks
 */

import { WorkflowBuilder } from '../n8n/workflow-builder.js';
import type { N8nWorkflow } from '../types/index.js';

// ═══════════════════════════════════════════════════════════════
// Template Definition
// ═══════════════════════════════════════════════════════════════

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  build: (params: Record<string, unknown>) => Partial<N8nWorkflow>;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: unknown;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// Built-in Templates
// ═══════════════════════════════════════════════════════════════

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // 1. Webhook → AI Process → Respond
  {
    id: 'webhook-ai-processor',
    name: 'Webhook AI Processor',
    description: 'Receive webhook, process with AI, return results',
    category: 'ai',
    tags: ['webhook', 'ai', 'processor'],
    parameters: [
      { name: 'path', type: 'string', description: 'Webhook path', required: true, default: 'process' },
      { name: 'systemPrompt', type: 'string', description: 'AI system prompt', required: false, default: 'You are a helpful assistant.' },
    ],
    build: (params) => {
      const path = (params.path as string) || 'process';
      const systemPrompt = (params.systemPrompt as string) || 'You are a helpful assistant.';

      return new WorkflowBuilder(`AI Processor - ${path}`)
        .addWebhook(path)
        .addCode(`
          const input = $input.first().json;
          const body = input.body || input;
          const message = body.message || body.text || body.input || JSON.stringify(body);
          
          // Prepare for AI processing
          $output.item.json = {
            prompt: message,
            system: '${systemPrompt}',
            timestamp: new Date().toISOString(),
            source: 'webhook'
          };
        `, 'Prepare Input')
        .addHttpRequest('https://api.openai.com/v1/chat/completions', 'POST', {
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          body: {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: '={{$json.system}}' },
              { role: 'user', content: '={{$json.prompt}}' },
            ],
          },
        })
        .addCode(`
          const response = $input.first().json;
          const result = response.choices?.[0]?.message?.content || 'No response';
          
          $output.item.json = {
            success: true,
            result: result,
            model: response.model,
            usage: response.usage,
            timestamp: new Date().toISOString()
          };
        `, 'Format Response')
        .addRespondToWebhook()
        .build();
    },
  },

  // 2. Scheduled Data Pipeline
  {
    id: 'scheduled-data-pipeline',
    name: 'Scheduled Data Pipeline',
    description: 'Fetch data on schedule, transform, and store',
    category: 'data',
    tags: ['schedule', 'data', 'pipeline'],
    parameters: [
      { name: 'interval', type: 'string', description: 'Schedule interval', required: false, default: '1h' },
      { name: 'sourceUrl', type: 'string', description: 'Data source URL', required: true },
      { name: 'transformScript', type: 'string', description: 'JavaScript transform code', required: false, default: 'return $input;' },
    ],
    build: (params) => {
      const sourceUrl = params.sourceUrl as string;
      const transformScript = (params.transformScript as string) || 'return $input;';

      return new WorkflowBuilder('Data Pipeline')
        .addScheduleTrigger({ interval: [{ field: 'hours', hoursInterval: 1 }] })
        .addHttpRequest(sourceUrl)
        .addCode(`
          const data = $input.all();
          const transformed = data.map(item => {
            ${transformScript}
            return item;
          });
          $output.item.json = { data: transformed, fetchedAt: new Date().toISOString() };
        `, 'Transform')
        .addCode(`
          const data = $input.first().json;
          // Store or forward data
          $output.item.json = { 
            success: true, 
            records: Array.isArray(data.data) ? data.data.length : 1,
            storedAt: new Date().toISOString()
          };
        `, 'Store')
        .build();
    },
  },

  // 3. Multi-Step Agent Loop
  {
    id: 'agent-loop',
    name: 'Agent Loop',
    description: 'Webhook-triggered agent with goal planning and execution loop',
    category: 'ai',
    tags: ['agent', 'loop', 'planning'],
    parameters: [
      { name: 'path', type: 'string', description: 'Webhook path', required: true, default: 'agent' },
      { name: 'maxIterations', type: 'number', description: 'Max loop iterations', required: false, default: 10 },
    ],
    build: (params) => {
      const path = (params.path as string) || 'agent';
      const maxIter = (params.maxIterations as number) || 10;

      return new WorkflowBuilder(`Agent Loop - ${path}`)
        .addWebhook(path)
        .addCode(`
          const body = $input.first().json.body || $input.first().json;
          const goal = body.goal || body.message || body.task;
          
          $output.item.json = {
            goal: goal,
            status: 'planning',
            iteration: 0,
            maxIterations: ${maxIter},
            history: [],
            startedAt: new Date().toISOString()
          };
        `, 'Initialize')
        .addCode(`
          const state = $input.first().json;
          
          // Plan next action based on goal and history
          const planPrompt = state.history.length === 0
            ? \`Create a plan to achieve: \${state.goal}. List the first step.\`
            : \`Goal: \${state.goal}\\nHistory: \${JSON.stringify(state.history)}\\nWhat's the next step?\`;
          
          $output.item.json = {
            ...state,
            planPrompt: planPrompt,
            status: 'planning'
          };
        `, 'Plan')
        .addHttpRequest('https://api.openai.com/v1/chat/completions', 'POST', {
          body: {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: '={{$json.planPrompt}}' }],
          },
        })
        .addCode(`
          const aiResponse = $input.first().json;
          const state = $input.first().json;
          const action = aiResponse.choices?.[0]?.message?.content || 'No action';
          
          const updatedHistory = [...(state.history || []), { 
            iteration: state.iteration,
            action: action,
            timestamp: new Date().toISOString()
          }];
          
          const nextIteration = state.iteration + 1;
          const isComplete = nextIteration >= state.maxIterations || action.toLowerCase().includes('complete');
          
          $output.item.json = {
            goal: state.goal,
            iteration: nextIteration,
            maxIterations: state.maxIterations,
            history: updatedHistory,
            currentAction: action,
            status: isComplete ? 'completed' : 'executing',
            result: isComplete ? action : null
          };
        `, 'Execute & Evaluate')
        .addRespondToWebhook()
        .build();
    },
  },

  // 4. Error Handler Workflow
  {
    id: 'error-handler',
    name: 'Error Handler',
    description: 'Global error handler with notification',
    category: 'system',
    tags: ['error', 'handler', 'notification'],
    parameters: [
      { name: 'notifyEmail', type: 'string', description: 'Notification email', required: false },
      { name: 'webhookUrl', type: 'string', description: 'Notification webhook URL', required: false },
    ],
    build: (params) => {
      const builder = new WorkflowBuilder('Error Handler')
        .addErrorTrigger()
        .addCode(`
          const error = $input.first().json;
          const errorMessage = error.message || error.error || 'Unknown error';
          const workflowName = error.workflow?.name || 'Unknown';
          const executionId = error.execution?.id || 'Unknown';
          
          $output.item.json = {
            error: errorMessage,
            workflow: workflowName,
            executionId: executionId,
            timestamp: new Date().toISOString(),
            severity: errorMessage.includes('critical') ? 'critical' : 'error'
          };
        `, 'Parse Error');

      if (params.webhookUrl) {
        builder.addHttpRequest(params.webhookUrl as string, 'POST', {
          body: {
            text: '={{$json.severity.toUpperCase()}} Error in {{$json.workflow}}: {{$json.error}}',
            executionId: '={{$json.executionId}}',
          },
        });
      }

      return builder.build();
    },
  },

  // 5. Data Sync Between Services
  {
    id: 'data-sync',
    name: 'Data Sync',
    description: 'Sync data between two services on schedule',
    category: 'integration',
    tags: ['sync', 'data', 'integration'],
    parameters: [
      { name: 'sourceUrl', type: 'string', description: 'Source API URL', required: true },
      { name: 'targetUrl', type: 'string', description: 'Target API URL', required: true },
      { name: 'syncInterval', type: 'number', description: 'Sync interval in minutes', required: false, default: 60 },
    ],
    build: (params) => {
      const sourceUrl = params.sourceUrl as string;
      const targetUrl = params.targetUrl as string;

      return new WorkflowBuilder('Data Sync')
        .addScheduleTrigger({ interval: [{ field: 'minutes', minutesInterval: params.syncInterval || 60 }] })
        .addHttpRequest(sourceUrl)
        .addCode(`
          const sourceData = $input.first().json;
          const records = Array.isArray(sourceData) ? sourceData : sourceData.data || [sourceData];
          
          $output.item.json = {
            records: records,
            count: records.length,
            fetchedAt: new Date().toISOString()
          };
        `, 'Prepare Data')
        .addHttpRequest(targetUrl, 'POST', {
          body: '={{$json.records}}',
        })
        .addCode(`
          const result = $input.first().json;
          $output.item.json = {
            success: true,
            synced: $json.count,
            result: result,
            syncedAt: new Date().toISOString()
          };
        `, 'Confirm Sync')
        .build();
    },
  },

  // 6. Chatbot with Memory
  {
    id: 'chatbot-memory',
    name: 'Chatbot with Memory',
    description: 'AI chatbot that remembers conversation history',
    category: 'ai',
    tags: ['chatbot', 'memory', 'conversation'],
    parameters: [
      { name: 'path', type: 'string', description: 'Webhook path', required: false, default: 'chat' },
    ],
    build: (params) => {
      const path = (params.path as string) || 'chat';

      return new WorkflowBuilder(`Chatbot - ${path}`)
        .addWebhook(path)
        .addCode(`
          const body = $input.first().json.body || $input.first().json;
          const message = body.message || body.text || '';
          const sessionId = body.sessionId || body.session || 'default';
          
          // In production, load from database
          const history = body.history || [];
          
          const messages = [
            { role: 'system', content: 'You are a helpful assistant with memory of the conversation.' },
            ...history.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
          ];
          
          $output.item.json = {
            messages: messages,
            sessionId: sessionId,
            userMessage: message,
            timestamp: new Date().toISOString()
          };
        `, 'Prepare Messages')
        .addHttpRequest('https://api.openai.com/v1/chat/completions', 'POST', {
          body: {
            model: 'gpt-4o-mini',
            messages: '={{$json.messages}}',
          },
        })
        .addCode(`
          const response = $input.first().json;
          const reply = response.choices?.[0]?.message?.content || 'I could not process that.';
          
          $output.item.json = {
            reply: reply,
            sessionId: $json.sessionId,
            history: [
              ...($json.messages.slice(1) || []),
              { role: 'assistant', content: reply }
            ],
            model: response.model,
            usage: response.usage,
            timestamp: new Date().toISOString()
          };
        `, 'Generate Response')
        .addRespondToWebhook()
        .build();
    },
  },

  // 7. Monitoring & Alerting
  {
    id: 'monitor-alert',
    name: 'Monitor & Alert',
    description: 'Monitor a service endpoint and alert on failures',
    category: 'monitoring',
    tags: ['monitor', 'alert', 'health'],
    parameters: [
      { name: 'targetUrl', type: 'string', description: 'URL to monitor', required: true },
      { name: 'interval', type: 'number', description: 'Check interval in minutes', required: false, default: 5 },
      { name: 'alertWebhook', type: 'string', description: 'Alert webhook URL', required: true },
    ],
    build: (params) => {
      const targetUrl = params.targetUrl as string;
      const alertWebhook = params.alertWebhook as string;

      return new WorkflowBuilder('Monitor & Alert')
        .addScheduleTrigger({ interval: [{ field: 'minutes', minutesInterval: params.interval || 5 }] })
        .addHttpRequest(targetUrl, 'GET', { timeout: 10000 })
        .addCode(`
          const response = $input.first().json;
          const isHealthy = response.statusCode >= 200 && response.statusCode < 400;
          
          $output.item.json = {
            healthy: isHealthy,
            statusCode: response.statusCode,
            responseTime: response.responseTime || 0,
            url: '${targetUrl}',
            checkedAt: new Date().toISOString()
          };
        `, 'Check Health')
        .addCode(`
          const status = $input.first().json;
          
          if (!status.healthy) {
            // Send alert
            $output.item.json = {
              alert: true,
              message: \`🚨 Service DOWN: \${status.url} returned \${status.statusCode}\`,
              ...status
            };
          } else {
            $output.item.json = { alert: false, ...status };
          }
        `, 'Evaluate')
        .addHttpRequest(alertWebhook, 'POST', {
          body: '={{$json.alert ? { text: $json.message, severity: "critical" } : {}}}',
        })
        .build();
    },
  },

  // 8. Content Generator
  {
    id: 'content-generator',
    name: 'Content Generator',
    description: 'Generate content (blog, social, email) with AI',
    category: 'ai',
    tags: ['content', 'generator', 'marketing'],
    parameters: [
      { name: 'contentType', type: 'string', description: 'Content type (blog, tweet, email)', required: true, default: 'blog' },
      { name: 'path', type: 'string', description: 'Webhook path', required: false, default: 'generate' },
    ],
    build: (params) => {
      const contentType = (params.contentType as string) || 'blog';
      const path = (params.path as string) || 'generate';

      const prompts: Record<string, string> = {
        blog: 'Write a comprehensive, engaging blog post about the given topic. Include headings, subheadings, and a conclusion.',
        tweet: 'Write a compelling tweet (max 280 chars) about the topic. Include relevant hashtags.',
        email: 'Write a professional email about the given topic. Include subject line, greeting, body, and signature.',
        description: 'Write a compelling product description that highlights key features and benefits.',
      };

      return new WorkflowBuilder(`Content Generator - ${contentType}`)
        .addWebhook(path)
        .addCode(`
          const body = $input.first().json.body || $input.first().json;
          const topic = body.topic || body.subject || body.message;
          const tone = body.tone || 'professional';
          const length = body.length || 'medium';
          
          $output.item.json = {
            topic: topic,
            tone: tone,
            length: length,
            contentType: '${contentType}',
            prompt: \`${prompts[contentType] || prompts.blog}\\n\\nTopic: \${topic}\\nTone: \${tone}\\nLength: \${length}\`,
            timestamp: new Date().toISOString()
          };
        `, 'Prepare')
        .addHttpRequest('https://api.openai.com/v1/chat/completions', 'POST', {
          body: {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: '={{$json.prompt}}' }],
          },
        })
        .addCode(`
          const response = $input.first().json;
          const content = response.choices?.[0]?.message?.content || 'Failed to generate content';
          
          $output.item.json = {
            success: true,
            content: content,
            contentType: '${contentType}',
            wordCount: content.split(/\\s+/).length,
            model: response.model,
            timestamp: new Date().toISOString()
          };
        `, 'Generate')
        .addRespondToWebhook()
        .build();
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// Template Manager
// ═══════════════════════════════════════════════════════════════

export class TemplateManager {
  private templates: Map<string, WorkflowTemplate> = new Map();

  constructor() {
    // Register built-in templates
    for (const template of WORKFLOW_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Get a template by ID
   */
  get(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * List all templates
   */
  list(category?: string): WorkflowTemplate[] {
    const all = Array.from(this.templates.values());
    return category ? all.filter(t => t.category === category) : all;
  }

  /**
   * Get categories
   */
  getCategories(): string[] {
    const categories = new Set(Array.from(this.templates.values()).map(t => t.category));
    return Array.from(categories);
  }

  /**
   * Build a workflow from template
   */
  build(id: string, params: Record<string, unknown> = {}): Partial<N8nWorkflow> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required && !(param.name in params) && param.default === undefined) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
    }

    // Apply defaults
    const fullParams = { ...params };
    for (const param of template.parameters) {
      if (!(param.name in fullParams) && param.default !== undefined) {
        fullParams[param.name] = param.default;
      }
    }

    return template.build(fullParams);
  }

  /**
   * Register a custom template
   */
  register(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }
}
