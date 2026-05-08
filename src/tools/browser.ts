/**
 * 🎵 Chorus — Browser Control
 * Spin up browsers, scrape, research, automate web tasks
 */

import { childLogger } from '../core/logger.js';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '../types/index.js';

const logger = childLogger('browser-control');

// ═══════════════════════════════════════════════════════════════
// Browser Tool Definitions
// ═══════════════════════════════════════════════════════════════

export const BROWSER_TOOLS: ToolDefinition[] = [
  {
    name: 'browser_launch',
    description: 'Launch a headless browser instance for web automation',
    category: 'browser',
    parameters: [
      { name: 'headless', type: 'boolean', description: 'Run headless (no GUI)', required: false, default: true },
      { name: 'userAgent', type: 'string', description: 'Custom user agent', required: false },
    ],
  },
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL and wait for page load',
    category: 'browser',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to navigate to', required: true },
      { name: 'waitUntil', type: 'string', description: 'Wait condition', required: false, default: 'domcontentloaded', enum: ['load', 'domcontentloaded', 'networkidle'] },
      { name: 'timeout', type: 'number', description: 'Navigation timeout in ms', required: false, default: 30000 },
    ],
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page',
    category: 'browser',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector or XPath', required: true },
      { name: 'button', type: 'string', description: 'Mouse button', required: false, default: 'left', enum: ['left', 'right', 'middle'] },
      { name: 'doubleClick', type: 'boolean', description: 'Double click', required: false, default: false },
    ],
  },
  {
    name: 'browser_type',
    description: 'Type text into an input field',
    category: 'browser',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector for input', required: true },
      { name: 'text', type: 'string', description: 'Text to type', required: true },
      { name: 'delay', type: 'number', description: 'Delay between keystrokes in ms', required: false, default: 50 },
      { name: 'clear', type: 'boolean', description: 'Clear field first', required: false, default: true },
    ],
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    category: 'browser',
    parameters: [
      { name: 'fullPage', type: 'boolean', description: 'Capture full page', required: false, default: false },
      { name: 'selector', type: 'string', description: 'Screenshot specific element', required: false },
      { name: 'format', type: 'string', description: 'Image format', required: false, default: 'png', enum: ['png', 'jpeg'] },
    ],
  },
  {
    name: 'browser_extract',
    description: 'Extract data from the current page',
    category: 'browser',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector', required: false },
      { name: 'extractType', type: 'string', description: 'What to extract', required: true, enum: ['text', 'html', 'links', 'images', 'table', 'metadata', 'all'] },
      { name: 'attribute', type: 'string', description: 'HTML attribute to extract', required: false },
    ],
  },
  {
    name: 'browser_wait',
    description: 'Wait for an element or condition on the page',
    category: 'browser',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector to wait for', required: true },
      { name: 'timeout', type: 'number', description: 'Timeout in ms', required: false, default: 10000 },
      { name: 'state', type: 'string', description: 'Element state', required: false, default: 'visible', enum: ['attached', 'detached', 'visible', 'hidden'] },
    ],
  },
  {
    name: 'browser_scroll',
    description: 'Scroll the page',
    category: 'browser',
    parameters: [
      { name: 'direction', type: 'string', description: 'Scroll direction', required: true, enum: ['up', 'down', 'toElement'] },
      { name: 'amount', type: 'number', description: 'Pixels to scroll', required: false, default: 500 },
      { name: 'selector', type: 'string', description: 'Scroll to element (for toElement)', required: false },
    ],
  },
  {
    name: 'browser_fill_form',
    description: 'Fill out a form with multiple fields',
    category: 'browser',
    parameters: [
      { name: 'fields', type: 'object', description: 'Map of selector → value pairs', required: true },
      { name: 'submitSelector', type: 'string', description: 'Submit button selector', required: false },
    ],
  },
  {
    name: 'browser_research',
    description: 'Research a topic by searching and extracting information from multiple sources',
    category: 'browser',
    parameters: [
      { name: 'query', type: 'string', description: 'Research query', required: true },
      { name: 'maxSources', type: 'number', description: 'Max sources to check', required: false, default: 3 },
      { name: 'extractMode', type: 'string', description: 'What to extract from each source', required: false, default: 'text', enum: ['text', 'links', 'metadata'] },
    ],
  },
  {
    name: 'browser_pdf',
    description: 'Generate a PDF of the current page',
    category: 'browser',
    parameters: [
      { name: 'format', type: 'string', description: 'Page format', required: false, default: 'A4', enum: ['A4', 'Letter', 'Legal'] },
      { name: 'landscape', type: 'boolean', description: 'Landscape orientation', required: false, default: false },
    ],
  },
  {
    name: 'browser_evaluate',
    description: 'Execute JavaScript in the browser context',
    category: 'browser',
    parameters: [
      { name: 'script', type: 'string', description: 'JavaScript to execute', required: true },
    ],
  },
  {
    name: 'browser_close',
    description: 'Close the browser instance',
    category: 'browser',
    parameters: [],
  },
];

// ═══════════════════════════════════════════════════════════════
// Browser State
// ═══════════════════════════════════════════════════════════════

interface BrowserState {
  browser: any;
  page: any;
  isLaunched: boolean;
}

const state: BrowserState = {
  browser: null,
  page: null,
  isLaunched: false,
};

// ═══════════════════════════════════════════════════════════════
// Browser Executor
// ═══════════════════════════════════════════════════════════════

export async function executeBrowserTool(
  name: string,
  inputs: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (name) {
      case 'browser_launch':
        result = await browserLaunch(inputs);
        break;
      case 'browser_navigate':
        result = await browserNavigate(inputs);
        break;
      case 'browser_click':
        result = await browserClick(inputs);
        break;
      case 'browser_type':
        result = await browserType(inputs);
        break;
      case 'browser_screenshot':
        result = await browserScreenshot(inputs);
        break;
      case 'browser_extract':
        result = await browserExtract(inputs);
        break;
      case 'browser_wait':
        result = await browserWait(inputs);
        break;
      case 'browser_scroll':
        result = await browserScroll(inputs);
        break;
      case 'browser_fill_form':
        result = await browserFillForm(inputs);
        break;
      case 'browser_research':
        result = await browserResearch(inputs);
        break;
      case 'browser_pdf':
        result = await browserPdf(inputs);
        break;
      case 'browser_evaluate':
        result = await browserEvaluate(inputs);
        break;
      case 'browser_close':
        result = await browserClose();
        break;
      default:
        throw new Error(`Unknown browser tool: ${name}`);
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
      error: error instanceof Error ? error.message : 'Browser operation failed',
      tokensUsed: 0,
      cost: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Implementations (using fetch-based approach for portability)
// ═══════════════════════════════════════════════════════════════

async function ensurePlaywright(): Promise<any> {
  try {
    return await import('playwright' as string);
  } catch {
    throw new Error('Playwright not installed. Run: npx playwright install chromium');
  }
}

async function browserLaunch(inputs: Record<string, unknown>): Promise<unknown> {
  const pw = await ensurePlaywright();
  const headless = inputs.headless !== false;

  state.browser = await pw.chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await state.browser.newContext({
    userAgent: (inputs.userAgent as string) || 'Mozilla/5.0 (Chorus Agent) AppleWebKit/537.36',
    viewport: { width: 1280, height: 720 },
  });

  state.page = await context.newPage();
  state.isLaunched = true;

  logger.info({ headless }, '🌐 Browser launched');
  return { launched: true, headless };
}

async function ensureBrowser(): Promise<void> {
  if (!state.isLaunched) {
    await browserLaunch({ headless: true });
  }
}

async function browserNavigate(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const url = inputs.url as string;
  const waitUntil = (inputs.waitUntil as string) || 'domcontentloaded';
  const timeout = (inputs.timeout as number) || 30000;

  const response = await state.page.goto(url, { waitUntil, timeout });

  return {
    url,
    status: response?.status(),
    title: await state.page.title(),
    loaded: true,
  };
}

async function browserClick(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const selector = inputs.selector as string;
  const button = (inputs.button as string) || 'left';
  const doubleClick = inputs.doubleClick as boolean;

  if (doubleClick) {
    await state.page.dblclick(selector, { button: button as any });
  } else {
    await state.page.click(selector, { button: button as any });
  }

  return { clicked: selector, button, doubleClick };
}

async function browserType(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const selector = inputs.selector as string;
  const text = inputs.text as string;
  const delay = (inputs.delay as number) || 50;
  const clear = inputs.clear !== false;

  if (clear) {
    await state.page.fill(selector, '');
  }

  await state.page.type(selector, text, { delay });

  return { typed: text, selector, length: text.length };
}

async function browserScreenshot(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const fullPage = inputs.fullPage as boolean;
  const format = (inputs.format as string) || 'png';

  let screenshotOptions: any = { fullPage, type: format };

  if (inputs.selector) {
    const element = await state.page.$(inputs.selector as string);
    if (element) {
      const buffer = await element.screenshot(screenshotOptions);
      return { screenshot: buffer.toString('base64'), format, element: inputs.selector };
    }
  }

  const buffer = await state.page.screenshot(screenshotOptions);
  return { screenshot: buffer.toString('base64'), format, fullPage };
}

async function browserExtract(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const extractType = inputs.extractType as string;
  const selector = inputs.selector as string;

  switch (extractType) {
    case 'text': {
      if (selector) {
        const text = await state.page.textContent(selector);
        return { text, selector };
      }
      const text = await state.page.evaluate(() => document.body.innerText);
      return { text: text.slice(0, 50000) };
    }
    case 'html': {
      if (selector) {
        const html = await state.page.innerHTML(selector);
        return { html, selector };
      }
      const html = await state.page.content();
      return { html: html.slice(0, 100000) };
    }
    case 'links': {
      const links = await state.page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map((a: any) => ({
          text: (a as HTMLAnchorElement).innerText.trim(),
          href: (a as HTMLAnchorElement).href,
        })).filter(l => l.href.startsWith('http'));
      });
      return { links: links.slice(0, 200) };
    }
    case 'images': {
      const images = await state.page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map((img: any) => ({
          src: (img as HTMLImageElement).src,
          alt: (img as HTMLImageElement).alt,
          width: (img as HTMLImageElement).naturalWidth,
          height: (img as HTMLImageElement).naturalHeight,
        })).filter(i => i.src.startsWith('http'));
      });
      return { images: images.slice(0, 100) };
    }
    case 'table': {
      const tables = await state.page.evaluate(() => {
        return Array.from(document.querySelectorAll('table')).map(table => {
          const headers = Array.from(table.querySelectorAll('th')).map((th: any) => th.innerText.trim());
          const rows = Array.from(table.querySelectorAll('tr')).slice(1).map(tr =>
            Array.from(tr.querySelectorAll('td')).map((td: any) => td.innerText.trim())
          );
          return { headers, rows };
        });
      });
      return { tables };
    }
    case 'metadata': {
      const metadata = await state.page.evaluate(() => {
        const getMeta = (name: string) =>
          document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content') || '';
        return {
          title: document.title,
          description: getMeta('description'),
          ogTitle: getMeta('og:title'),
          ogDescription: getMeta('og:description'),
          ogImage: getMeta('og:image'),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
        };
      });
      return metadata;
    }
    default:
      return { error: `Unknown extract type: ${extractType}` };
  }
}

async function browserWait(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const selector = inputs.selector as string;
  const timeout = (inputs.timeout as number) || 10000;
  const state_val = (inputs.state as string) || 'visible';

  await state.page.waitForSelector(selector, {
    timeout,
    state: state_val as any,
  });

  return { waited: selector, state: state_val, found: true };
}

async function browserScroll(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const direction = inputs.direction as string;
  const amount = (inputs.amount as number) || 500;

  if (direction === 'toElement' && inputs.selector) {
    await state.page.evaluate((sel: string) => {
      document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
    }, inputs.selector as string);
    return { scrolled: 'toElement', selector: inputs.selector };
  }

  const scrollAmount = direction === 'up' ? -amount : amount;
  await state.page.evaluate((y: number) => window.scrollBy(0, y), scrollAmount);

  return { scrolled: direction, amount };
}

async function browserFillForm(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const fields = inputs.fields as Record<string, string>;
  const submitSelector = inputs.submitSelector as string;

  const filled: string[] = [];
  for (const [selector, value] of Object.entries(fields)) {
    await state.page.fill(selector, value);
    filled.push(selector);
  }

  if (submitSelector) {
    await state.page.click(submitSelector);
  }

  return { filled, submitSelector, fieldCount: filled.length };
}

async function browserResearch(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const query = inputs.query as string;
  const maxSources = (inputs.maxSources as number) || 3;

  // Search DuckDuckGo
  await state.page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    waitUntil: 'domcontentloaded',
  });

  // Get search results
  const searchResults = await state.page.evaluate(() => {
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    document.querySelectorAll('.result').forEach((result: any) => {
      const titleEl = result.querySelector('.result__a');
      const snippetEl = result.querySelector('.result__snippet');
      if (titleEl && snippetEl) {
        results.push({
          title: titleEl.textContent?.trim() || '',
          url: (titleEl as HTMLAnchorElement).href || '',
          snippet: snippetEl.textContent?.trim() || '',
        });
      }
    });
    return results;
  });

  // Visit top sources and extract content
  const sources: Array<{ url: string; title: string; content: string }> = [];

  for (const result of searchResults.slice(0, maxSources)) {
    try {
      await state.page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const content = await state.page.evaluate(() => {
        // Remove scripts and styles
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, header, footer, aside').forEach((el: any) => el.remove());
        return clone.innerText.slice(0, 5000);
      });

      sources.push({
        url: result.url,
        title: result.title,
        content,
      });
    } catch {
      // Skip failed sources
    }
  }

  return {
    query,
    searchResults: searchResults.slice(0, 10),
    sources,
    totalSources: sources.length,
  };
}

async function browserPdf(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const format = (inputs.format as string) || 'A4';
  const landscape = inputs.landscape as boolean;

  const buffer = await state.page.pdf({
    format,
    landscape,
    printBackground: true,
  });

  return { pdf: buffer.toString('base64'), format, landscape };
}

async function browserEvaluate(inputs: Record<string, unknown>): Promise<unknown> {
  await ensureBrowser();
  const script = inputs.script as string;

  const result = await state.page.evaluate(script);
  return { result };
}

async function browserClose(): Promise<unknown> {
  if (state.browser) {
    await state.browser.close();
    state.browser = null;
    state.page = null;
    state.isLaunched = false;
    logger.info('🌐 Browser closed');
    return { closed: true };
  }
  return { closed: false, message: 'No browser was open' };
}
