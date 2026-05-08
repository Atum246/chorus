/**
 * 🎵 Chorus — REST API Server
 * HTTP API for Chorus agents
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { childLogger } from '../core/logger.js';
import { AgentManager } from '../agent/index.js';
import { listProviders, getProvider, getModelsForProvider } from '../llm/universal-connector.js';
import { TemplateManager } from '../n8n/templates.js';
import type { ChorusConfig } from '../types/index.js';

const logger = childLogger('api-server');

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: unknown, status: number = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res: ServerResponse, message: string, status: number = 400): void {
  sendJson(res, { error: message }, status);
}

// ═══════════════════════════════════════════════════════════════
// API Server
// ═══════════════════════════════════════════════════════════════

export class ChorusServer {
  private server: ReturnType<typeof createServer>;
  private manager: AgentManager;
  private templates: TemplateManager;
  private port: number;

  constructor(config: ChorusConfig, port: number = 3000) {
    this.port = port;
    this.manager = new AgentManager(config);
    this.templates = new TemplateManager();
    this.server = createServer(this.handleRequest.bind(this));
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.manager.initialize();

    this.server.listen(this.port, () => {
      logger.info({ port: this.port }, '🌐 Chorus API Server started');
      console.log(`\n🎵 Chorus API Server running on http://localhost:${this.port}`);
      console.log('\nEndpoints:');
      console.log('  POST /api/agents          — Create agent');
      console.log('  GET  /api/agents          — List agents');
      console.log('  POST /api/agents/:id/run  — Run agent');
      console.log('  GET  /api/agents/:id      — Get agent state');
      console.log('  GET  /api/workflows       — List n8n workflows');
      console.log('  GET  /api/templates       — List workflow templates');
      console.log('  POST /api/templates/:id   — Build workflow from template');
      console.log('  GET  /api/providers       — List LLM providers');
      console.log('  GET  /api/memory/stats    — Memory statistics');
      console.log('  GET  /api/health          — Health check');
      console.log();
    });
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const method = req.method || 'GET';
    const path = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    logger.debug({ method, path }, 'Request');

    try {
      // Route matching
      if (path === '/api/health' && method === 'GET') {
        return sendJson(res, { status: 'ok', timestamp: new Date().toISOString() });
      }

      if (path === '/api/agents' && method === 'GET') {
        const agents = this.manager.listAgents();
        return sendJson(res, { agents });
      }

      if (path === '/api/agents' && method === 'POST') {
        const body = await parseBody(req);
        const agent = await this.manager.createAgent(
          body.name as string || 'API Agent',
          {
            description: body.description as string,
            persona: body.persona as string,
            goals: body.goals as string[],
          }
        );
        return sendJson(res, { agent }, 201);
      }

      // Agent by ID
      const agentMatch = path.match(/^\/api\/agents\/([^/]+)$/);
      if (agentMatch && method === 'GET') {
        const agentId = agentMatch[1];
        try {
          const state = this.manager.getState(agentId);
          const definition = this.manager.getDefinition(agentId);
          return sendJson(res, { state, definition });
        } catch {
          return sendError(res, 'Agent not found', 404);
        }
      }

      // Run agent
      const runMatch = path.match(/^\/api\/agents\/([^/]+)\/run$/);
      if (runMatch && method === 'POST') {
        const agentId = runMatch[1];
        const body = await parseBody(req);
        const goal = body.goal as string;

        if (!goal) {
          return sendError(res, 'Missing "goal" in request body');
        }

        try {
          const result = await this.manager.run(agentId, goal);
          return sendJson(res, { result });
        } catch (error) {
          return sendError(res, error instanceof Error ? error.message : 'Execution failed', 500);
        }
      }

      // Quick run (create + run in one step)
      if (path === '/api/run' && method === 'POST') {
        const body = await parseBody(req);
        const goal = body.goal as string;

        if (!goal) {
          return sendError(res, 'Missing "goal" in request body');
        }

        const { agentId, result } = await this.manager.runQuick(goal, {
          name: body.name as string,
          persona: body.persona as string,
        });

        return sendJson(res, { agentId, result });
      }

      // Workflows
      if (path === '/api/workflows' && method === 'GET') {
        const n8n = this.manager.getN8nClient();
        if (!n8n) {
          return sendError(res, 'n8n not configured', 503);
        }

        const { workflows } = await n8n.listWorkflows();
        return sendJson(res, { workflows });
      }

      // Templates
      if (path === '/api/templates' && method === 'GET') {
        const category = url.searchParams.get('category') || undefined;
        const templates = this.templates.list(category).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          tags: t.tags,
          parameters: t.parameters,
        }));
        return sendJson(res, { templates });
      }

      const templateMatch = path.match(/^\/api\/templates\/([^/]+)$/);
      if (templateMatch && method === 'POST') {
        const templateId = templateMatch[1];
        const body = await parseBody(req);

        try {
          const workflow = this.templates.build(templateId, body.params as Record<string, unknown>);
          return sendJson(res, { workflow });
        } catch (error) {
          return sendError(res, error instanceof Error ? error.message : 'Template build failed');
        }
      }

      // Providers
      if (path === '/api/providers' && method === 'GET') {
        const providers = listProviders().map(p => ({
          id: p.id,
          name: p.name,
          models: p.models,
          supportsStreaming: p.supportsStreaming,
          supportsToolCalling: p.supportsToolCalling,
          supportsVision: p.supportsVision,
          costPer1kInput: p.costPer1kInput,
          costPer1kOutput: p.costPer1kOutput,
        }));
        return sendJson(res, { providers });
      }

      const providerMatch = path.match(/^\/api\/providers\/([^/]+)$/);
      if (providerMatch && method === 'GET') {
        const provider = getProvider(providerMatch[1]);
        if (!provider) {
          return sendError(res, 'Provider not found', 404);
        }
        return sendJson(res, { provider });
      }

      const providerModelsMatch = path.match(/^\/api\/providers\/([^/]+)\/models$/);
      if (providerModelsMatch && method === 'GET') {
        const models = getModelsForProvider(providerModelsMatch[1]);
        return sendJson(res, { models });
      }

      // Memory
      if (path === '/api/memory/stats' && method === 'GET') {
        const stats = await this.manager.getMemoryStats();
        return sendJson(res, { stats });
      }

      // Not found
      sendError(res, `Not found: ${method} ${path}`, 404);
    } catch (error) {
      logger.error({ error, method, path }, 'Request error');
      sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.server.close();
    await this.manager.close();
    logger.info('Server stopped');
  }
}
