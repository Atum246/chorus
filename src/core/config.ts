/**
 * 🎵 Chorus — Configuration Manager
 * Loads, validates, and manages configuration
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import dotenv from 'dotenv';
import { z } from 'zod';
import type { ChorusConfig } from '../types/index.js';
import { childLogger } from './logger.js';

dotenv.config();

const logger = childLogger('config');

// ═══════════════════════════════════════════════════════════════
// Zod Schemas for Validation
// ═══════════════════════════════════════════════════════════════

const N8nConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  webhookBaseUrl: z.string().url().optional(),
  timeout: z.number().positive().default(30000),
  retryAttempts: z.number().min(0).default(3),
  retryDelay: z.number().positive().default(1000),
});

const LLMConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'groq', 'together', 'custom']),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(1),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  timeout: z.number().positive().default(60000),
  maxRetries: z.number().min(0).default(3),
  streaming: z.boolean().default(true),
});

const MemoryConfigSchema = z.object({
  backend: z.enum(['sqlite', 'redis', 'in-memory']),
  sqlitePath: z.string().optional(),
  redisUrl: z.string().optional(),
  maxShortTermMessages: z.number().positive().default(50),
  maxLongTermEntries: z.number().positive().default(10000),
  embeddingModel: z.string().optional(),
  vectorDimensions: z.number().positive().optional(),
  ttlSeconds: z.number().positive().default(86400 * 7),
});

const RateLimitConfigSchema = z.object({
  maxRequestsPerMinute: z.number().positive().default(60),
  maxTokensPerMinute: z.number().positive().default(100000),
  maxWorkflowRunsPerHour: z.number().positive().default(100),
});

const GuardrailsConfigSchema = z.object({
  maxExecutionTimeMs: z.number().positive().default(300000),
  maxBudgetPerRun: z.number().positive().default(10),
  maxConcurrentRuns: z.number().positive().default(5),
  allowedDomains: z.array(z.string()).default([]),
  blockedDomains: z.array(z.string()).default([]),
  maxTokensPerTurn: z.number().positive().default(8192),
  requireApproval: z.array(z.string()).default([]),
  rateLimits: RateLimitConfigSchema.default({}),
});

const WebhookConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
});

const ObservabilityConfigSchema = z.object({
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  logFormat: z.enum(['json', 'pretty']).default('pretty'),
  enableTracing: z.boolean().default(false),
  enableMetrics: z.boolean().default(false),
  metricsPort: z.number().positive().default(9090),
  webhookNotifications: WebhookConfigSchema.optional(),
});

const AgentDefaultsSchema = z.object({
  maxSteps: z.number().positive().default(25),
  maxReflections: z.number().positive().default(5),
  planningStrategy: z.enum(['react', 'plan-and-execute', 'tree-of-thought']).default('plan-and-execute'),
  enableMemory: z.boolean().default(true),
  enableReflection: z.boolean().default(true),
  enableSelfHealing: z.boolean().default(true),
  defaultPersona: z.string().optional(),
});

const ChorusConfigSchema = z.object({
  n8n: N8nConfigSchema,
  llm: LLMConfigSchema,
  memory: MemoryConfigSchema.default({ backend: 'sqlite' }),
  guardrails: GuardrailsConfigSchema.default({}),
  observability: ObservabilityConfigSchema.default({}),
  agent: AgentDefaultsSchema.default({}),
});

// ═══════════════════════════════════════════════════════════════
// Config Manager
// ═══════════════════════════════════════════════════════════════

let config: ChorusConfig | null = null;

export function loadConfig(configPath?: string): ChorusConfig {
  const paths = [
    configPath,
    process.env.CHORUS_CONFIG,
    'chorus.config.yaml',
    'chorus.config.yml',
    'chorus.config.json',
    resolve(process.env.HOME || '~', '.chorus/config.yaml'),
    resolve(process.env.HOME || '~', '.chorus/config.yml'),
  ].filter(Boolean) as string[];

  let rawConfig: Record<string, unknown> = {};

  for (const p of paths) {
    const fullPath = resolve(p);
    if (existsSync(fullPath)) {
      logger.info({ path: fullPath }, 'Loading config from file');
      const content = readFileSync(fullPath, 'utf-8');
      if (fullPath.endsWith('.json')) {
        rawConfig = JSON.parse(content);
      } else {
        rawConfig = parseYaml(content);
      }
      break;
    }
  }

  // Override with environment variables
  const envConfig: Record<string, unknown> = {};

  if (process.env.N8N_BASE_URL) {
    envConfig.n8n = { ...(rawConfig.n8n as Record<string, unknown> || {}), baseUrl: process.env.N8N_BASE_URL };
  }
  if (process.env.N8N_API_KEY) {
    envConfig.n8n = { ...(envConfig.n8n as Record<string, unknown> || rawConfig.n8n as Record<string, unknown> || {}), apiKey: process.env.N8N_API_KEY };
  }
  if (process.env.LLM_PROVIDER) {
    envConfig.llm = { ...(rawConfig.llm as Record<string, unknown> || {}), provider: process.env.LLM_PROVIDER };
  }
  if (process.env.LLM_API_KEY) {
    envConfig.llm = { ...(envConfig.llm as Record<string, unknown> || rawConfig.llm as Record<string, unknown> || {}), apiKey: process.env.LLM_API_KEY };
  }
  if (process.env.LLM_MODEL) {
    envConfig.llm = { ...(envConfig.llm as Record<string, unknown> || rawConfig.llm as Record<string, unknown> || {}), model: process.env.LLM_MODEL };
  }

  const merged = deepMerge(rawConfig, envConfig);

  // Validate
  const result = ChorusConfigSchema.safeParse(merged);
  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  config = result.data;
  logger.info('Configuration loaded and validated');
  return config;
}

export function getConfig(): ChorusConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export function updateConfig(patch: Partial<ChorusConfig>): ChorusConfig {
  const current = getConfig();
  config = deepMerge(current as unknown as Record<string, unknown>, patch as unknown as Record<string, unknown>) as unknown as ChorusConfig;
  return config;
}

export function saveConfig(path: string): void {
  const current = getConfig();
  const yaml = stringifyYaml(current);
  writeFileSync(path, yaml, 'utf-8');
  logger.info({ path }, 'Config saved');
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
