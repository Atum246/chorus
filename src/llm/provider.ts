/**
 * 🎵 Chorus — LLM Provider
 * Multi-provider LLM integration with streaming, tool calling, and cost tracking
 */

import OpenAI from 'openai';
import { childLogger } from '../core/logger.js';
import { LLMError, LLMRateLimitError } from '../core/errors.js';
import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMTool,
  LLMToolCall,
  LLMUsage,
  LLMStreamChunk,
} from '../types/index.js';

const logger = childLogger('llm-provider');

// ═══════════════════════════════════════════════════════════════
// Cost per 1K tokens (approximate, as of 2024)
// ═══════════════════════════════════════════════════════════════

const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'llama-3.1-70b': { input: 0.0009, output: 0.0009 },
  'llama-3.1-8b': { input: 0.0002, output: 0.0002 },
  'mixtral-8x7b': { input: 0.0006, output: 0.0006 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const normalizedModel = model.toLowerCase().replace(/^(openai|anthropic|meta-)\//, '');
  const costs = COST_TABLE[normalizedModel];
  if (!costs) {
    // Default estimate
    return (promptTokens * 0.003 + completionTokens * 0.015) / 1000;
  }
  return (promptTokens * costs.input + completionTokens * costs.output) / 1000;
}

// ═══════════════════════════════════════════════════════════════
// LLM Provider Class
// ═══════════════════════════════════════════════════════════════

export class LLMProvider {
  private client: OpenAI;
  private config: LLMConfig;
  private totalTokensUsed: number = 0;
  private totalCost: number = 0;

  constructor(config: LLMConfig) {
    this.config = config;

    const clientConfig: any = {
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    };

    // Support different providers via base URL
    if (config.baseUrl) {
      clientConfig.baseURL = config.baseUrl;
    } else if (config.provider === 'anthropic') {
      clientConfig.baseURL = 'https://api.anthropic.com/v1';
    } else if (config.provider === 'ollama') {
      clientConfig.baseURL = 'http://localhost:11434/v1';
      clientConfig.apiKey = 'ollama'; // Ollama doesn't need a real key
    } else if (config.provider === 'groq') {
      clientConfig.baseURL = 'https://api.groq.com/openai/v1';
    } else if (config.provider === 'together') {
      clientConfig.baseURL = 'https://api.together.xyz/v1';
    }

    this.client = new OpenAI(clientConfig);
    logger.info({ provider: config.provider, model: config.model }, 'LLM provider initialized');
  }

  /**
   * Generate a completion (non-streaming)
   */
  async complete(
    messages: LLMMessage[],
    tools?: LLMTool[]
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const params: OpenAI.ChatCompletionCreateParams = {
        model: this.config.model,
        messages: this.toOpenAIMessages(messages),
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        frequency_penalty: this.config.frequencyPenalty,
        presence_penalty: this.config.presencePenalty,
      };

      if (tools && tools.length > 0) {
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

      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0];
      const usage = response.usage;

      const llmUsage: LLMUsage = {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        estimatedCost: estimateCost(
          this.config.model,
          usage?.prompt_tokens || 0,
          usage?.completion_tokens || 0
        ),
      };

      this.totalTokensUsed += llmUsage.totalTokens;
      this.totalCost += llmUsage.estimatedCost;

      const toolCalls: LLMToolCall[] | undefined = choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      const result: LLMResponse = {
        content: choice.message.content,
        toolCalls,
        usage: llmUsage,
        model: response.model,
        finishReason: choice.finish_reason as LLMResponse['finishReason'],
      };

      logger.debug(
        {
          model: response.model,
          tokens: llmUsage.totalTokens,
          cost: llmUsage.estimatedCost.toFixed(6),
          durationMs: Date.now() - startTime,
          toolCalls: toolCalls?.length || 0,
        },
        'LLM completion'
      );

      return result;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || '60') * 1000;
          throw new LLMRateLimitError(retryAfter);
        }
        throw new LLMError(`LLM API error: ${error.message}`, {
          status: error.status,
          type: error.type,
        });
      }
      throw new LLMError(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a streaming completion
   */
  async *stream(
    messages: LLMMessage[],
    tools?: LLMTool[]
  ): AsyncGenerator<LLMStreamChunk> {
    try {
      const params: OpenAI.ChatCompletionCreateParams = {
        model: this.config.model,
        messages: this.toOpenAIMessages(messages),
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        stream: true,
      };

      if (tools && tools.length > 0) {
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

      let accumulatedToolCalls: Map<number, Partial<LLMToolCall>> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        const streamChunk: LLMStreamChunk = {
          content: delta.content || undefined,
          done: chunk.choices[0]?.finish_reason === 'stop',
        };

        // Handle tool call streaming
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = accumulatedToolCalls.get(tc.index) || {
              id: tc.id || '',
              type: 'function' as const,
              function: { name: '', arguments: '' },
            };

            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function!.name += tc.function.name;
            if (tc.function?.arguments) existing.function!.arguments += tc.function.arguments;

            accumulatedToolCalls.set(tc.index, existing);
          }

          streamChunk.toolCalls = Array.from(accumulatedToolCalls.values());
        }

        // Handle usage
        if (chunk.usage) {
          streamChunk.usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }

        yield streamChunk;
      }
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.status === 429) {
        throw new LLMRateLimitError();
      }
      throw new LLMError(`Stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get usage statistics
   */
  getUsage(): { totalTokens: number; totalCost: number } {
    return {
      totalTokens: this.totalTokensUsed,
      totalCost: this.totalCost,
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsage(): void {
    this.totalTokensUsed = 0;
    this.totalCost = 0;
  }

  /**
   * Convert Chorus messages to OpenAI format
   */
  private toOpenAIMessages(messages: LLMMessage[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      if (m.role === 'user') {
        return { role: 'user', content: m.content, name: m.name };
      }
      if (m.role === 'assistant') {
        const msg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: m.content,
        };
        if (m.toolCalls) {
          msg.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }));
        }
        return msg;
      }
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId!,
        };
      }
      return { role: 'user', content: m.content };
    });
  }
}
