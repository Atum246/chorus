/**
 * 🎵 Chorus — Prompt Templates
 * Carefully crafted prompts for agent reasoning
 */

import type { Plan, PlanStep, AgentDefinition, MemoryEntry } from '../types/index.js';
import type { WorkflowAnalysis } from '../n8n/client.js';

export const Prompts = {
  // ═══════════════════════════════════════════════════════════
  // System Prompts
  // ═══════════════════════════════════════════════════════════

  systemPersona(agent: AgentDefinition): string {
    return `You are ${agent.name}, an AI agent powered by Chorus.

${agent.persona || 'You are a capable autonomous agent that achieves goals by planning and executing workflows.'}

Your capabilities:
- You can plan multi-step approaches to achieve goals
- You can trigger and monitor n8n workflows
- You can reflect on outcomes and adjust your approach
- You have persistent memory across conversations
- You can use tools to interact with external systems

Your principles:
1. Break complex goals into clear, executable steps
2. Always verify results before proceeding
3. Learn from failures and adapt your approach
4. Be transparent about what you're doing and why
5. Respect guardrails and budget constraints
6. Ask for clarification when the goal is ambiguous

${agent.goals.length > 0 ? `\nYour primary goals:\n${agent.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}` : ''}`;
  },

  // ═══════════════════════════════════════════════════════════
  // Planning Prompts
  // ═══════════════════════════════════════════════════════════

  planGeneration(
    goal: string,
    availableTools: string[],
    availableWorkflows: Array<{ id: string; name: string; description?: string }>,
    memory?: MemoryEntry[],
    constraints?: string
  ): string {
    let prompt = `## Goal
${goal}

## Available Tools
${availableTools.map(t => `- ${t}`).join('\n')}

## Available Workflows
${availableWorkflows.map(w => `- [${w.id}] ${w.name}${w.description ? `: ${w.description}` : ''}`).join('\n')}`;

    if (memory && memory.length > 0) {
      prompt += `\n\n## Relevant Memory
${memory.map(m => `- ${m.content}`).join('\n')}`;
    }

    if (constraints) {
      prompt += `\n\n## Constraints
${constraints}`;
    }

    prompt += `\n\n## Instructions
Create a detailed plan to achieve the goal. For each step, specify:
1. The action to take
2. Which tool or workflow to use (if any)
3. The inputs needed
4. The expected output
5. Dependencies on previous steps

Respond with a JSON object in this format:
{
  "strategy": "Brief description of your overall approach",
  "steps": [
    {
      "order": 1,
      "action": "What to do",
      "tool": "tool_name or null",
      "workflowId": "workflow_id or null",
      "inputs": { "key": "value" },
      "expectedOutput": "What to expect",
      "dependencies": []
    }
  ],
  "confidence": 0.85,
  "estimatedCost": 0.05,
  "estimatedTime": 30
}`;

    return prompt;
  },

  replan(
    goal: string,
    currentPlan: Plan,
    completedSteps: PlanStep[],
    failedStep: PlanStep,
    error: string,
    availableTools: string[]
  ): string {
    return `## Situation
The current plan has encountered a failure. We need to replan.

## Original Goal
${goal}

## What Was Completed
${completedSteps.map(s => `✅ Step ${s.order}: ${s.action} → ${JSON.stringify(s.result?.output).slice(0, 200)}`).join('\n')}

## What Failed
❌ Step ${failedStep.order}: ${failedStep.action}
Error: ${error}

## Available Tools
${availableTools.map(t => `- ${t}`).join('\n')}

## Instructions
Create a revised plan that:
1. Accounts for what was already completed
2. Finds an alternative approach for the failed step
3. Completes the remaining goal

Respond with the same JSON plan format as before.`;
  },

  // ═══════════════════════════════════════════════════════════
  // Execution Prompts
  // ═══════════════════════════════════════════════════════════

  executeStep(
    step: PlanStep,
    previousResults: Array<{ step: string; output: unknown }>,
    context: string
  ): string {
    return `## Current Step
**Action:** ${step.action}
${step.tool ? `**Tool:** ${step.tool}` : ''}
${step.workflowId ? `**Workflow:** ${step.workflowId}` : ''}
**Expected Output:** ${step.expectedOutput}

## Inputs
${JSON.stringify(step.inputs, null, 2)}

## Previous Step Results
${previousResults.map(r => `- ${r.step}: ${JSON.stringify(r.output).slice(0, 300)}`).join('\n') || 'None yet'}

## Context
${context}

## Instructions
Execute this step. Use the appropriate tool with the provided inputs.
If the step requires a workflow, trigger it and wait for results.
If something is unclear, make a reasonable assumption and proceed.

Respond with a JSON object:
{
  "success": true/false,
  "output": <the result>,
  "error": "<error message if failed>",
  "observations": "What you noticed or learned"
}`;
  },

  // ═══════════════════════════════════════════════════════════
  // Reflection Prompts
  // ═══════════════════════════════════════════════════════════

  reflect(
    goal: string,
    plan: Plan,
    completedSteps: PlanStep[],
    currentStep: PlanStep
  ): string {
    return `## Reflection Required

**Goal:** ${goal}
**Progress:** ${completedSteps.length}/${plan.steps.length} steps completed

## Recent Results
${completedSteps.slice(-3).map(s =>
      `Step ${s.order} (${s.action}): ${s.result?.success ? '✅' : '❌'} ${JSON.stringify(s.result?.output).slice(0, 200)}`
    ).join('\n')}

## Current Step
${currentStep.action}: ${currentStep.result?.success ? '✅' : '❌'}
${currentStep.result?.error ? `Error: ${currentStep.result.error}` : ''}

## Reflect On:
1. Is the plan still on track to achieve the goal?
2. Are there any unexpected results or insights?
3. Should the remaining steps be adjusted?
4. What have we learned that's worth remembering?

Respond with a JSON object:
{
  "onTrack": true/false,
  "insights": ["insight 1", "insight 2"],
  "suggestedAdjustments": ["adjustment 1"],
  "lessonsLearned": ["lesson 1"],
  "shouldReplan": false
}`;
  },

  // ═══════════════════════════════════════════════════════════
  // Self-Healing Prompts
  // ═══════════════════════════════════════════════════════════

  selfHeal(
    error: string,
    context: string,
    previousAttempts: string[],
    availableOptions: string[]
  ): string {
    return `## Self-Healing Required

An error occurred that needs recovery.

## Error
${error}

## Context
${context}

## Previous Recovery Attempts
${previousAttempts.length > 0 ? previousAttempts.map(a => `- ${a}`).join('\n') : 'None'}

## Available Recovery Options
${availableOptions.map(o => `- ${o}`).join('\n')}

## Instructions
Suggest a recovery strategy. Consider:
1. What went wrong and why
2. Which recovery option is most likely to work
3. Whether we should retry, skip, or take an alternative path

Respond with a JSON object:
{
  "strategy": "retry|skip|alternative|abort",
  "reasoning": "Why this strategy",
  "action": "Specific recovery action to take",
  "modifiedInputs": { "key": "value" } or null,
  "confidence": 0.7
}`;
  },

  // ═══════════════════════════════════════════════════════════
  // Analysis Prompts
  // ═══════════════════════════════════════════════════════════

  analyzeWorkflow(workflow: WorkflowAnalysis): string {
    return `## Workflow Analysis

**Nodes:** ${workflow.nodeCount}
**Complexity:** ${workflow.complexity}/10
**Has Webhooks:** ${workflow.hasWebhooks}
**Has Loops:** ${workflow.hasLoops}
**Estimated Time:** ${workflow.estimatedExecutionTimeMs}ms

**Node Types:** ${workflow.nodeTypes.join(', ')}
**Entry Points:** ${workflow.entryPoints.join(', ')}

**Execution Flow:**
${Array.from(workflow.executionGraph.entries())
        .map((entry: [string, string[]]) => `  ${entry[0]} → ${entry[1].join(', ') || '(end)'}`)
        .join('\n')}

Based on this analysis, describe what this workflow does and how it can be used as an agent tool.
Provide a concise summary suitable for the agent's tool registry.`;
  },

  summarize(goal: string, outcome: string, steps: PlanStep[]): string {
    return `## Execution Summary

**Goal:** ${goal}
**Outcome:** ${outcome}

**Steps Executed:**
${steps.map(s =>
      `${s.result?.success ? '✅' : '❌'} Step ${s.order}: ${s.action}
   Result: ${JSON.stringify(s.result?.output).slice(0, 200)}`
    ).join('\n\n')}

Create a concise, human-readable summary of what was accomplished.
Include key results and any important observations.`;
  },
};
