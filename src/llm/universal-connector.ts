/**
 * 🎵 Chorus — Universal Model Connector
 * Connect to ANY LLM provider through a unified interface
 */

import OpenAI from 'openai';
import { childLogger } from '../core/logger.js';
import { LLMError, LLMRateLimitError } from '../core/errors.js';
import type { LLMConfig, LLMMessage, LLMResponse, LLMTool, LLMStreamChunk, LLMUsage } from '../types/index.js';

const logger = childLogger('universal-connector');

// ═══════════════════════════════════════════════════════════════
// Provider Registry
// ═══════════════════════════════════════════════════════════════

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
  models: string[];
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsJSON: boolean;
  maxContextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsJSON: true,
    maxContextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsJSON: true,
    maxContextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.1-70b-versatile',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
  },
  together: {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    models: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'deepseek-ai/deepseek-v3',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0.0009,
    costPer1kOutput: 0.0009,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyEnv: 'OLLAMA_API_KEY',
    defaultModel: 'llama3.1',
    models: ['llama3.1', 'llama3.1:70b', 'mistral', 'mixtral', 'codellama', 'phi3', 'gemma2', 'qwen2.5'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0,
    costPer1kOutput: 0,
  },
  grok: {
    id: 'grok',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    defaultModel: 'grok-beta',
    models: ['grok-beta', 'grok-vision-beta'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 65536,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 128000,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.006,
  },
  fireworks: {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiKeyEnv: 'FIREWORKS_API_KEY',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    models: [
      'accounts/fireworks/models/llama-v3p1-70b-instruct',
      'accounts/fireworks/models/llama-v3p1-8b-instruct',
      'accounts/fireworks/models/mixtral-8x7b-instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0.0009,
    costPer1kOutput: 0.0009,
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    defaultModel: 'llama-3.1-sonar-large-128k-online',
    models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: false,
    maxContextWindow: 128000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.001,
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com/v2',
    apiKeyEnv: 'COHERE_API_KEY',
    defaultModel: 'command-r-plus',
    models: ['command-r-plus', 'command-r', 'command-light'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 128000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsJSON: true,
    maxContextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    apiKeyEnv: 'LMSTUDIO_API_KEY',
    defaultModel: 'local-model',
    models: ['local-model'],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0,
    costPer1kOutput: 0,
  },
  vllm: {
    id: 'vllm',
    name: 'vLLM (Local)',
    baseUrl: 'http://localhost:8000/v1',
    apiKeyEnv: 'VLLM_API_KEY',
    defaultModel: 'default',
    models: ['default'],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0,
    costPer1kOutput: 0,
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyEnv: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    models: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.0-pro',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    supportsJSON: true,
    maxContextWindow: 2097152, // 2M tokens!
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    models: [
      'meta/llama-3.1-70b-instruct',
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.1-405b-instruct',
      'mistralai/mistral-large-2-instruct',
      'mistralai/mixtral-8x7b-instruct',
      'google/gemma-2-27b-it',
      'nvidia/nemotron-4-340b-instruct',
      'deepseek-ai/deepseek-r1',
      'qwen/qwen2.5-72b-instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0002,
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1/models/openai-compatibility',
    apiKeyEnv: 'REPLICATE_API_TOKEN',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    models: [
      'meta/llama-3.1-70b-instruct',
      'meta/llama-3.1-8b-instruct',
      'mistralai/mixtral-8x7b-instruct-v0.1',
      'nousresearch/hermes-3-llama-3.1-405b',
    ],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.00065,
    costPer1kOutput: 0.00275,
  },
  sambanova: {
    id: 'sambanova',
    name: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    apiKeyEnv: 'SAMBANOVA_API_KEY',
    defaultModel: 'Meta-Llama-3.1-70B-Instruct',
    models: [
      'Meta-Llama-3.1-70B-Instruct',
      'Meta-Llama-3.1-8B-Instruct',
      'DeepSeek-V3',
      'Qwen2.5-72B-Instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0008,
  },
  cerebras: {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    defaultModel: 'llama3.1-70b',
    models: [
      'llama3.1-70b',
      'llama3.1-8b',
      'llama-3.3-70b',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0006,
    costPer1kOutput: 0.0006,
  },
  lepton: {
    id: 'lepton',
    name: 'Lepton AI',
    baseUrl: 'https://api.lepton.ai/v1',
    apiKeyEnv: 'LEPTON_API_KEY',
    defaultModel: 'llama-3.1-70b',
    models: [
      'llama-3.1-70b',
      'llama-3.1-8b',
      'mixtral-8x7b',
    ],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 32768,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0005,
  },
  novita: {
    id: 'novita',
    name: 'Novita AI',
    baseUrl: 'https://api.novita.ai/v3/openai',
    apiKeyEnv: 'NOVITA_API_KEY',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
    models: [
      'meta-llama/llama-3.1-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      'deepseek/deepseek-v3',
      'mistralai/mixtral-8x7b-instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0003,
  },
  hyperbolic: {
    id: 'hyperbolic',
    name: 'Hyperbolic',
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    apiKeyEnv: 'HYPERBOLIC_API_KEY',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    models: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct',
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-72B-Instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0004,
  },
  lambda: {
    id: 'lambda',
    name: 'Lambda',
    baseUrl: 'https://api.lambdalabs.com/v1',
    apiKeyEnv: 'LAMBDA_API_KEY',
    defaultModel: 'hermes3-405b',
    models: [
      'hermes3-405b',
      'hermes3-70b',
      'llama3.1-70b-instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.0008,
  },
  chutes: {
    id: 'chutes',
    name: 'Chutes AI',
    baseUrl: 'https://api.chutes.ai/v1',
    apiKeyEnv: 'CHUTES_API_KEY',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
    models: [
      'meta-llama/llama-3.1-70b-instruct',
      'deepseek-ai/deepseek-v3',
    ],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0002,
  },
  kluster: {
    id: 'kluster',
    name: 'Kluster AI',
    baseUrl: 'https://api.kluster.ai/v1',
    apiKeyEnv: 'KLUSTER_API_KEY',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
    models: [
      'meta-llama/llama-3.1-70b-instruct',
      'mistralai/mixtral-8x7b-instruct',
    ],
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsVision: false,
    supportsJSON: true,
    maxContextWindow: 131072,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.00015,
  },
};

// ═══════════════════════════════════════════════════════════════
// Cost Calculator
// ═══════════════════════════════════════════════════════════════

export function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    // Default estimate
    return (promptTokens * 0.003 + completionTokens * 0.015) / 1000;
  }

  return (
    (promptTokens * providerConfig.costPer1kInput +
      completionTokens * providerConfig.costPer1kOutput) /
    1000
  );
}

// ═══════════════════════════════════════════════════════════════
// Universal Model Connector
// ═══════════════════════════════════════════════════════════════

export class UniversalConnector {
  private client: OpenAI;
  private config: LLMConfig;
  private providerConfig: ProviderConfig;
  private totalTokensUsed: number = 0;
  private totalCost: number = 0;

  constructor(config: LLMConfig) {
    this.config = config;
    this.providerConfig = PROVIDERS[config.provider] || PROVIDERS.openai;

    const clientConfig: any = {
      apiKey: config.apiKey || process.env[this.providerConfig.apiKeyEnv] || 'dummy',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
    };

    // Use custom base URL if provided, otherwise use provider default
    clientConfig.baseURL = config.baseUrl || this.providerConfig.baseUrl;

    this.client = new OpenAI(clientConfig);

    logger.info({
      provider: config.provider,
      model: config.model || this.providerConfig.defaultModel,
      baseUrl: clientConfig.baseURL,
    }, '🔌 Universal connector initialized');
  }

  /**
   * Generate a completion
   */
  async complete(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const params: OpenAI.ChatCompletionCreateParams = {
        model: this.config.model || this.providerConfig.defaultModel,
        messages: this.toOpenAIMessages(messages),
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature ?? 0.7,
      };

      if (tools && tools.length > 0 && this.providerConfig.supportsToolCalling) {
        params.tools = tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters as OpenAI.FunctionParameters,
          },
        }));
        params.tool_choice = 'auto';
      }

      // JSON mode for supported providers
      if (this.providerConfig.supportsJSON) {
        // Don't force JSON if tools are present
        if (!tools || tools.length === 0) {
          params.response_format = { type: 'json_object' };
        }
      }

      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0];
      const usage = response.usage;

      const llmUsage: LLMUsage = {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        estimatedCost: calculateCost(
          this.config.provider,
          response.model,
          usage?.prompt_tokens || 0,
          usage?.completion_tokens || 0
        ),
      };

      this.totalTokensUsed += llmUsage.totalTokens;
      this.totalCost += llmUsage.estimatedCost;

      const toolCalls = choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      return {
        content: choice.message.content,
        toolCalls,
        usage: llmUsage,
        model: response.model,
        finishReason: choice.finish_reason as LLMResponse['finishReason'],
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || '60') * 1000;
          throw new LLMRateLimitError(retryAfter);
        }
        throw new LLMError(`[${this.config.provider}] ${error.message}`, {
          status: error.status,
          provider: this.config.provider,
        });
      }
      throw new LLMError(`[${this.config.provider}] ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming completion
   */
  async *stream(messages: LLMMessage[], tools?: LLMTool[]): AsyncGenerator<LLMStreamChunk> {
    try {
      const params: OpenAI.ChatCompletionCreateParams = {
        model: this.config.model || this.providerConfig.defaultModel,
        messages: this.toOpenAIMessages(messages),
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature ?? 0.7,
        stream: true,
      };

      if (tools && tools.length > 0 && this.providerConfig.supportsToolCalling) {
        params.tools = tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters as OpenAI.FunctionParameters,
          },
        }));
      }

      const stream = await this.client.chat.completions.create(params);

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        yield {
          content: delta.content || undefined,
          done: chunk.choices[0]?.finish_reason === 'stop',
        };
      }
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.status === 429) {
        throw new LLMRateLimitError();
      }
      throw new LLMError(`Stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderConfig {
    return { ...this.providerConfig };
  }

  /**
   * List available models for the provider
   */
  getAvailableModels(): string[] {
    return [...this.providerConfig.models];
  }

  /**
   * Get usage stats
   */
  getUsage(): { totalTokens: number; totalCost: number; provider: string; model: string } {
    return {
      totalTokens: this.totalTokensUsed,
      totalCost: this.totalCost,
      provider: this.config.provider,
      model: this.config.model || this.providerConfig.defaultModel,
    };
  }

  /**
   * Convert messages to OpenAI format
   */
  private toOpenAIMessages(messages: LLMMessage[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map(m => {
      if (m.role === 'system') return { role: 'system', content: m.content };
      if (m.role === 'user') return { role: 'user', content: m.content, name: m.name };
      if (m.role === 'assistant') {
        const msg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: m.content,
        };
        if (m.toolCalls) {
          msg.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          }));
        }
        return msg;
      }
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content, tool_call_id: m.toolCallId! };
      }
      return { role: 'user', content: m.content };
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Provider Discovery
// ═══════════════════════════════════════════════════════════════

export function listProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS[id];
}

export function findProvidersWithCapability(capability: keyof ProviderConfig): ProviderConfig[] {
  return Object.values(PROVIDERS).filter(p => p[capability] === true);
}

export function getModelsForProvider(providerId: string): string[] {
  return PROVIDERS[providerId]?.models || [];
}

export function estimateCostForRequest(
  providerId: string,
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  return calculateCost(providerId, model, estimatedInputTokens, estimatedOutputTokens);
}
