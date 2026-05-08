/**
 * 🎵 Chorus — Observability
 * Metrics, tracing, and monitoring
 */

import { childLogger } from '../core/logger.js';
import { eventBus } from '../core/events.js';
import type { ChorusEvent, ChorusEventType } from '../types/index.js';

const logger = childLogger('observability');

// ═══════════════════════════════════════════════════════════════
// Metrics Collector
// ═══════════════════════════════════════════════════════════════

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  increment(name: string, value: number = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  }

  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  histogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    this.histograms.get(name)!.push(value);
  }

  getCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  getGauges(): Record<string, number> {
    return Object.fromEntries(this.gauges);
  }

  getHistogramStats(name: string): { min: number; max: number; avg: number; p50: number; p95: number; p99: number } | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  export(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      counters: this.getCounters(),
      gauges: this.getGauges(),
    };

    for (const [name] of this.histograms) {
      result[`histogram_${name}`] = this.getHistogramStats(name);
    }

    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// Trace Collector
// ═══════════════════════════════════════════════════════════════

export interface TraceSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  agentId: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: string; attributes: Record<string, unknown> }>;
}

export class TraceCollector {
  private spans: Map<string, TraceSpan> = new Map();
  private traces: Map<string, TraceSpan[]> = new Map();

  startSpan(
    name: string,
    agentId: string,
    traceId?: string,
    parentSpanId?: string
  ): TraceSpan {
    const span: TraceSpan = {
      id: `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      traceId: traceId || `trace-${Date.now()}`,
      parentSpanId,
      name,
      agentId,
      startTime: new Date().toISOString(),
      status: 'unset',
      attributes: {},
      events: [],
    };

    this.spans.set(span.id, span);

    if (!this.traces.has(span.traceId)) {
      this.traces.set(span.traceId, []);
    }
    this.traces.get(span.traceId)!.push(span);

    return span;
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = new Date().toISOString();
      span.durationMs = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
      span.status = status;
    }
  }

  addSpanEvent(spanId: string, name: string, attributes: Record<string, unknown> = {}): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({ name, timestamp: new Date().toISOString(), attributes });
    }
  }

  setSpanAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      Object.assign(span.attributes, attributes);
    }
  }

  getTrace(traceId: string): TraceSpan[] {
    return this.traces.get(traceId) || [];
  }

  getAgentTraces(agentId: string): TraceSpan[] {
    return Array.from(this.spans.values()).filter(s => s.agentId === agentId);
  }

  getRecentSpans(limit: number = 50): TraceSpan[] {
    return Array.from(this.spans.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  export(): Record<string, unknown> {
    return {
      totalSpans: this.spans.size,
      totalTraces: this.traces.size,
      recentSpans: this.getRecentSpans(10),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Health Checker
// ═══════════════════════════════════════════════════════════════

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: string; message?: string; latencyMs?: number }>;
  timestamp: string;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<{ status: string; message?: string }>> = new Map();

  registerCheck(name: string, check: () => Promise<{ status: string; message?: string }>): void {
    this.checks.set(name, check);
  }

  async check(): Promise<HealthStatus> {
    const results: Record<string, { status: string; message?: string; latencyMs?: number }> = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    for (const [name, check] of this.checks) {
      const startTime = Date.now();
      try {
        const result = await check();
        results[name] = { ...result, latencyMs: Date.now() - startTime };
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          latencyMs: Date.now() - startTime,
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Observability Manager
// ═══════════════════════════════════════════════════════════════

export class ObservabilityManager {
  metrics: MetricsCollector;
  traces: TraceCollector;
  health: HealthChecker;
  private eventSubscriptions: Array<() => void> = [];

  constructor() {
    this.metrics = new MetricsCollector();
    this.traces = new TraceCollector();
    this.health = new HealthChecker();

    this.setupEventTracking();
  }

  private setupEventTracking(): void {
    const eventTypes: ChorusEventType[] = [
      'agent:started', 'agent:completed', 'agent:error',
      'step:started', 'step:completed', 'step:failed',
      'workflow:triggered', 'workflow:completed', 'workflow:failed',
      'guardrail:triggered', 'budget:exceeded',
    ];

    for (const type of eventTypes) {
      const unsub = eventBus.onChorus(type, (event) => {
        this.metrics.increment(`events.${type}`);
        this.metrics.increment(`events.total`);

        if (event.type === 'step:completed' || event.type === 'step:failed') {
          const durationMs = event.data.durationMs as number;
          if (durationMs) {
            this.metrics.histogram('step_duration_ms', durationMs);
          }
        }
      });
      this.eventSubscriptions.push(unsub);
    }
  }

  exportAll(): Record<string, unknown> {
    return {
      metrics: this.metrics.export(),
      traces: this.traces.export(),
      timestamp: new Date().toISOString(),
    };
  }

  destroy(): void {
    for (const unsub of this.eventSubscriptions) {
      unsub();
    }
  }
}
