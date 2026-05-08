/**
 * 🎵 Chorus — Memory Store
 * Multi-layered memory system: short-term, long-term, episodic, semantic
 */

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { childLogger } from '../core/logger.js';
import { MemoryError } from '../core/errors.js';
import type {
  MemoryConfig,
  MemoryEntry,
  ConversationMessage,
  Episode,
} from '../types/index.js';

const logger = childLogger('memory');

// ═══════════════════════════════════════════════════════════════
// Memory Store
// ═══════════════════════════════════════════════════════════════

export class MemoryStore {
  private db: Database.Database | null = null;
  private config: MemoryConfig;
  private inMemoryStore: Map<string, MemoryEntry[]> = new Map();
  private conversationBuffers: Map<string, ConversationMessage[]> = new Map();

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  /**
   * Initialize the memory store
   */
  async initialize(): Promise<void> {
    if (this.config.backend === 'sqlite') {
      await this.initSQLite();
    } else if (this.config.backend === 'redis') {
      throw new MemoryError('Redis backend not yet implemented. Use sqlite or in-memory.');
    }
    logger.info({ backend: this.config.backend }, 'Memory store initialized');
  }

  private async initSQLite(): Promise<void> {
    const dbPath = this.config.sqlitePath || './data/chorus-memory.db';
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT DEFAULT '{}',
        importance REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        timestamp TEXT NOT NULL,
        tokens_used INTEGER
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        plan TEXT NOT NULL,
        outcome TEXT NOT NULL,
        lessons_learned TEXT DEFAULT '[]',
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_agent ON episodes(agent_id);
    `);

    logger.info({ dbPath }, 'SQLite memory store initialized');
  }

  // ═══════════════════════════════════════════════════════════
  // Memory Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Store a memory entry
   */
  async store(entry: Omit<MemoryEntry, 'id' | 'accessCount' | 'lastAccessedAt'>): Promise<MemoryEntry> {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: nanoid(12),
      accessCount: 0,
      lastAccessedAt: new Date().toISOString(),
    };

    if (this.config.backend === 'sqlite' && this.db) {
      this.db.prepare(`
        INSERT INTO memories (id, namespace, type, content, embedding, metadata, importance, access_count, created_at, last_accessed_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fullEntry.id,
        fullEntry.namespace,
        fullEntry.type,
        fullEntry.content,
        fullEntry.embedding ? Buffer.from(new Float32Array(fullEntry.embedding).buffer) : null,
        JSON.stringify(fullEntry.metadata),
        fullEntry.importance,
        fullEntry.accessCount,
        fullEntry.createdAt,
        fullEntry.lastAccessedAt,
        fullEntry.expiresAt || null
      );
    } else {
      // In-memory fallback
      const key = `${fullEntry.namespace}:${fullEntry.type}`;
      if (!this.inMemoryStore.has(key)) {
        this.inMemoryStore.set(key, []);
      }
      this.inMemoryStore.get(key)!.push(fullEntry);
    }

    logger.debug({ id: fullEntry.id, namespace: fullEntry.namespace, type: fullEntry.type }, 'Stored memory');
    return fullEntry;
  }

  /**
   * Recall memories by namespace and type
   */
  async recall(
    namespace: string,
    type?: MemoryEntry['type'],
    options?: { limit?: number; minImportance?: number; query?: string }
  ): Promise<MemoryEntry[]> {
    const limit = options?.limit || 10;
    const minImportance = options?.minImportance || 0;

    if (this.config.backend === 'sqlite' && this.db) {
      let sql = `SELECT * FROM memories WHERE namespace = ? AND importance >= ?`;
      const params: unknown[] = [namespace, minImportance];

      if (type) {
        sql += ` AND type = ?`;
        params.push(type);
      }

      // Filter expired
      sql += ` AND (expires_at IS NULL OR expires_at > ?)`;
      params.push(new Date().toISOString());

      sql += ` ORDER BY importance DESC, last_accessed_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(sql).all(...params) as Array<{
        id: string;
        namespace: string;
        type: string;
        content: string;
        embedding: Buffer | null;
        metadata: string;
        importance: number;
        access_count: number;
        created_at: string;
        last_accessed_at: string;
        expires_at: string | null;
      }>;

      // Update access counts
      const updateStmt = this.db.prepare(
        `UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`
      );
      const now = new Date().toISOString();

      return rows.map(row => {
        updateStmt.run(now, row.id);
        return {
          id: row.id,
          namespace: row.namespace,
          type: row.type as MemoryEntry['type'],
          content: row.content,
          embedding: row.embedding
            ? Array.from(new Float32Array(row.embedding.buffer))
            : undefined,
          metadata: JSON.parse(row.metadata),
          importance: row.importance,
          accessCount: row.access_count + 1,
          createdAt: row.created_at,
          lastAccessedAt: now,
          expiresAt: row.expires_at || undefined,
        };
      });
    }

    // In-memory
    const key = `${namespace}:${type || '*'}`;
    const allEntries: MemoryEntry[] = [];
    for (const [k, entries] of this.inMemoryStore) {
      if (k.startsWith(namespace)) {
        allEntries.push(...entries);
      }
    }

    return allEntries
      .filter(e => e.importance >= minImportance)
      .filter(e => !e.expiresAt || new Date(e.expiresAt) > new Date())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Search memories by content similarity (simple keyword match)
   */
  async search(
    query: string,
    namespace?: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    if (this.config.backend === 'sqlite' && this.db) {
      let sql = `SELECT * FROM memories WHERE content LIKE ?`;
      const params: unknown[] = [`%${query}%`];

      if (namespace) {
        sql += ` AND namespace = ?`;
        params.push(namespace);
      }

      sql += ` AND (expires_at IS NULL OR expires_at > ?)`;
      params.push(new Date().toISOString());

      sql += ` ORDER BY importance DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(sql).all(...params) as Array<{
        id: string;
        namespace: string;
        type: string;
        content: string;
        embedding: Buffer | null;
        metadata: string;
        importance: number;
        access_count: number;
        created_at: string;
        last_accessed_at: string;
        expires_at: string | null;
      }>;

      return rows.map(row => ({
        id: row.id,
        namespace: row.namespace,
        type: row.type as MemoryEntry['type'],
        content: row.content,
        metadata: JSON.parse(row.metadata),
        importance: row.importance,
        accessCount: row.access_count,
        createdAt: row.created_at,
        lastAccessedAt: row.last_accessed_at,
        expiresAt: row.expires_at || undefined,
      }));
    }

    // In-memory search
    const results: MemoryEntry[] = [];
    for (const entries of this.inMemoryStore.values()) {
      for (const entry of entries) {
        if (entry.content.toLowerCase().includes(query.toLowerCase())) {
          results.push(entry);
        }
      }
    }

    return results
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Forget (delete) a memory
   */
  async forget(id: string): Promise<boolean> {
    if (this.config.backend === 'sqlite' && this.db) {
      const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      return result.changes > 0;
    }

    for (const entries of this.inMemoryStore.values()) {
      const idx = entries.findIndex(e => e.id === id);
      if (idx !== -1) {
        entries.splice(idx, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Clean up expired memories
   */
  async cleanup(): Promise<number> {
    if (this.config.backend === 'sqlite' && this.db) {
      const result = this.db.prepare(
        `DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?`
      ).run(new Date().toISOString());
      return result.changes;
    }

    let cleaned = 0;
    const now = new Date();
    for (const entries of this.inMemoryStore.values()) {
      const before = entries.length;
      const filtered = entries.filter(e => !e.expiresAt || new Date(e.expiresAt) > now);
      entries.length = 0;
      entries.push(...filtered);
      cleaned += before - filtered.length;
    }

    return cleaned;
  }

  // ═══════════════════════════════════════════════════════════
  // Conversation Buffer
  // ═══════════════════════════════════════════════════════════

  /**
   * Add a message to conversation history
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    if (this.config.backend === 'sqlite' && this.db) {
      this.db.prepare(`
        INSERT INTO conversations (id, session_id, role, content, name, tool_call_id, tool_calls, timestamp, tokens_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        message.id,
        sessionId,
        message.role,
        message.content,
        message.name || null,
        message.toolCallId || null,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.timestamp,
        message.tokensUsed || null
      );
    } else {
      if (!this.conversationBuffers.has(sessionId)) {
        this.conversationBuffers.set(sessionId, []);
      }
      this.conversationBuffers.get(sessionId)!.push(message);

      // Trim to max size
      const buffer = this.conversationBuffers.get(sessionId)!;
      if (buffer.length > this.config.maxShortTermMessages) {
        buffer.splice(0, buffer.length - this.config.maxShortTermMessages);
      }
    }
  }

  /**
   * Get conversation history
   */
  async getConversation(sessionId: string, limit?: number): Promise<ConversationMessage[]> {
    const maxMessages = limit || this.config.maxShortTermMessages;

    if (this.config.backend === 'sqlite' && this.db) {
      const rows = this.db.prepare(
        `SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`
      ).all(sessionId, maxMessages) as Array<{
        id: string;
        session_id: string;
        role: string;
        content: string;
        name: string | null;
        tool_call_id: string | null;
        tool_calls: string | null;
        timestamp: string;
        tokens_used: number | null;
      }>;

      return rows.reverse().map(row => ({
        id: row.id,
        role: row.role as ConversationMessage['role'],
        content: row.content,
        name: row.name || undefined,
        toolCallId: row.tool_call_id || undefined,
        toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
        timestamp: row.timestamp,
        tokensUsed: row.tokens_used || undefined,
      }));
    }

    const buffer = this.conversationBuffers.get(sessionId) || [];
    return buffer.slice(-maxMessages);
  }

  /**
   * Clear conversation history
   */
  async clearConversation(sessionId: string): Promise<void> {
    if (this.config.backend === 'sqlite' && this.db) {
      this.db.prepare('DELETE FROM conversations WHERE session_id = ?').run(sessionId);
    }
    this.conversationBuffers.delete(sessionId);
  }

  // ═══════════════════════════════════════════════════════════
  // Episodic Memory
  // ═══════════════════════════════════════════════════════════

  /**
   * Store an episode (complete execution record)
   */
  async storeEpisode(episode: Episode): Promise<void> {
    if (this.config.backend === 'sqlite' && this.db) {
      this.db.prepare(`
        INSERT INTO episodes (id, agent_id, goal, plan, outcome, lessons_learned, total_tokens, total_cost, duration_ms, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        episode.id,
        episode.agentId,
        episode.goal,
        JSON.stringify(episode.plan),
        episode.outcome,
        JSON.stringify(episode.lessonsLearned),
        episode.totalTokens,
        episode.totalCost,
        episode.durationMs,
        episode.startedAt,
        episode.completedAt
      );
    }

    logger.info({ episodeId: episode.id, outcome: episode.outcome }, 'Stored episode');
  }

  /**
   * Get episodes for an agent
   */
  async getEpisodes(agentId: string, limit: number = 10): Promise<Episode[]> {
    if (this.config.backend === 'sqlite' && this.db) {
      const rows = this.db.prepare(
        `SELECT * FROM episodes WHERE agent_id = ? ORDER BY completed_at DESC LIMIT ?`
      ).all(agentId, limit) as Array<{
        id: string;
        agent_id: string;
        goal: string;
        plan: string;
        outcome: string;
        lessons_learned: string;
        total_tokens: number;
        total_cost: number;
        duration_ms: number;
        started_at: string;
        completed_at: string;
      }>;

      return rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        goal: row.goal,
        plan: JSON.parse(row.plan),
        outcome: row.outcome as Episode['outcome'],
        lessonsLearned: JSON.parse(row.lessons_learned),
        totalTokens: row.total_tokens,
        totalCost: row.total_cost,
        durationMs: row.duration_ms,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      }));
    }

    return [];
  }

  /**
   * Get lessons learned from past episodes
   */
  async getLessons(agentId: string, limit: number = 5): Promise<string[]> {
    const episodes = await this.getEpisodes(agentId, limit);
    const lessons: string[] = [];

    for (const episode of episodes) {
      lessons.push(...episode.lessonsLearned);
    }

    return [...new Set(lessons)].slice(0, limit * 3);
  }

  // ═══════════════════════════════════════════════════════════
  // Statistics
  // ═══════════════════════════════════════════════════════════

  async getStats(): Promise<{
    totalMemories: number;
    totalConversations: number;
    totalEpisodes: number;
    byType: Record<string, number>;
  }> {
    if (this.config.backend === 'sqlite' && this.db) {
      const totalMemories = (this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }).count;
      const totalConversations = (this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;
      const totalEpisodes = (this.db.prepare('SELECT COUNT(*) as count FROM episodes').get() as { count: number }).count;

      const byTypeRows = this.db.prepare(
        'SELECT type, COUNT(*) as count FROM memories GROUP BY type'
      ).all() as Array<{ type: string; count: number }>;

      const byType: Record<string, number> = {};
      for (const row of byTypeRows) {
        byType[row.type] = row.count;
      }

      return { totalMemories, totalConversations, totalEpisodes, byType };
    }

    let total = 0;
    const byType: Record<string, number> = {};
    for (const entries of this.inMemoryStore.values()) {
      total += entries.length;
      for (const entry of entries) {
        byType[entry.type] = (byType[entry.type] || 0) + 1;
      }
    }

    return {
      totalMemories: total,
      totalConversations: Array.from(this.conversationBuffers.values()).reduce((a, b) => a + b.length, 0),
      totalEpisodes: 0,
      byType,
    };
  }

  /**
   * Close the memory store
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    logger.info('Memory store closed');
  }
}
