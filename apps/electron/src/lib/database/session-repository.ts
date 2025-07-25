import { BaseRepository } from "./base-repository";
import { getSqliteManager, SqliteManager } from "./sqlite-manager";
import { v4 as uuidv4 } from "uuid";

/**
 * Chat session status enum
 */
export type SessionStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Chat session entity interface
 */
export interface ChatSession {
  id: string;
  agentId: string;
  messages: any[]; // Array of messages from @ai-sdk/react
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  source: string; // Where the session originated from (e.g., 'mcp', 'ui'), default: 'ui'
}

/**
 * Chat session repository for local database storage
 */
export class SessionRepository extends BaseRepository<ChatSession> {
  constructor(db: SqliteManager) {
    super(db, "chat_sessions");
    console.log(
      "[SessionRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * Initialize the chat_sessions table
   */
  protected initializeTable(): void {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        source TEXT NOT NULL DEFAULT 'ui'
      )
    `;

    this.db.execute(createTableSql);

    // Create index for agent_id to improve query performance
    this.db.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id)",
    );

    // Create index for created_at to improve sorting performance
    this.db.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at)",
    );

    // Create index for status to improve filtering performance
    this.db.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status)",
    );
  }

  /**
   * Map database row to ChatSession entity
   */
  protected mapRowToEntity(row: any): ChatSession {
    return {
      id: row.id,
      agentId: row.agent_id,
      messages: JSON.parse(row.messages || "[]"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: (row.status || "pending") as SessionStatus,
      source: row.source || "ui",
    };
  }

  /**
   * Map ChatSession entity to database row
   */
  protected mapEntityToRow(entity: ChatSession): Record<string, any> {
    return {
      id: entity.id,
      agent_id: entity.agentId,
      messages: JSON.stringify(entity.messages || []),
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      status: entity.status,
      source: entity.source,
    };
  }

  /**
   * Get sessions by agent ID with pagination
   */
  public getSessionsByAgent(
    agentId: string,
    options: {
      limit?: number;
      cursor?: string; // timestamp for cursor-based pagination
      orderBy?: "created_at" | "updated_at";
      order?: "ASC" | "DESC";
    } = {},
  ): { sessions: ChatSession[]; hasMore: boolean; nextCursor?: string } {
    try {
      const {
        limit = 10,
        cursor,
        orderBy = "updated_at",
        order = "DESC",
      } = options;

      // Build WHERE clause
      let whereClause = "agent_id = :agentId";
      const params: any = { agentId };

      // Add cursor condition for pagination
      if (cursor) {
        const cursorTimestamp = parseInt(cursor, 10);
        if (order === "DESC") {
          whereClause += ` AND ${orderBy} < :cursor`;
        } else {
          whereClause += ` AND ${orderBy} > :cursor`;
        }
        params.cursor = cursorTimestamp;
      }

      // Query with limit + 1 to check if there are more results
      const sql = `
        SELECT * FROM chat_sessions 
        WHERE ${whereClause} 
        ORDER BY ${orderBy} ${order} 
        LIMIT :limit
      `;

      const rows = this.db.all<any>(sql, {
        ...params,
        limit: limit + 1, // Get one extra to check if there are more
      });

      // Check if there are more results
      const hasMore = rows.length > limit;
      const sessions = rows
        .slice(0, limit)
        .map((row) => this.mapRowToEntity(row));

      // Get next cursor from the last item
      let nextCursor: string | undefined;
      if (hasMore && sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        nextCursor = String(
          orderBy === "created_at"
            ? lastSession.createdAt
            : lastSession.updatedAt,
        );
      }

      return {
        sessions,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error("Error getting sessions by agent:", error);
      throw error;
    }
  }

  /**
   * Create a new chat session
   */
  public createSession(
    agentId: string,
    initialMessages: any[] = [],
    source: string = "ui",
    status: SessionStatus = "pending",
  ): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: uuidv4(),
      agentId,
      messages: initialMessages,
      createdAt: now,
      updatedAt: now,
      status,
      source,
    };

    return this.add(session);
  }

  /**
   * Update session messages
   */
  public updateSessionMessages(
    sessionId: string,
    messages: any[],
  ): ChatSession | undefined {
    const session = this.getById(sessionId);
    if (!session) {
      return undefined;
    }

    return this.update(sessionId, {
      messages,
      updatedAt: Date.now(),
    });
  }

  /**
   * Add a message to an existing session
   */
  public addMessageToSession(
    sessionId: string,
    message: any,
  ): ChatSession | undefined {
    const session = this.getById(sessionId);
    if (!session) {
      return undefined;
    }

    const updatedMessages = [...session.messages, message];
    return this.updateSessionMessages(sessionId, updatedMessages);
  }

  /**
   * Delete sessions by agent ID
   */
  public deleteSessionsByAgent(agentId: string): number {
    try {
      const sql = "DELETE FROM chat_sessions WHERE agent_id = :agentId";
      const result = this.db.execute(sql, { agentId });
      return Number(result.changes) || 0;
    } catch (error) {
      console.error("Error deleting sessions by agent:", error);
      throw error;
    }
  }

  /**
   * Get session count by agent
   */
  public getSessionCountByAgent(agentId: string): number {
    return this.count({ agent_id: agentId });
  }

  /**
   * Update session status
   */
  public updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
  ): ChatSession | undefined {
    const session = this.getById(sessionId);
    if (!session) {
      return undefined;
    }

    return this.update(sessionId, {
      status,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get sessions by status with optional filtering by agent ID
   */
  public getSessionsByStatus(
    status: SessionStatus,
    agentId?: string,
    options: {
      limit?: number;
      cursor?: string;
      orderBy?: "created_at" | "updated_at";
      order?: "ASC" | "DESC";
    } = {},
  ): { sessions: ChatSession[]; hasMore: boolean; nextCursor?: string } {
    try {
      const {
        limit = 10,
        cursor,
        orderBy = "updated_at",
        order = "DESC",
      } = options;

      // Build WHERE clause
      let whereClause = "status = :status";
      const params: any = { status };

      if (agentId) {
        whereClause += " AND agent_id = :agentId";
        params.agentId = agentId;
      }

      // Add cursor condition for pagination
      if (cursor) {
        const cursorTimestamp = parseInt(cursor, 10);
        if (order === "DESC") {
          whereClause += ` AND ${orderBy} < :cursor`;
        } else {
          whereClause += ` AND ${orderBy} > :cursor`;
        }
        params.cursor = cursorTimestamp;
      }

      // Query with limit + 1 to check if there are more results
      const sql = `
        SELECT * FROM chat_sessions 
        WHERE ${whereClause} 
        ORDER BY ${orderBy} ${order} 
        LIMIT :limit
      `;

      const rows = this.db.all<any>(sql, {
        ...params,
        limit: limit + 1, // Get one extra to check if there are more
      });

      // Check if there are more results
      const hasMore = rows.length > limit;
      const sessions = rows
        .slice(0, limit)
        .map((row) => this.mapRowToEntity(row));

      // Get next cursor from the last item
      let nextCursor: string | undefined;
      if (hasMore && sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        nextCursor = String(
          orderBy === "created_at"
            ? lastSession.createdAt
            : lastSession.updatedAt,
        );
      }

      return {
        sessions,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error("Error getting sessions by status:", error);
      throw error;
    }
  }

  /**
   * Get session by ID with full details (for MCP query results)
   */
  public getSessionWithResults(sessionId: string): ChatSession | undefined {
    return this.getById(sessionId);
  }

  /**
   * Get recent sessions across all statuses
   */
  public getRecentSessions(
    options: {
      limit?: number;
      cursor?: string;
      source?: string;
      orderBy?: "created_at" | "updated_at";
      order?: "ASC" | "DESC";
    } = {},
  ): { sessions: ChatSession[]; hasMore: boolean; nextCursor?: string } {
    try {
      const {
        limit = 10,
        cursor,
        source,
        orderBy = "updated_at",
        order = "DESC",
      } = options;

      // Build WHERE clause
      let whereClause = "1=1"; // Always true to start
      const params: any = {};

      if (source) {
        whereClause += " AND source = :source";
        params.source = source;
      }

      // Add cursor condition for pagination
      if (cursor) {
        const cursorTimestamp = parseInt(cursor, 10);
        if (order === "DESC") {
          whereClause += ` AND ${orderBy} < :cursor`;
        } else {
          whereClause += ` AND ${orderBy} > :cursor`;
        }
        params.cursor = cursorTimestamp;
      }

      // Query with limit + 1 to check if there are more results
      const sql = `
        SELECT * FROM chat_sessions 
        WHERE ${whereClause} 
        ORDER BY ${orderBy} ${order} 
        LIMIT :limit
      `;

      const rows = this.db.all<any>(sql, {
        ...params,
        limit: limit + 1, // Get one extra to check if there are more
      });

      // Check if there are more results
      const hasMore = rows.length > limit;
      const sessions = rows
        .slice(0, limit)
        .map((row) => this.mapRowToEntity(row));

      // Get next cursor from the last item
      let nextCursor: string | undefined;
      if (hasMore && sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        nextCursor = String(
          orderBy === "created_at"
            ? lastSession.createdAt
            : lastSession.updatedAt,
        );
      }

      return {
        sessions,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error("Error getting recent sessions:", error);
      throw error;
    }
  }

  /**
   * Clean up old sessions (keep only the most recent N sessions per agent)
   */
  public cleanupOldSessions(maxSessionsPerAgent: number = 100): void {
    try {
      // Get all agent IDs
      const agentIds = this.db.all<{ agent_id: string }>(
        "SELECT DISTINCT agent_id FROM chat_sessions",
      );

      for (const { agent_id: agentId } of agentIds) {
        // Get sessions for this agent, ordered by updated_at DESC
        const sessions = this.db.all<{ id: string }>(
          `SELECT id FROM chat_sessions 
           WHERE agent_id = :agentId 
           ORDER BY updated_at DESC 
           LIMIT -1 OFFSET :offset`,
          { agentId, offset: maxSessionsPerAgent },
        );

        // Delete old sessions
        if (sessions.length > 0) {
          const sessionIds = sessions.map((s) => s.id);
          const placeholders = sessionIds.map(() => "?").join(",");
          this.db.execute(
            `DELETE FROM chat_sessions WHERE id IN (${placeholders})`,
            sessionIds,
          );
          console.log(
            `Cleaned up ${sessions.length} old sessions for agent ${agentId}`,
          );
        }
      }
    } catch (error) {
      console.error("Error cleaning up old sessions:", error);
      throw error;
    }
  }
}

// Singleton instance
let sessionRepositoryInstance: SessionRepository | null = null;
let currentDb: SqliteManager | null = null;

/**
 * Get the singleton instance of SessionRepository
 */
export function getSessionRepository(): SessionRepository {
  const db = getSqliteManager("mcprouter");

  // Check if database instance has changed
  if (!sessionRepositoryInstance || currentDb !== db) {
    console.log(
      "[SessionRepository] Database instance changed, creating new repository",
    );
    sessionRepositoryInstance = new SessionRepository(db);
    currentDb = db;
  }

  return sessionRepositoryInstance;
}

/**
 * Reset SessionRepository instance (used when switching workspaces)
 */
export function resetSessionRepository(): void {
  console.log("[SessionRepository] Resetting repository instance");
  sessionRepositoryInstance = null;
  currentDb = null;
}
