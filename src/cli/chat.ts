/**
 * 🎵 Chorus — Interactive Chat Mode
 * Have a conversation with your agents
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { nanoid } from 'nanoid';
import { AgentManager } from '../agent/index.js';
import { eventBus } from '../core/events.js';
import type { ChorusConfig } from '../types/index.js';

export class InteractiveChat {
  private manager: AgentManager;
  private agentId: string | null = null;
  private sessionId: string;
  private history: Array<{ role: string; content: string }> = [];

  constructor(config: ChorusConfig) {
    this.manager = new AgentManager(config);
    this.sessionId = `chat-${nanoid(8)}`;
  }

  /**
   * Start interactive chat
   */
  async start(agentName?: string): Promise<void> {
    await this.manager.initialize();

    console.log(chalk.cyan(`
  ╔══════════════════════════════════════════╗
  ║  🎵 Chorus Interactive Chat              ║
  ║  Type your goals or 'help' for commands  ║
  ╚══════════════════════════════════════════╝
    `));

    // Create or find agent
    if (agentName) {
      const agents = this.manager.listAgents();
      const existing = agents.find(a => a.name === agentName);
      if (existing) {
        this.agentId = existing.id;
        console.log(chalk.green(`📎 Using agent: ${agentName}`));
      }
    }

    if (!this.agentId) {
      const agent = await this.manager.createAgent(agentName || 'Chat Agent', {
        persona: 'You are a helpful AI assistant that can execute n8n workflows and perform various tasks. Be conversational and clear about what you\'re doing.',
        goals: ['Help the user achieve their goals using available tools and workflows'],
      });
      this.agentId = agent.id;
      console.log(chalk.green(`✨ Created agent: ${agent.name}`));
    }

    console.log(chalk.dim('\nType your goal, or:\n'));
    console.log(chalk.dim('  /help     — Show commands'));
    console.log(chalk.dim('  /status   — Show agent status'));
    console.log(chalk.dim('  /memory   — Show memory stats'));
    console.log(chalk.dim('  /clear    — Clear history'));
    console.log(chalk.dim('  /quit     — Exit chat'));
    console.log();

    await this.chatLoop();
  }

  private async chatLoop(): Promise<void> {
    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.cyan('You:'),
          prefix: '💬',
        },
      ]);

      const trimmed = input.trim();

      if (!trimmed) continue;

      // Handle commands
      if (trimmed.startsWith('/')) {
        const handled = await this.handleCommand(trimmed);
        if (handled === 'quit') break;
        continue;
      }

      // Process goal
      await this.processInput(trimmed);
    }
  }

  private async handleCommand(cmd: string): Promise<string | void> {
    const command = cmd.toLowerCase().split(' ')[0];

    switch (command) {
      case '/help':
        console.log(chalk.yellow('\n📖 Commands:\n'));
        console.log('  /help     — Show this help');
        console.log('  /status   — Show agent status');
        console.log('  /memory   — Show memory statistics');
        console.log('  /history  — Show conversation history');
        console.log('  /clear    — Clear conversation history');
        console.log('  /agents   — List all agents');
        console.log('  /switch   — Switch to a different agent');
        console.log('  /quit     — Exit chat');
        console.log();
        break;

      case '/status':
        if (this.agentId) {
          const state = this.manager.getState(this.agentId);
          console.log(chalk.yellow('\n📊 Agent Status:\n'));
          console.log(`  ID: ${state.agentId}`);
          console.log(`  Status: ${state.status}`);
          console.log(`  Steps: ${state.stepCount}`);
          console.log(`  Tokens: ${state.totalTokensUsed.toLocaleString()}`);
          console.log(`  Cost: $${state.totalCost.toFixed(4)}`);
          console.log(`  Errors: ${state.errors.length}`);
          console.log();
        }
        break;

      case '/memory':
        const stats = await this.manager.getMemoryStats();
        console.log(chalk.yellow('\n💾 Memory Stats:\n'));
        console.log(`  Memories: ${stats.totalMemories}`);
        console.log(`  Conversations: ${stats.totalConversations}`);
        console.log(`  Episodes: ${stats.totalEpisodes}`);
        console.log();
        break;

      case '/history':
        console.log(chalk.yellow('\n📜 Conversation History:\n'));
        for (const msg of this.history.slice(-10)) {
          const icon = msg.role === 'user' ? '💬' : '🤖';
          console.log(`  ${icon} ${msg.content.slice(0, 100)}`);
        }
        console.log();
        break;

      case '/clear':
        this.history = [];
        console.log(chalk.green('✨ History cleared'));
        break;

      case '/agents':
        const agents = this.manager.listAgents();
        console.log(chalk.yellow('\n🤖 Agents:\n'));
        for (const agent of agents) {
          const current = agent.id === this.agentId ? ' ← current' : '';
          console.log(`  ${chalk.bold(agent.name)} (${agent.id})${current}`);
        }
        console.log();
        break;

      case '/switch':
        const { agentName } = await inquirer.prompt([{
          type: 'list',
          name: 'agentName',
          message: 'Select agent:',
          choices: this.manager.listAgents().map(a => ({ name: a.name, value: a.id })),
        }]);
        this.agentId = agentName;
        console.log(chalk.green(`📎 Switched to agent: ${agentName}`));
        break;

      case '/quit':
        console.log(chalk.cyan('\n👋 Goodbye!\n'));
        return 'quit';

      default:
        console.log(chalk.red(`Unknown command: ${command}. Type /help for commands.`));
    }
  }

  private async processInput(input: string): Promise<void> {
    this.history.push({ role: 'user', content: input });

    const spinner = ora(chalk.blue('🤔 Thinking...')).start();

    // Set up event listeners for progress
    const events: string[] = [];
    const unsubPlan = eventBus.onChorus('plan:created', (e) => {
      spinner.text = chalk.blue(`📝 Plan: ${e.data.steps} steps`);
      events.push(`📝 Plan created: ${e.data.steps} steps`);
    });

    const unsubStep = eventBus.onChorus('step:started', (e) => {
      spinner.text = chalk.blue(`⚡ ${e.data.tool || 'Processing...'}`);
      events.push(`⚡ Step: ${e.data.tool || 'LLM reasoning'}`);
    });

    try {
      const result = await this.manager.run(this.agentId!, input);
      spinner.stop();

      // Show progress events
      if (events.length > 0) {
        console.log(chalk.dim('\n  Progress:'));
        for (const event of events) {
          console.log(chalk.dim(`    ${event}`));
        }
      }

      // Show result
      console.log(chalk.green(`\n🤖 Chorus: ${result.summary}\n`));

      if (result.steps.length > 0) {
        console.log(chalk.dim('  Steps:'));
        for (const step of result.steps) {
          const icon = step.status === 'completed' ? '✅' : '❌';
          console.log(chalk.dim(`    ${icon} ${step.action.slice(0, 80)}`));
        }
      }

      console.log(chalk.dim(`\n  Tokens: ${result.totalTokens.toLocaleString()} | Cost: $${result.totalCost.toFixed(4)} | Time: ${(result.durationMs / 1000).toFixed(1)}s\n`));

      this.history.push({ role: 'assistant', content: result.summary });
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }

    unsubPlan();
    unsubStep();
  }

  async close(): Promise<void> {
    await this.manager.close();
  }
}
