#!/usr/bin/env node

/**
 * 🎵 Chorus — CLI
 * Command-line interface for the Chorus agent platform
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadConfig, getConfig } from '../core/config.js';
import { initLogger, getLogger } from '../core/logger.js';
import { eventBus } from '../core/events.js';
import { AgentManager } from '../agent/index.js';
import { ObservabilityManager } from '../observability/index.js';
import type { ChorusConfig } from '../types/index.js';

// ═══════════════════════════════════════════════════════════════
// Banner
// ═══════════════════════════════════════════════════════════════

function showBanner(): void {
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   🎵  C H O R U S                       ║
  ║   AI Agent Brain for n8n                 ║
  ║                                          ║
  ║   Turn workflows into autonomous agents  ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `));
}

// ═══════════════════════════════════════════════════════════════
// CLI Program
// ═══════════════════════════════════════════════════════════════

const program = new Command();

program
  .name('chorus')
  .description('🎵 Chorus — AI Agent Brain for n8n')
  .version('1.0.0')
  .option('-c, --config <path>', 'Config file path')
  .option('-v, --verbose', 'Verbose output');

// ═══════════════════════════════════════════════════════════════
// Init Command
// ═══════════════════════════════════════════════════════════════

program
  .command('init')
  .description('Initialize Chorus configuration')
  .action(async () => {
    showBanner();
    console.log(chalk.yellow('🔧 Let\'s set up Chorus!\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'n8nBaseUrl',
        message: 'n8n base URL:',
        default: 'http://localhost:5678',
      },
      {
        type: 'password',
        name: 'n8nApiKey',
        message: 'n8n API key:',
        mask: '*',
      },
      {
        type: 'list',
        name: 'llmProvider',
        message: 'LLM Provider:',
        choices: ['openai', 'anthropic', 'ollama', 'groq', 'together'],
        default: 'openai',
      },
      {
        type: 'password',
        name: 'llmApiKey',
        message: 'LLM API key:',
        mask: '*',
        when: (answers: any) => answers.llmProvider !== 'ollama',
      },
      {
        type: 'input',
        name: 'llmModel',
        message: 'LLM model:',
        default: (answers: { llmProvider: string }) => {
          const defaults: Record<string, string> = {
            openai: 'gpt-4o-mini',
            anthropic: 'claude-3-5-sonnet',
            ollama: 'llama3.1',
            groq: 'llama-3.1-70b-versatile',
            together: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
          };
          return defaults[answers.llmProvider] || 'gpt-4o-mini';
        },
      },
      {
        type: 'list',
        name: 'memoryBackend',
        message: 'Memory backend:',
        choices: ['sqlite', 'in-memory'],
        default: 'sqlite',
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'Log level:',
        choices: ['debug', 'info', 'warn', 'error'],
        default: 'info',
      },
    ]);

    const config: Partial<ChorusConfig> = {
      n8n: {
        baseUrl: answers.n8nBaseUrl,
        apiKey: answers.n8nApiKey,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      llm: {
        provider: answers.llmProvider,
        apiKey: answers.llmApiKey || 'ollama',
        model: answers.llmModel,
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        timeout: 60000,
        maxRetries: 3,
        streaming: true,
      },
      memory: {
        backend: answers.memoryBackend,
        sqlitePath: './data/chorus-memory.db',
        maxShortTermMessages: 50,
        maxLongTermEntries: 10000,
        ttlSeconds: 86400 * 7,
      },
      guardrails: {
        maxExecutionTimeMs: 300000,
        maxBudgetPerRun: 10,
        maxConcurrentRuns: 5,
        allowedDomains: [],
        blockedDomains: [],
        maxTokensPerTurn: 8192,
        requireApproval: [],
        rateLimits: {
          maxRequestsPerMinute: 60,
          maxTokensPerMinute: 100000,
          maxWorkflowRunsPerHour: 100,
        },
      },
      observability: {
        logLevel: answers.logLevel,
        logFormat: 'pretty',
        enableTracing: false,
        enableMetrics: false,
        metricsPort: 9090,
      },
      agent: {
        maxSteps: 25,
        maxReflections: 5,
        planningStrategy: 'plan-and-execute',
        enableMemory: true,
        enableReflection: true,
        enableSelfHealing: true,
      },
    };

    const configPath = 'chorus.config.yaml';
    writeFileSync(configPath, stringifyYaml(config), 'utf-8');

    // Create data directory
    const { mkdirSync } = await import('fs');
    mkdirSync('data', { recursive: true });

    console.log(chalk.green(`\n✅ Configuration saved to ${configPath}`));
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  1. Edit chorus.config.yaml if needed'));
    console.log(chalk.dim('  2. Run: chorus run "your goal here"'));
    console.log(chalk.dim('  3. Or start the server: chorus serve'));
  });

// ═══════════════════════════════════════════════════════════════
// Run Command
// ═══════════════════════════════════════════════════════════════

program
  .command('run <goal>')
  .description('Run an agent to achieve a goal')
  .option('-n, --name <name>', 'Agent name', 'Chorus Agent')
  .option('-p, --persona <persona>', 'Agent persona')
  .option('-s, --max-steps <n', 'Maximum steps', parseInt)
  .option('--no-memory', 'Disable memory')
  .option('--no-reflection', 'Disable reflection')
  .action(async (goal: string, options) => {
    showBanner();

    const spinner = ora('Initializing Chorus...').start();

    try {
      const config = loadConfig(program.opts().config);
      initLogger(config.observability);

      const manager = new AgentManager(config);
      await manager.initialize();

      spinner.succeed('Chorus initialized');

      console.log(chalk.cyan(`\n🎯 Goal: ${chalk.bold(goal)}\n`));

      const agentSpinner = ora('Agent is thinking...').start();

      // Set up event monitoring
      eventBus.onChorus('plan:created', (event) => {
        const steps = event.data.steps as number;
        agentSpinner.text = chalk.blue(`📝 Plan created: ${steps} steps`);
      });

      eventBus.onChorus('step:started', (event) => {
        const tool = event.data.tool as string;
        agentSpinner.text = chalk.blue(`⚡ Executing: ${tool || 'LLM reasoning'}`);
      });

      eventBus.onChorus('step:completed', (event) => {
        agentSpinner.text = chalk.green(`✅ Step completed`);
      });

      eventBus.onChorus('reflection:created', (event) => {
        agentSpinner.text = chalk.yellow(`🤔 Reflecting on progress...`);
      });

      const { agentId, result } = await manager.runQuick(goal, {
        name: options.name,
        persona: options.persona,
      });

      agentSpinner.stop();

      // Display results
      console.log(chalk.cyan('\n════════════════════════════════════════'));
      console.log(chalk.bold(result.success ? chalk.green('✅ GOAL ACHIEVED') : chalk.red('❌ GOAL FAILED')));
      console.log(chalk.cyan('════════════════════════════════════════\n'));

      console.log(chalk.white('📋 Summary:'));
      console.log(`   ${result.summary}\n`);

      console.log(chalk.white('📊 Stats:'));
      console.log(`   Steps: ${result.steps.length}`);
      console.log(`   Tokens: ${result.totalTokens.toLocaleString()}`);
      console.log(`   Cost: $${result.totalCost.toFixed(4)}`);
      console.log(`   Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

      if (result.lessons.length > 0) {
        console.log(chalk.white('\n💡 Lessons:'));
        for (const lesson of result.lessons) {
          console.log(`   • ${lesson}`);
        }
      }

      if (result.steps.length > 0) {
        console.log(chalk.white('\n📝 Steps:'));
        for (const step of result.steps) {
          const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
          console.log(`   ${icon} ${step.action}`);
          if (step.result?.error) {
            console.log(chalk.red(`      Error: ${step.result.error}`));
          }
        }
      }

      await manager.close();
    } catch (error) {
      spinner.fail('Failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// Agent Commands
// ═══════════════════════════════════════════════════════════════

const agentCmd = program
  .command('agent')
  .description('Manage agents');

agentCmd
  .command('list')
  .description('List all agents')
  .action(async () => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const agents = manager.listAgents();
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents found. Create one with: chorus agent create'));
    } else {
      console.log(chalk.cyan('\n🤖 Agents:\n'));
      for (const agent of agents) {
        console.log(`  ${chalk.bold(agent.name)} (${agent.id})`);
        console.log(`    ${agent.description}`);
        console.log(`    Goals: ${agent.goals.length} | Tools: ${agent.tools.length}`);
        console.log();
      }
    }

    await manager.close();
  });

agentCmd
  .command('create')
  .description('Create a new agent')
  .action(async () => {
    showBanner();

    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Agent name:' },
      { type: 'input', name: 'description', message: 'Description:' },
      { type: 'input', name: 'persona', message: 'Persona (how should the agent behave):' },
      { type: 'input', name: 'goals', message: 'Goals (comma-separated):' },
    ]);

    const agent = await manager.createAgent(answers.name, {
      description: answers.description,
      persona: answers.persona,
      goals: answers.goals.split(',').map((g: string) => g.trim()).filter(Boolean),
    });

    console.log(chalk.green(`\n✅ Agent created: ${agent.name} (${agent.id})`));
    await manager.close();
  });

// ═══════════════════════════════════════════════════════════════
// Workflow Commands
// ═══════════════════════════════════════════════════════════════

const workflowCmd = program
  .command('workflow')
  .description('Manage n8n workflows');

workflowCmd
  .command('list')
  .description('List n8n workflows')
  .option('-a, --active', 'Show only active workflows')
  .action(async (options) => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const n8n = manager.getN8nClient();
    if (!n8n) {
      console.log(chalk.red('n8n client not configured'));
      process.exit(1);
    }

    const spinner = ora('Fetching workflows...').start();

    try {
      const { workflows } = await n8n.listWorkflows({ active: options.active });
      spinner.stop();

      if (workflows.length === 0) {
        console.log(chalk.yellow('No workflows found.'));
      } else {
        console.log(chalk.cyan(`\n📋 Workflows (${workflows.length}):\n`));
        for (const wf of workflows) {
          const status = wf.active ? chalk.green('●') : chalk.gray('○');
          console.log(`  ${status} ${chalk.bold(wf.name)} (${wf.id})`);
          console.log(`    Nodes: ${wf.nodes?.length || 0}`);
          console.log();
        }
      }
    } catch (error) {
      spinner.fail('Failed to fetch workflows');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    }

    await manager.close();
  });

workflowCmd
  .command('test')
  .description('Test n8n connection')
  .action(async () => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const n8n = manager.getN8nClient();
    if (!n8n) {
      console.log(chalk.red('n8n client not configured'));
      process.exit(1);
    }

    const spinner = ora('Testing n8n connection...').start();
    const result = await n8n.testConnection();

    if (result.success) {
      spinner.succeed(`Connected to n8n (version: ${result.version})`);
    } else {
      spinner.fail(`Connection failed: ${result.error}`);
    }

    await manager.close();
  });

workflowCmd
  .command('analyze <workflowId>')
  .description('Analyze a workflow')
  .action(async (workflowId: string) => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const n8n = manager.getN8nClient();
    if (!n8n) {
      console.log(chalk.red('n8n client not configured'));
      process.exit(1);
    }

    const spinner = ora('Analyzing workflow...').start();

    try {
      const workflow = await n8n.getWorkflow(workflowId);
      const analysis = n8n.analyzeWorkflow(workflow);
      spinner.stop();

      console.log(chalk.cyan(`\n📊 Workflow Analysis: ${chalk.bold(workflow.name)}\n`));
      console.log(`  Nodes: ${analysis.nodeCount}`);
      console.log(`  Complexity: ${'█'.repeat(analysis.complexity)}${'░'.repeat(10 - analysis.complexity)} ${analysis.complexity}/10`);
      console.log(`  Has Webhooks: ${analysis.hasWebhooks ? '✅' : '❌'}`);
      console.log(`  Has Loops: ${analysis.hasLoops ? '✅' : '❌'}`);
      console.log(`  Est. Time: ${analysis.estimatedExecutionTimeMs}ms`);

      console.log(chalk.white('\n  Node Types:'));
      for (const type of analysis.nodeTypes) {
        console.log(`    • ${type}`);
      }

      console.log(chalk.white('\n  Execution Flow:'));
      for (const [from, tos] of analysis.executionGraph) {
        console.log(`    ${from} → ${tos.join(', ') || '(end)'}`);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    }

    await manager.close();
  });

// ═══════════════════════════════════════════════════════════════
// Memory Commands
// ═══════════════════════════════════════════════════════════════

const memoryCmd = program
  .command('memory')
  .description('Manage agent memory');

memoryCmd
  .command('stats')
  .description('Show memory statistics')
  .action(async () => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const stats = await manager.getMemoryStats();

    console.log(chalk.cyan('\n💾 Memory Statistics:\n'));
    console.log(`  Total Memories: ${stats.totalMemories}`);
    console.log(`  Total Conversations: ${stats.totalConversations}`);
    console.log(`  Total Episodes: ${stats.totalEpisodes}`);

    if (Object.keys(stats.byType).length > 0) {
      console.log(chalk.white('\n  By Type:'));
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`    ${type}: ${count}`);
      }
    }

    await manager.close();
  });

memoryCmd
  .command('search <query>')
  .description('Search memory')
  .option('-n, --namespace <ns>', 'Namespace filter')
  .option('-l, --limit <n', 'Limit results', parseInt, 10)
  .action(async (query: string, options) => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);
    const manager = new AgentManager(config);
    await manager.initialize();

    const memory = manager.getMemory();
    const results = await memory.search(query, options.namespace, options.limit);

    if (results.length === 0) {
      console.log(chalk.yellow('No memories found.'));
    } else {
      console.log(chalk.cyan(`\n🔍 Found ${results.length} memories:\n`));
      for (const entry of results) {
        console.log(`  [${entry.type}] ${entry.content.slice(0, 100)}`);
        console.log(`    Importance: ${entry.importance} | Accessed: ${entry.accessCount}x`);
        console.log();
      }
    }

    await manager.close();
  });

// ═══════════════════════════════════════════════════════════════
// Health Command
// ═══════════════════════════════════════════════════════════════

program
  .command('health')
  .description('Check system health')
  .action(async () => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);

    const obs = new ObservabilityManager();

    // Register health checks
    obs.health.registerCheck('n8n', async () => {
      try {
        const { N8nClient } = await import('../n8n/client.js');
        const client = new N8nClient(config.n8n);
        const result = await client.testConnection();
        return { status: result.success ? 'healthy' : 'unhealthy', message: result.error };
      } catch (error) {
        return { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    obs.health.registerCheck('llm', async () => {
      try {
        const { LLMProvider } = await import('../llm/provider.js');
        const provider = new LLMProvider(config.llm);
        return { status: 'healthy' };
      } catch (error) {
        return { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const spinner = ora('Running health checks...').start();
    const health = await obs.health.check();
    spinner.stop();

    const icon = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
    console.log(chalk.cyan(`\n${icon} Health Status: ${chalk.bold(health.status)}\n`));

    for (const [name, check] of Object.entries(health.checks)) {
      const checkIcon = check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${checkIcon} ${name}: ${check.status}${check.message ? ` (${check.message})` : ''}${check.latencyMs ? ` [${check.latencyMs}ms]` : ''}`);
    }

    console.log(chalk.dim(`\nTimestamp: ${health.timestamp}`));
  });

// ═══════════════════════════════════════════════════════════════
// Events Command
// ═══════════════════════════════════════════════════════════════

program
  .command('events')
  .description('Show recent events')
  .option('-l, --limit <n', 'Number of events', parseInt, 20)
  .option('-t, --type <type>', 'Filter by event type')
  .action(async (options) => {
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);

    const events = options.type
      ? eventBus.getRecentEvents(options.type as any, options.limit)
      : eventBus.getEventLog(options.limit);

    if (events.length === 0) {
      console.log(chalk.yellow('No events recorded.'));
    } else {
      console.log(chalk.cyan(`\n📡 Events (${events.length}):\n`));
      for (const event of events) {
        const severity = event.severity === 'error' ? chalk.red('ERROR') :
          event.severity === 'warn' ? chalk.yellow('WARN') :
            chalk.dim('INFO');
        console.log(`  ${severity} [${event.type}] ${event.agentId}`);
        if (Object.keys(event.data).length > 0) {
          console.log(chalk.dim(`    ${JSON.stringify(event.data).slice(0, 100)}`));
        }
      }
    }
  });

// ═══════════════════════════════════════════════════════════════
// Chat Command
// ═══════════════════════════════════════════════════════════════

program
  .command('chat')
  .description('Start interactive chat with an agent')
  .option('-n, --name <name>', 'Agent name', 'Chat Agent')
  .action(async (options) => {
    const { InteractiveChat } = await import('./chat.js');
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);

    const chat = new InteractiveChat(config);
    await chat.start(options.name);
    await chat.close();
  });

// ═══════════════════════════════════════════════════════════════
// Serve Command
// ═══════════════════════════════════════════════════════════════

program
  .command('serve')
  .description('Start the REST API server')
  .option('-p, --port <port>', 'Server port', parseInt, 3000)
  .action(async (options) => {
    showBanner();
    const config = loadConfig(program.opts().config);
    initLogger(config.observability);

    const { ChorusServer } = await import('./server.js');
    const server = new ChorusServer(config, options.port);
    await server.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down...'));
      await server.stop();
      process.exit(0);
    });
  });

// ═══════════════════════════════════════════════════════════════
// Provider Commands
// ═══════════════════════════════════════════════════════════════

const providerCmd = program
  .command('providers')
  .description('Manage LLM providers');

providerCmd
  .command('list')
  .description('List all supported LLM providers')
  .action(async () => {
    const { listProviders } = await import('../llm/universal-connector.js');
    const providers = listProviders();

    console.log(chalk.cyan('\n🌐 Supported LLM Providers:\n'));
    for (const p of providers) {
      const features: string[] = [];
      if (p.supportsStreaming) features.push('📡');
      if (p.supportsToolCalling) features.push('🔧');
      if (p.supportsVision) features.push('👁️');
      if (p.supportsJSON) features.push('📋');
      if (p.costPer1kInput === 0) features.push('🆓');

      console.log(`  ${chalk.bold(p.name)} (${p.id}) ${features.join(' ')}`);
      console.log(`    Models: ${p.models.slice(0, 3).join(', ')}${p.models.length > 3 ? '...' : ''}`);
      console.log(`    Context: ${(p.maxContextWindow / 1000).toFixed(0)}K | Cost: $${p.costPer1kInput}/$${p.costPer1kOutput} per 1K tokens`);
      console.log();
    }

    console.log(chalk.dim('Legend: 📡Streaming 🔧Tools 👁️Vision 📋JSON 🆓Free'));
  });

providerCmd
  .command('models <provider>')
  .description('List models for a provider')
  .action(async (providerId: string) => {
    const { getProvider, getModelsForProvider } = await import('../llm/universal-connector.js');
    const provider = getProvider(providerId);

    if (!provider) {
      console.log(chalk.red(`Provider not found: ${providerId}`));
      console.log(chalk.dim('Run "chorus providers list" to see available providers'));
      process.exit(1);
    }

    console.log(chalk.cyan(`\n📋 Models for ${provider.name}:\n`));
    for (const model of provider.models) {
      console.log(`  • ${model}`);
    }
    console.log();
  });

// ═══════════════════════════════════════════════════════════════
// Template Commands
// ═══════════════════════════════════════════════════════════════

const templateCmd = program
  .command('templates')
  .description('Manage workflow templates');

templateCmd
  .command('list')
  .description('List available workflow templates')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    const { TemplateManager } = await import('../n8n/templates.js');
    const manager = new TemplateManager();
    const templates = manager.list(options.category);

    console.log(chalk.cyan(`\n📋 Workflow Templates${options.category ? ` (${options.category})` : ''}:\n`));

    const categories = manager.getCategories();
    for (const category of categories) {
      const categoryTemplates = templates.filter(t => t.category === category);
      if (categoryTemplates.length === 0) continue;

      console.log(chalk.yellow(`  ${category.toUpperCase()}`));
      for (const t of categoryTemplates) {
        console.log(`    ${chalk.bold(t.name)} (${t.id})`);
        console.log(`      ${t.description}`);
        console.log(chalk.dim(`      Tags: ${t.tags.join(', ')}`));
        console.log();
      }
    }
  });

templateCmd
  .command('build <templateId>')
  .description('Build a workflow from a template')
  .option('-p, --params <json>', 'Template parameters as JSON')
  .action(async (templateId: string, options) => {
    const { TemplateManager } = await import('../n8n/templates.js');
    const manager = new TemplateManager();

    try {
      const params = options.params ? JSON.parse(options.params) : {};
      const workflow = manager.build(templateId, params);

      console.log(chalk.green(`\n✅ Built workflow from template: ${templateId}\n`));
      console.log(JSON.stringify(workflow, null, 2));
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Build failed'}`));
    }
  });

// ═══════════════════════════════════════════════════════════════
// Parse and Run
// ═══════════════════════════════════════════════════════════════

program.parse();
