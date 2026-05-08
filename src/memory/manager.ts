/**
 * 🎵 Chorus — Enhanced Memory Manager
 * Persistent memory with semantic search, embeddings, and knowledge graph
 */

import { childLogger } from '../core/logger.js';
import { MemoryStore } from './store.js';
import type { MemoryConfig, MemoryEntry, ConversationMessage, Episode } from '../types/index.js';

const logger = childLogger('memory-manager');

// ═══════════════════════════════════════════════════════════════
// Enhanced Memory Manager
// ═══════════════════════════════════════════════════════════════

export class MemoryManager {
  private store: MemoryStore;
  private config: MemoryConfig;
  private knowledgeGraph: Map<string, Set<string>> = new Map();

  constructor(config: MemoryConfig) {
    this.config = config;
    this.store = new MemoryStore(config);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    logger.info('Memory manager initialized');
  }

  // ═══════════════════════════════════════════════════════════
  // Smart Memory Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Remember something with automatic importance scoring
   */
  async remember(
    content: string,
    options: {
      namespace?: string;
      type?: MemoryEntry['type'];
      importance?: number;
      metadata?: Record<string, unknown>;
      autoLink?: boolean;
    } = {}
  ): Promise<MemoryEntry> {
    const namespace = options.namespace || 'default';
    const type = options.type || 'long-term';

    // Auto-calculate importance if not provided
    const importance = options.importance ?? this.calculateImportance(content);

    const entry = await this.store.store({
      namespace,
      type,
      content,
      importance,
      metadata: options.metadata || {},
      createdAt: new Date().toISOString(),
    });

    // Auto-link to related memories
    if (options.autoLink !== false) {
      await this.linkRelated(entry);
    }

    return entry;
  }

  /**
   * Recall memories with smart ranking
   */
  async recall(
    query: string,
    options: {
      namespace?: string;
      type?: MemoryEntry['type'];
      limit?: number;
      minImportance?: number;
      includeEpisodic?: boolean;
    } = {}
  ): Promise<MemoryEntry[]> {
    const namespace = options.namespace || 'default';
    const limit = options.limit || 10;

    // Search by content
    const contentMatches = await this.store.search(query, namespace, limit);

    // Get high-importance memories
    const importantMemories = await this.store.recall(namespace, options.type, {
      limit: Math.ceil(limit / 2),
      minImportance: options.minImportance || 0.7,
    });

    // Merge and deduplicate
    const seen = new Set<string>();
    const results: MemoryEntry[] = [];

    for (const entry of [...contentMatches, ...importantMemories]) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        results.push(entry);
      }
    }

    // Sort by relevance (importance * recency)
    results.sort((a, b) => {
      const scoreA = a.importance * (1 + a.accessCount * 0.1);
      const scoreB = b.importance * (1 + b.accessCount * 0.1);
      return scoreB - scoreA;
    });

    return results.slice(0, limit);
  }

  /**
   * Remember a conversation turn
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    await this.store.addMessage(sessionId, message);

    // Extract and store important facts from user messages
    if (message.role === 'user' && message.content.length > 20) {
      const facts = this.extractFacts(message.content);
      for (const fact of facts) {
        await this.remember(fact, {
          namespace: `session-${sessionId}`,
          type: 'short-term',
          importance: 0.5,
          metadata: { sessionId, source: 'conversation' },
        });
      }
    }
  }

  /**
   * Get conversation history
   */
  async getConversation(sessionId: string, limit?: number): Promise<ConversationMessage[]> {
    return this.store.getConversation(sessionId, limit);
  }

  /**
   * Store an episode (complete execution record)
   */
  async storeEpisode(episode: Episode): Promise<void> {
    await this.store.storeEpisode(episode);

    // Store lessons as long-term memories
    for (const lesson of episode.lessonsLearned) {
      await this.remember(lesson, {
        namespace: `agent-${episode.agentId}`,
        type: 'long-term',
        importance: 0.8,
        metadata: { episodeId: episode.id, goal: episode.goal },
      });
    }
  }

  /**
   * Get lessons from past episodes
   */
  async getLessons(agentId: string, limit?: number): Promise<string[]> {
    return this.store.getLessons(agentId, limit);
  }

  /**
   * Search across all memory types
   */
  async search(query: string, namespace?: string, limit?: number): Promise<MemoryEntry[]> {
    return this.store.search(query, namespace, limit);
  }

  // ═══════════════════════════════════════════════════════════
  // Knowledge Graph
  // ═══════════════════════════════════════════════════════════

  /**
   * Link two memories conceptually
   */
  async link(memIdA: string, memIdB: string): Promise<void> {
    if (!this.knowledgeGraph.has(memIdA)) {
      this.knowledgeGraph.set(memIdA, new Set());
    }
    if (!this.knowledgeGraph.has(memIdB)) {
      this.knowledgeGraph.set(memIdB, new Set());
    }
    this.knowledgeGraph.get(memIdA)!.add(memIdB);
    this.knowledgeGraph.get(memIdB)!.add(memIdA);
  }

  /**
   * Get related memories via knowledge graph
   */
  async getRelated(memId: string): Promise<string[]> {
    const related = this.knowledgeGraph.get(memId);
    return related ? Array.from(related) : [];
  }

  /**
   * Auto-link a new memory to related existing ones
   */
  private async linkRelated(entry: MemoryEntry): Promise<void> {
    const related = await this.store.search(entry.content.slice(0, 100), entry.namespace, 3);

    for (const relatedEntry of related) {
      if (relatedEntry.id !== entry.id) {
        await this.link(entry.id, relatedEntry.id);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Intelligence Helpers
  // ═══════════════════════════════════════════════════════════

  /**
   * Calculate importance score for content
   */
  private calculateImportance(content: string): number {
    let score = 0.5;

    // Longer content is usually more important
    if (content.length > 200) score += 0.1;
    if (content.length > 500) score += 0.1;

    // Keywords that indicate importance
    const importantKeywords = [
      'important', 'critical', 'urgent', 'remember', 'never', 'always',
      'prefer', 'dislike', 'like', 'favorite', 'hate', 'love',
      'password', 'key', 'secret', 'confidential',
      'deadline', 'due', 'schedule', 'appointment',
      'error', 'bug', 'issue', 'problem', 'fix',
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
        break;
      }
    }

    // Questions are usually less important to remember
    if (content.includes('?') && content.length < 100) {
      score -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, score));
  }

  /**
   * Extract facts from user messages
   */
  private extractFacts(content: string): string[] {
    const facts: string[] = [];

    // Pattern: "I [verb] [object]"
    const iPattern = /I (?:prefer|like|love|hate|dislike|want|need|use|work|live|am) [^.!?]+/gi;
    const iMatches = content.match(iPattern);
    if (iMatches) facts.push(...iMatches);

    // Pattern: "My [noun] is [value]"
    const myPattern = /My \w+ is [^.!?]+/gi;
    const myMatches = content.match(myPattern);
    if (myMatches) facts.push(...myMatches);

    // Pattern: "Remember that [fact]"
    const rememberPattern = /(?:remember|note|don't forget) (?:that )?[^.!?]+/gi;
    const rememberMatches = content.match(rememberPattern);
    if (rememberMatches) facts.push(...rememberMatches);

    return facts.slice(0, 3); // Max 3 facts per message
  }

  // ═══════════════════════════════════════════════════════════
  // Maintenance
  // ═══════════════════════════════════════════════════════════

  /**
   * Clean up expired memories
   */
  async cleanup(): Promise<number> {
    return this.store.cleanup();
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    totalConversations: number;
    totalEpisodes: number;
    byType: Record<string, number>;
    graphNodes: number;
    graphEdges: number;
  }> {
    const baseStats = await this.store.getStats();

    let graphEdges = 0;
    for (const links of this.knowledgeGraph.values()) {
      graphEdges += links.size;
    }

    return {
      ...baseStats,
      graphNodes: this.knowledgeGraph.size,
      graphEdges: graphEdges / 2, // Undirected edges counted twice
    };
  }

  /**
   * Export memories for backup
   */
  async export(namespace?: string): Promise<MemoryEntry[]> {
    return this.store.recall(namespace || 'default', undefined, { limit: 10000 });
  }

  /**
   * Close the memory manager
   */
  async close(): Promise<void> {
    await this.store.close();
  }
}
