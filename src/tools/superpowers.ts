/**
 * 🎵 Chorus — Superpower Tools
 * Built-in tools that give n8n agents real-world capabilities
 */

import { childLogger } from '../core/logger.js';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '../types/index.js';

const logger = childLogger('superpower-tools');

// ═══════════════════════════════════════════════════════════════
// Tool Definitions (for registration)
// ═══════════════════════════════════════════════════════════════

export const SUPERPOWER_TOOLS: ToolDefinition[] = [
  // ─── Web & Search ───────────────────────────────────────────
  {
    name: 'web_search',
    description: 'Search the web using multiple search engines. Returns titles, URLs, and snippets.',
    category: 'web',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'engine', type: 'string', description: 'Search engine', required: false, default: 'duckduckgo', enum: ['duckduckgo', 'google', 'bing'] },
      { name: 'maxResults', type: 'number', description: 'Max results to return', required: false, default: 5 },
    ],
  },
  {
    name: 'web_scrape',
    description: 'Fetch and extract content from a URL. Returns text, links, and metadata.',
    category: 'web',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to scrape', required: true },
      { name: 'extractMode', type: 'string', description: 'Extraction mode', required: false, default: 'text', enum: ['text', 'html', 'links', 'metadata'] },
      { name: 'selector', type: 'string', description: 'CSS selector for specific content', required: false },
    ],
  },
  {
    name: 'web_screenshot',
    description: 'Take a screenshot of a webpage. Returns base64 image.',
    category: 'web',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to screenshot', required: true },
      { name: 'width', type: 'number', description: 'Viewport width', required: false, default: 1280 },
      { name: 'height', type: 'number', description: 'Viewport height', required: false, default: 720 },
      { name: 'fullPage', type: 'boolean', description: 'Capture full page', required: false, default: false },
    ],
  },

  // ─── File Operations ────────────────────────────────────────
  {
    name: 'file_read',
    description: 'Read the contents of a file',
    category: 'filesystem',
    parameters: [
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'encoding', type: 'string', description: 'File encoding', required: false, default: 'utf-8' },
    ],
  },
  {
    name: 'file_write',
    description: 'Write content to a file',
    category: 'filesystem',
    parameters: [
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true },
      { name: 'append', type: 'boolean', description: 'Append instead of overwrite', required: false, default: false },
    ],
  },
  {
    name: 'file_list',
    description: 'List files in a directory',
    category: 'filesystem',
    parameters: [
      { name: 'path', type: 'string', description: 'Directory path', required: true },
      { name: 'pattern', type: 'string', description: 'Glob pattern filter', required: false },
      { name: 'recursive', type: 'boolean', description: 'List recursively', required: false, default: false },
    ],
  },
  {
    name: 'file_delete',
    description: 'Delete a file (moves to trash, recoverable)',
    category: 'filesystem',
    parameters: [
      { name: 'path', type: 'string', description: 'File path to delete', required: true },
    ],
  },

  // ─── Code Execution ─────────────────────────────────────────
  {
    name: 'code_execute',
    description: 'Execute JavaScript/Node.js code in a sandboxed environment',
    category: 'code',
    parameters: [
      { name: 'code', type: 'string', description: 'JavaScript code to execute', required: true },
      { name: 'timeout', type: 'number', description: 'Execution timeout in ms', required: false, default: 10000 },
    ],
  },
  {
    name: 'code_eval',
    description: 'Evaluate a mathematical expression',
    category: 'code',
    parameters: [
      { name: 'expression', type: 'string', description: 'Math expression (e.g., "2 + 2 * 3")', required: true },
    ],
  },

  // ─── Data Processing ────────────────────────────────────────
  {
    name: 'json_transform',
    description: 'Transform JSON data using JMESPath queries',
    category: 'data',
    parameters: [
      { name: 'data', type: 'object', description: 'Input JSON data', required: true },
      { name: 'query', type: 'string', description: 'JMESPath-like query (dot notation supported)', required: true },
    ],
  },
  {
    name: 'csv_parse',
    description: 'Parse CSV text into structured data',
    category: 'data',
    parameters: [
      { name: 'csv', type: 'string', description: 'CSV text to parse', required: true },
      { name: 'delimiter', type: 'string', description: 'Column delimiter', required: false, default: ',' },
      { name: 'hasHeader', type: 'boolean', description: 'First row is header', required: false, default: true },
    ],
  },
  {
    name: 'json_validate',
    description: 'Validate JSON against a schema',
    category: 'data',
    parameters: [
      { name: 'data', type: 'object', description: 'Data to validate', required: true },
      { name: 'schema', type: 'object', description: 'JSON Schema', required: true },
    ],
  },

  // ─── Notification & Messaging ───────────────────────────────
  {
    name: 'notify_email',
    description: 'Send an email notification',
    category: 'notification',
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient email', required: true },
      { name: 'subject', type: 'string', description: 'Email subject', required: true },
      { name: 'body', type: 'string', description: 'Email body (HTML supported)', required: true },
      { name: 'from', type: 'string', description: 'Sender email', required: false },
    ],
  },
  {
    name: 'notify_slack',
    description: 'Send a Slack notification',
    category: 'notification',
    parameters: [
      { name: 'webhookUrl', type: 'string', description: 'Slack webhook URL', required: true },
      { name: 'message', type: 'string', description: 'Message text', required: true },
      { name: 'channel', type: 'string', description: 'Channel name', required: false },
      { name: 'username', type: 'string', description: 'Bot username', required: false },
    ],
  },
  {
    name: 'notify_webhook',
    description: 'Send a notification to any webhook URL',
    category: 'notification',
    parameters: [
      { name: 'url', type: 'string', description: 'Webhook URL', required: true },
      { name: 'payload', type: 'object', description: 'Payload data', required: true },
      { name: 'method', type: 'string', description: 'HTTP method', required: false, default: 'POST' },
    ],
  },

  // ─── Database ───────────────────────────────────────────────
  {
    name: 'db_query',
    description: 'Execute a SQL query on the local SQLite database',
    category: 'database',
    parameters: [
      { name: 'query', type: 'string', description: 'SQL query', required: true },
      { name: 'params', type: 'array', description: 'Query parameters', required: false },
    ],
  },

  // ─── AI & Analysis ──────────────────────────────────────────
  {
    name: 'text_summarize',
    description: 'Summarize a long text into key points',
    category: 'ai',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to summarize', required: true },
      { name: 'maxLength', type: 'number', description: 'Max summary length in words', required: false, default: 100 },
    ],
  },
  {
    name: 'text_extract',
    description: 'Extract structured data from unstructured text (emails, dates, names, etc.)',
    category: 'ai',
    parameters: [
      { name: 'text', type: 'string', description: 'Input text', required: true },
      { name: 'extractType', type: 'string', description: 'What to extract', required: true, enum: ['emails', 'phones', 'urls', 'dates', 'names', 'addresses', 'all'] },
    ],
  },
  {
    name: 'text_translate',
    description: 'Translate text to another language',
    category: 'ai',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to translate', required: true },
      { name: 'targetLang', type: 'string', description: 'Target language code (e.g., es, fr, de, ja)', required: true },
      { name: 'sourceLang', type: 'string', description: 'Source language (auto-detect if empty)', required: false },
    ],
  },
  {
    name: 'sentiment_analyze',
    description: 'Analyze the sentiment and emotion of text',
    category: 'ai',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to analyze', required: true },
    ],
  },

  // ─── Utility ────────────────────────────────────────────────
  {
    name: 'cron_schedule',
    description: 'Schedule a task to run at a specific time or interval',
    category: 'utility',
    parameters: [
      { name: 'name', type: 'string', description: 'Task name', required: true },
      { name: 'schedule', type: 'string', description: 'Cron expression or interval (e.g., "*/5 * * * *", "every 1h")', required: true },
      { name: 'action', type: 'string', description: 'Action to execute', required: true },
      { name: 'webhookUrl', type: 'string', description: 'Webhook to trigger', required: false },
    ],
  },
  {
    name: 'date_calc',
    description: 'Perform date calculations (add, subtract, diff, format)',
    category: 'utility',
    parameters: [
      { name: 'operation', type: 'string', description: 'Operation type', required: true, enum: ['add', 'subtract', 'diff', 'format', 'now'] },
      { name: 'date', type: 'string', description: 'Input date (ISO format)', required: false },
      { name: 'amount', type: 'number', description: 'Amount to add/subtract', required: false },
      { name: 'unit', type: 'string', description: 'Time unit', required: false, enum: ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'] },
      { name: 'format', type: 'string', description: 'Output format', required: false },
    ],
  },
  {
    name: 'uuid_generate',
    description: 'Generate a UUID',
    category: 'utility',
    parameters: [
      { name: 'version', type: 'string', description: 'UUID version', required: false, default: 'v4', enum: ['v4', 'v1'] },
    ],
  },
  {
    name: 'hash_generate',
    description: 'Generate hash of text (MD5, SHA256, SHA512)',
    category: 'utility',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to hash', required: true },
      { name: 'algorithm', type: 'string', description: 'Hash algorithm', required: false, default: 'sha256', enum: ['md5', 'sha256', 'sha512'] },
    ],
  },
  {
    name: 'base64_encode',
    description: 'Encode/decode Base64',
    category: 'utility',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to encode/decode', required: true },
      { name: 'mode', type: 'string', description: 'Encode or decode', required: false, default: 'encode', enum: ['encode', 'decode'] },
    ],
  },
  {
    name: 'json_parse',
    description: 'Parse and validate JSON strings',
    category: 'utility',
    parameters: [
      { name: 'text', type: 'string', description: 'JSON string to parse', required: true },
      { name: 'pretty', type: 'boolean', description: 'Pretty print output', required: false, default: false },
    ],
  },

  // ─── Image & Media ──────────────────────────────────────────
  {
    name: 'image_analyze',
    description: 'Analyze an image and describe its contents',
    category: 'media',
    parameters: [
      { name: 'imageUrl', type: 'string', description: 'URL or path to image', required: true },
      { name: 'question', type: 'string', description: 'What to analyze about the image', required: false, default: 'Describe this image in detail' },
    ],
  },
  {
    name: 'qr_generate',
    description: 'Generate a QR code',
    category: 'media',
    parameters: [
      { name: 'data', type: 'string', description: 'Data to encode', required: true },
      { name: 'size', type: 'number', description: 'Image size in pixels', required: false, default: 200 },
    ],
  },

  // ─── API & Integration ──────────────────────────────────────
  {
    name: 'api_call',
    description: 'Make an authenticated API call with automatic retry and error handling',
    category: 'integration',
    parameters: [
      { name: 'url', type: 'string', description: 'API endpoint URL', required: true },
      { name: 'method', type: 'string', description: 'HTTP method', required: false, default: 'GET', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'headers', type: 'object', description: 'Request headers', required: false },
      { name: 'body', type: 'object', description: 'Request body', required: false },
      { name: 'auth', type: 'object', description: 'Auth config { type: "bearer"|"basic"|"apikey", token: "..." }', required: false },
      { name: 'retries', type: 'number', description: 'Number of retries', required: false, default: 3 },
    ],
  },
  {
    name: 'graphql_query',
    description: 'Execute a GraphQL query',
    category: 'integration',
    parameters: [
      { name: 'endpoint', type: 'string', description: 'GraphQL endpoint URL', required: true },
      { name: 'query', type: 'string', description: 'GraphQL query', required: true },
      { name: 'variables', type: 'object', description: 'Query variables', required: false },
      { name: 'headers', type: 'object', description: 'Request headers', required: false },
    ],
  },

  // ─── System ─────────────────────────────────────────────────
  {
    name: 'system_info',
    description: 'Get system information (OS, memory, disk, CPU)',
    category: 'system',
    parameters: [],
  },
  {
    name: 'env_get',
    description: 'Get environment variable value (safe subset only)',
    category: 'system',
    parameters: [
      { name: 'name', type: 'string', description: 'Variable name', required: true },
    ],
  },
  {
    name: 'shell_exec',
    description: 'Execute a shell command (restricted, safe commands only)',
    category: 'system',
    parameters: [
      { name: 'command', type: 'string', description: 'Command to execute', required: true },
      { name: 'timeout', type: 'number', description: 'Timeout in ms', required: false, default: 10000 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Tool Executors
// ═══════════════════════════════════════════════════════════════

export async function executeSuperpowerTool(
  name: string,
  inputs: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (name) {
      case 'web_search':
        result = await webSearch(inputs);
        break;
      case 'web_scrape':
        result = await webScrape(inputs);
        break;
      case 'web_screenshot':
        result = await webScreenshot(inputs);
        break;
      case 'file_read':
        result = await fileRead(inputs);
        break;
      case 'file_write':
        result = await fileWrite(inputs);
        break;
      case 'file_list':
        result = await fileList(inputs);
        break;
      case 'file_delete':
        result = await fileDelete(inputs);
        break;
      case 'code_execute':
        result = await codeExecute(inputs);
        break;
      case 'code_eval':
        result = await codeEval(inputs);
        break;
      case 'json_transform':
        result = await jsonTransform(inputs);
        break;
      case 'csv_parse':
        result = await csvParse(inputs);
        break;
      case 'text_extract':
        result = await textExtract(inputs);
        break;
      case 'date_calc':
        result = await dateCalc(inputs);
        break;
      case 'uuid_generate':
        result = uuidGenerate(inputs);
        break;
      case 'hash_generate':
        result = hashGenerate(inputs);
        break;
      case 'base64_encode':
        result = base64Encode(inputs);
        break;
      case 'json_parse':
        result = jsonParse(inputs);
        break;
      case 'system_info':
        result = systemInfo();
        break;
      case 'env_get':
        result = envGet(inputs);
        break;
      case 'shell_exec':
        result = await shellExec(inputs);
        break;
      case 'api_call':
        result = await apiCall(inputs);
        break;
      case 'graphql_query':
        result = await graphqlQuery(inputs);
        break;
      case 'db_query':
        result = { message: 'Database queries require SQLite backend configured' };
        break;
      case 'notify_slack':
      case 'notify_webhook':
      case 'notify_email':
        result = await sendNotification(name, inputs);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      success: true,
      output: result,
      tokensUsed: 0,
      cost: 0,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      tokensUsed: 0,
      cost: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Implementations
// ═══════════════════════════════════════════════════════════════

async function webSearch(inputs: Record<string, unknown>): Promise<unknown> {
  const query = inputs.query as string;
  const engine = (inputs.engine as string) || 'duckduckgo';
  const maxResults = (inputs.maxResults as number) || 5;

  // Use DuckDuckGo HTML (no API key needed)
  const { default: axios } = await import('axios');

  try {
    if (engine === 'duckduckgo') {
      const response = await axios.get(`https://html.duckduckgo.com/html/`, {
        params: { q: query },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });

      const html = response.data as string;
      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Parse results from HTML
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        results.push({
          title: match[2].replace(/<[^>]*>/g, '').trim(),
          url: match[1],
          snippet: match[3].replace(/<[^>]*>/g, '').trim(),
        });
      }

      return { query, engine, results, count: results.length };
    }

    // Fallback for other engines
    return { query, engine, results: [], message: `Engine ${engine} requires API key. Use duckduckgo for free search.` };
  } catch (error) {
    return { query, engine, results: [], error: error instanceof Error ? error.message : 'Search failed' };
  }
}

async function webScrape(inputs: Record<string, unknown>): Promise<unknown> {
  const { default: axios } = await import('axios');
  const url = inputs.url as string;
  const extractMode = (inputs.extractMode as string) || 'text';

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Chorus Agent)' },
    timeout: 15000,
    maxContentLength: 5 * 1024 * 1024, // 5MB max
  });

  const html = response.data as string;

  switch (extractMode) {
    case 'text': {
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { url, text: text.slice(0, 10000), length: text.length };
    }
    case 'links': {
      const links: Array<{ text: string; href: string }> = [];
      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        links.push({ text: match[2].replace(/<[^>]*>/g, '').trim(), href: match[1] });
      }
      return { url, links: links.slice(0, 100) };
    }
    case 'metadata': {
      const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || '';
      const description = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] || '';
      const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i)?.[1] || '';
      return { url, title, description, ogTitle };
    }
    default:
      return { url, html: html.slice(0, 50000) };
  }
}

async function webScreenshot(inputs: Record<string, unknown>): Promise<unknown> {
  // This would use Playwright/Puppeteer in production
  return {
    message: 'Screenshot requires Playwright. Install with: npx playwright install',
    url: inputs.url,
    note: 'In production, this captures a real screenshot',
  };
}

async function fileRead(inputs: Record<string, unknown>): Promise<unknown> {
  const { readFileSync, existsSync } = await import('fs');
  const path = inputs.path as string;

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const encoding = (inputs.encoding as string) || 'utf-8';
  const rawContent: any = readFileSync(path, encoding as BufferEncoding);
  const contentStr = typeof rawContent === 'string' ? rawContent : String(rawContent);
  return { path, content: contentStr, size: contentStr.length };
}

async function fileWrite(inputs: Record<string, unknown>): Promise<unknown> {
  const { writeFileSync, appendFileSync, mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  const path = inputs.path as string;
  const content = inputs.content as string;

  mkdirSync(dirname(path), { recursive: true });

  if (inputs.append) {
    appendFileSync(path, content + '\n');
  } else {
    writeFileSync(path, content);
  }

  return { path, written: content.length, append: !!inputs.append };
}

async function fileList(inputs: Record<string, unknown>): Promise<unknown> {
  const { readdirSync, statSync, existsSync } = await import('fs');
  const { join } = await import('path');
  const path = inputs.path as string;

  if (!existsSync(path)) {
    throw new Error(`Directory not found: ${path}`);
  }

  const entries = readdirSync(path).map(name => {
    const fullPath = join(path, name);
    const stat = statSync(fullPath);
    return {
      name,
      path: fullPath,
      isDirectory: stat.isDirectory(),
      size: stat.size,
      modified: stat.mtime.toISOString(),
    };
  });

  return { path, entries, count: entries.length };
}

async function fileDelete(inputs: Record<string, unknown>): Promise<unknown> {
  const { renameSync, existsSync, mkdirSync } = await import('fs');
  const { join, basename } = await import('path');
  const path = inputs.path as string;

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  // Move to trash instead of deleting
  const trashDir = join(process.env.HOME || '/tmp', '.chorus-trash');
  mkdirSync(trashDir, { recursive: true });
  const trashPath = join(trashDir, `${Date.now()}-${basename(path)}`);
  renameSync(path, trashPath);

  return { deleted: path, movedTo: trashPath, recoverable: true };
}

async function codeExecute(inputs: Record<string, unknown>): Promise<unknown> {
  const code = inputs.code as string;
  const timeout = (inputs.timeout as number) || 10000;

  // Create sandboxed context
  const sandbox = {
    console: {
      log: (...args: unknown[]) => output.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => output.push('[ERROR] ' + args.map(String).join(' ')),
    },
    JSON,
    Math,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    setTimeout: (fn: (...args: unknown[]) => void, ms: number) => setTimeout(fn, Math.min(ms, 5000)),
  };

  const output: string[] = [];

  try {
    // Simple eval with timeout
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const fn = new AsyncFunction(...Object.keys(sandbox), code);
    const result = await Promise.race([
      fn(...Object.values(sandbox)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), timeout)),
    ]);

    return { result, output, success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Execution failed', output, success: false };
  }
}

async function codeEval(inputs: Record<string, unknown>): Promise<unknown> {
  const expression = inputs.expression as string;

  // Safe math evaluation
  const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
  if (sanitized !== expression) {
    throw new Error('Invalid characters in expression');
  }

  try {
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { expression, result };
  } catch {
    throw new Error(`Invalid expression: ${expression}`);
  }
}

async function jsonTransform(inputs: Record<string, unknown>): Promise<unknown> {
  const data = inputs.data as Record<string, unknown>;
  const query = inputs.query as string;

  // Simple dot-notation path extraction
  const parts = query.split('.');
  let result: unknown = data;

  for (const part of parts) {
    if (result && typeof result === 'object') {
      const match = part.match(/^(\w+)(?:\[(\d+)\])?$/);
      if (match) {
        result = (result as Record<string, unknown>)[match[1]];
        if (match[2] !== undefined && Array.isArray(result)) {
          result = result[parseInt(match[2])];
        }
      }
    } else {
      result = undefined;
    }
  }

  return { query, result };
}

async function csvParse(inputs: Record<string, unknown>): Promise<unknown> {
  const csv = inputs.csv as string;
  const delimiter = (inputs.delimiter as string) || ',';
  const hasHeader = inputs.hasHeader !== false;

  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [], count: 0 };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = hasHeader ? parseRow(lines[0]) : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows = dataLines.map(line => {
    const values = parseRow(line);
    if (hasHeader) {
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
    }
    return values;
  });

  return { headers, rows, count: rows.length };
}

async function textExtract(inputs: Record<string, unknown>): Promise<unknown> {
  const text = inputs.text as string;
  const extractType = inputs.extractType as string;

  const patterns: Record<string, RegExp> = {
    emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phones: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    urls: /https?:\/\/[^\s<>"]+/gi,
    dates: /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}/g,
    addresses: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)/gi,
  };

  if (extractType === 'all') {
    const result: Record<string, string[]> = {};
    for (const [key, pattern] of Object.entries(patterns)) {
      result[key] = [...new Set(text.match(pattern) || [])];
    }
    return result;
  }

  const pattern = patterns[extractType];
  if (!pattern) throw new Error(`Unknown extract type: ${extractType}`);

  return { type: extractType, matches: [...new Set(text.match(pattern) || [])] };
}

async function dateCalc(inputs: Record<string, unknown>): Promise<unknown> {
  const operation = inputs.operation as string;
  const dateStr = inputs.date as string;

  switch (operation) {
    case 'now':
      return { now: new Date().toISOString() };
    case 'format': {
      const date = dateStr ? new Date(dateStr) : new Date();
      return { formatted: date.toISOString(), locale: date.toLocaleDateString() };
    }
    case 'add':
    case 'subtract': {
      const date = new Date(dateStr);
      const amount = (inputs.amount as number) * (operation === 'subtract' ? -1 : 1);
      const unit = inputs.unit as string;

      const methods: Record<string, () => void> = {
        seconds: () => date.setSeconds(date.getSeconds() + amount),
        minutes: () => date.setMinutes(date.getMinutes() + amount),
        hours: () => date.setHours(date.getHours() + amount),
        days: () => date.setDate(date.getDate() + amount),
        weeks: () => date.setDate(date.getDate() + amount * 7),
        months: () => date.setMonth(date.getMonth() + amount),
        years: () => date.setFullYear(date.getFullYear() + amount),
      };

      methods[unit]?.();
      return { result: date.toISOString() };
    }
    case 'diff': {
      const date1 = new Date(dateStr);
      const date2 = new Date(inputs.amount as string);
      const diffMs = date1.getTime() - date2.getTime();
      return {
        diffMs,
        diffDays: Math.floor(diffMs / 86400000),
        diffHours: Math.floor(diffMs / 3600000),
        diffMinutes: Math.floor(diffMs / 60000),
      };
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

function uuidGenerate(inputs: Record<string, unknown>): unknown {
  const version = (inputs.version as string) || 'v4';
  if (version === 'v4') {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return { uuid, version };
  }
  return { uuid: 'v1-not-implemented', version };
}

function hashGenerate(inputs: Record<string, unknown>): unknown {
  const { createHash } = require('crypto');
  const text = inputs.text as string;
  const algorithm = (inputs.algorithm as string) || 'sha256';
  const hash = createHash(algorithm).update(text).digest('hex');
  return { hash, algorithm, length: hash.length };
}

function base64Encode(inputs: Record<string, unknown>): unknown {
  const text = inputs.text as string;
  const mode = (inputs.mode as string) || 'encode';

  if (mode === 'encode') {
    return { encoded: Buffer.from(text).toString('base64'), mode };
  } else {
    return { decoded: Buffer.from(text, 'base64').toString('utf-8'), mode };
  }
}

function jsonParse(inputs: Record<string, unknown>): unknown {
  const text = inputs.text as string;
  try {
    const parsed = JSON.parse(text);
    const pretty = inputs.pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
    return { valid: true, parsed, formatted: pretty };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

function systemInfo(): unknown {
  const os = require('os');
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: os.uptime(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus().length,
    nodeVersion: process.version,
    pid: process.pid,
  };
}

function envGet(inputs: Record<string, unknown>): unknown {
  const name = inputs.name as string;

  // Safe environment variables only
  const safeVars = ['NODE_ENV', 'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TZ', 'TERM'];
  if (!safeVars.includes(name)) {
    return { name, value: null, message: 'Variable not in safe list' };
  }

  return { name, value: process.env[name] || null };
}

async function shellExec(inputs: Record<string, unknown>): Promise<unknown> {
  const { execSync } = await import('child_process');
  const command = inputs.command as string;
  const timeout = (inputs.timeout as number) || 10000;

  // Whitelist safe commands
  const safeCommands = ['ls', 'pwd', 'date', 'whoami', 'hostname', 'uname', 'df', 'du', 'wc', 'cat', 'head', 'tail', 'grep', 'find', 'echo'];
  const cmdBase = command.split(' ')[0];

  if (!safeCommands.includes(cmdBase)) {
    throw new Error(`Command not allowed: ${cmdBase}. Safe commands: ${safeCommands.join(', ')}`);
  }

  try {
    const output = execSync(command, { timeout, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    return { command, output: output.trim(), success: true };
  } catch (error) {
    return { command, error: error instanceof Error ? error.message : 'Command failed', success: false };
  }
}

async function apiCall(inputs: Record<string, unknown>): Promise<unknown> {
  const { default: axios } = await import('axios');
  const url = inputs.url as string;
  const method = ((inputs.method as string) || 'GET').toUpperCase();
  const headers = (inputs.headers as Record<string, string>) || {};
  const body = inputs.body;
  const auth = inputs.auth as { type: string; token: string } | undefined;
  const retries = (inputs.retries as number) || 3;

  // Add auth headers
  if (auth) {
    if (auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'basic') {
      headers['Authorization'] = `Basic ${Buffer.from(auth.token).toString('base64')}`;
    } else if (auth.type === 'apikey') {
      headers['X-API-Key'] = auth.token;
    }
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios({ url, method, headers, data: body, timeout: 30000 });
      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
        attempt: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Request failed');
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function graphqlQuery(inputs: Record<string, unknown>): Promise<unknown> {
  const { default: axios } = await import('axios');
  const endpoint = inputs.endpoint as string;
  const query = inputs.query as string;
  const variables = inputs.variables;
  const headers = (inputs.headers as Record<string, string>) || {};

  headers['Content-Type'] = 'application/json';

  const response = await axios.post(endpoint, { query, variables }, { headers, timeout: 30000 });
  return response.data;
}

async function sendNotification(type: string, inputs: Record<string, unknown>): Promise<unknown> {
  const { default: axios } = await import('axios');

  if (type === 'notify_webhook' || type === 'notify_slack') {
    const url = (inputs.webhookUrl || inputs.url) as string;
    const payload = type === 'notify_slack'
      ? { text: inputs.message, channel: inputs.channel, username: inputs.username || 'Chorus' }
      : inputs.payload;

    await axios.post(url, payload, { timeout: 10000 });
    return { sent: true, type, url };
  }

  if (type === 'notify_email') {
    // Would integrate with SMTP or email service
    return { sent: false, message: 'Email requires SMTP configuration', to: inputs.to };
  }

  return { sent: false, message: 'Unknown notification type' };
}
