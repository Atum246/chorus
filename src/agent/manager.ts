/**
 * 🎵 Chorus — Agent Manager
 * Manages multiple agent instances and their lifecycle
 */

import { nanoid } from 'nanoid';
import { childLogger } from '../core/logger.js';
import { eventBus } from '../core/events.js';
import { AgentEngine, type AgentResult } from './engine.js';
import { LLMProvider } from '../llm/index.js';
import { MemoryStore } from '../memory/index.js';
import { ToolRegistry } from '../tools/index.js';
import { N8nClient } from '../n8n/index.js';
import type {
  AgentDefinition,
  AgentState,
  ChorusConfig,
  AgentMemoryConfig,
} from '../types/index.js';

const logger = childLogger('agent-manager');

// ═══════════════════════════════════════════════════════════════
// Agent Manager
// ═══════════════════════════════════════════════════════════════

export class AgentManager {
  private agents: Map<string, AgentEngine> = new Map();
  private definitions: Map<string, AgentDefinition> = new Map();
  private config: ChorusConfig;
  private llm: LLMProvider;
  private memory: MemoryStore;
  private tools: ToolRegistry;
  private n8nClient?: N8nClient;

  constructor(config: ChorusConfig) {
    this.config = config;

    // Initialize shared services
    this.llm = new LLMProvider(config.llm);
    this.memory = new MemoryStore(config.memory);
    this.tools = new ToolRegistry();

    // Initialize n8n client
    if (config.n8n.apiKey) {
      this.n8nClient = new N8nClient(config.n8n);
      logger.info('n8n client initialized');
    }
  }

  /**
   * Initialize the agent manager
   */
  async initialize(): Promise<void> {
    await this.memory.initialize();
    logger.info('Agent manager initialized');
  }

  /**
   * Create a new agent
   */
  async createAgent(
    name: string,
    options: {
      description?: string;
      persona?: string;
      goals?: string[];
      tools?: string[];
      workflows?: AgentDefinition['workflows'];
      memory?: Partial<AgentMemoryConfig>;
      guardrails?: ChorusConfig['guardrails'];
    } = {}
  ): Promise<AgentDefinition> {
    const definition: AgentDefinition = {
      id: `agent-${nanoid(8)}`,
      name,
      description: options.description || `Agent: ${name}`,
      persona: options.persona || this.config.agent.defaultPersona,
      goals: options.goals || [],
      tools: options.tools || this.tools.getNames(),
      workflows: options.workflows || [],
      memory: {
        useShortTerm: options.memory?.useShortTerm ?? this.config.agent.enableMemory,
        useLongTerm: options.memory?.useLongTerm ?? this.config.agent.enableMemory,
        useEpisodic: options.memory?.useEpisodic ?? true,
        namespace: options.memory?.namespace || `agent-${nanoid(4)}`,
      },
      guardrails: options.guardrails || this.config.guardrails,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.definitions.set(definition.id, definition);

    eventBus.emitChorus({
      type: 'agent:created',
      agentId: definition.id,
      timestamp: new Date().toISOString(),
      data: { name, id: definition.id },
      severity: 'info',
    });

    logger.info({ id: definition.id, name }, 'Agent created');
    return definition;
  }

  /**
   * Get or create an agent engine
   */
  private getEngine(agentId: string): AgentEngine {
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId)!;
    }

    const definition = this.definitions.get(agentId);
    if (!definition) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const guardrails = { ...this.config.guardrails, ...definition.guardrails };

    const engine = new AgentEngine(
      definition,
      this.llm,
      this.memory,
      this.tools,
      guardrails,
      this.n8nClient
    );

    this.agents.set(agentId, engine);
    return engine;
  }

  /**
   * Process a goal with an agent
   */
  async run(agentId: string, goal: string): Promise<AgentResult> {
    const engine = this.getEngine(agentId);
    return engine.processGoal(goal);
  }

  /**
   * Run with a new agent (convenience method)
   */
  async runQuick(
    goal: string,
    options: {
      name?: string;
      persona?: string;
      maxSteps?: number;
    } = {}
  ): Promise<{ agentId: string; result: AgentResult }> {
    const agent = await this.createAgent(options.name || 'Quick Agent', {
      persona: options.persona,
      goals: [goal],
    });

    const result = await this.run(agent.id, goal);
    return { agentId: agent.id, result };
  }

  /**
   * Get agent state
   */
  getState(agentId: string): AgentState {
    return this.getEngine(agentId).getState();
  }

  /**
   * Get agent definition
   */
  getDefinition(agentId: string): AgentDefinition | undefined {
    return this.definitions.get(agentId);
  }

  /**
   * List all agents
   */
  listAgents(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Delete an agent
   */
  deleteAgent(agentId: string): boolean {
    this.agents.delete(agentId);
    return this.definitions.delete(agentId);
  }

  /**
   * Get shared services
   */
  getLLM(): LLMProvider { return this.llm; }
  getMemory(): MemoryStore { return this.memory; }
  getTools(): ToolRegistry { return this.tools; }
  getN8nClient(): N8nClient | undefined { return this.n8nClient; }

  /**
   * Get memory stats
   */
  async getMemoryStats() {
    return this.memory.getStats();
  }

  /**
   * Close and cleanup
   */
  async close(): Promise<void> {
    await this.memory.close();
    logger.info('Agent manager closed');
  }
}
