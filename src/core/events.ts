/**
 * 🎵 Chorus — Event Bus
 * Central nervous system for all agent events
 */

import { EventEmitter } from 'events';
import type { ChorusEvent, ChorusEventType } from '../types/index.js';

type EventHandler = (event: ChorusEvent) => void | Promise<void>;

export class ChorusEventBus extends EventEmitter {
  private handlers: Map<ChorusEventType, Set<EventHandler>> = new Map();
  private eventLog: ChorusEvent[] = [];
  private maxLogSize: number;

  constructor(maxLogSize: number = 10000) {
    super();
    this.maxLogSize = maxLogSize;
    this.setMaxListeners(100);
  }

  /**
   * Emit a Chorus event with automatic logging
   */
  emitChorus(event: ChorusEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    this.emit(event.type, event);
    this.emit('*', event); // Wildcard listeners
  }

  /**
   * Subscribe to specific event types
   */
  onChorus(type: ChorusEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    this.on(type, handler as (...args: unknown[]) => void);

    return () => {
      this.handlers.get(type)?.delete(handler);
      this.off(type, handler as (...args: unknown[]) => void);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler): () => void {
    return this.onChorus('agent:created', handler); // placeholder
  }

  /**
   * Wait for a specific event
   */
  waitFor(type: ChorusEventType, timeoutMs: number = 30000): Promise<ChorusEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(type, handler);
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeoutMs);

      const handler = (event: ChorusEvent) => {
        clearTimeout(timer);
        resolve(event);
      };

      this.once(type, handler);
    });
  }

  /**
   * Get event history for an agent
   */
  getAgentEvents(agentId: string, limit?: number): ChorusEvent[] {
    const events = this.eventLog.filter(e => e.agentId === agentId);
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get recent events of a specific type
   */
  getRecentEvents(type: ChorusEventType, limit: number = 50): ChorusEvent[] {
    return this.eventLog.filter(e => e.type === type).slice(-limit);
  }

  /**
   * Get full event log
   */
  getEventLog(limit?: number): ChorusEvent[] {
    return limit ? this.eventLog.slice(-limit) : [...this.eventLog];
  }

  /**
   * Clear event log
   */
  clearLog(): void {
    this.eventLog = [];
  }
}

// Singleton instance
export const eventBus = new ChorusEventBus();
