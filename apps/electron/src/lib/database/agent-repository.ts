import { BaseRepository } from "./base-repository";
import { SqliteManager, getSqliteManager } from "./sqlite-manager";
import { AgentConfig } from "@mcp-router/shared";
import { v4 as uuidv4 } from "uuid";

/**
 * エージェント情報用リポジトリクラス
 * BetterSQLite3を使用してエージェント情報を管理
 */
export class AgentRepository extends BaseRepository<AgentConfig> {
  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   */
  constructor(db: SqliteManager) {
    super(db, "agents");
    console.log(
      "[AgentRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * テーブルとインデックスを初期化
   * 注: このメソッドはテーブルの初期作成のみを行います
   * スキーマのマイグレーションはDatabaseMigrationクラスで一元管理されます
   */
  protected initializeTable(): void {
    try {
      // agentsテーブルの作成（存在しない場合）
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          mcp_servers TEXT NOT NULL,
          purpose TEXT NOT NULL,
          instructions TEXT NOT NULL,
          description TEXT DEFAULT '',
          tool_permissions TEXT DEFAULT '{}',
          auto_execute_tool INTEGER DEFAULT 0,
          setup_completed INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // インデックスの作成
      this.db.execute(
        `CREATE INDEX IF NOT EXISTS idx_agents_name ON ${this.tableName} (name)`,
      );
    } catch (error) {
      console.error(
        "エージェントテーブルの初期化中にエラーが発生しました:",
        error,
      );
      throw error;
    }
  }

  /**
   * DBの行をエンティティに変換
   */
  protected mapRowToEntity(row: any): AgentConfig {
    try {
      // エンティティオブジェクトを構築
      return {
        id: row.id,
        name: row.name,
        purpose: row.purpose || "",
        description: row.description || "",
        instructions: row.instructions || "",
        mcpServers: JSON.parse(row.mcp_servers || "[]"),
        toolPermissions: JSON.parse(row.tool_permissions || "{}"),
        autoExecuteTool: Boolean(row.auto_execute_tool),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error("エージェントデータの変換中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * エンティティをDBの行に変換
   */
  protected mapEntityToRow(entity: AgentConfig): Record<string, any> {
    try {
      const now = Date.now();

      // DB行オブジェクトを構築
      return {
        id: entity.id,
        name: entity.name,
        mcp_servers: JSON.stringify(entity.mcpServers || []),
        tool_permissions: JSON.stringify(entity.toolPermissions || {}),
        purpose: entity.purpose || "",
        description: entity.description || "",
        instructions: entity.instructions || "",
        auto_execute_tool: entity.autoExecuteTool ? 1 : 0,
        created_at: entity.createdAt || now,
        updated_at: now,
      };
    } catch (error) {
      console.error("エージェントデータの変換中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * エンティティをDBの行に変換（更新用、タイムスタンプを指定可能）
   */
  private mapEntityToRowForUpdate(
    entity: AgentConfig,
    createdAt: number,
  ): Record<string, any> {
    try {
      // DB行オブジェクトを構築
      return {
        id: entity.id,
        name: entity.name,
        mcp_servers: JSON.stringify(entity.mcpServers || []),
        tool_permissions: JSON.stringify(entity.toolPermissions || {}),
        purpose: entity.purpose || "",
        description: entity.description || "",
        instructions: entity.instructions || "",
        auto_execute_tool: entity.autoExecuteTool ? 1 : 0,
        created_at: createdAt,
        updated_at: Date.now(),
      };
    } catch (error) {
      console.error("エージェントデータの変換中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * エージェント情報を追加する
   * @param agentConfig エージェント設定情報
   * @returns 追加されたエージェント情報
   */
  public addAgent(agentConfig: AgentConfig): AgentConfig {
    try {
      const id = agentConfig.id || uuidv4();

      // Agentオブジェクトを作成
      const agent: AgentConfig = {
        ...agentConfig,
        id,
      };

      // リポジトリに追加
      this.add(agent);

      console.log(`エージェント "${agent.name}" が追加されました (ID: ${id})`);

      return agent;
    } catch (error) {
      console.error("エージェントの追加中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * 全てのエージェント情報を取得する
   * @returns エージェント情報の配列
   */
  public getAllAgents(): AgentConfig[] {
    try {
      return this.getAll();
    } catch (error) {
      console.error("エージェント情報の取得中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * 指定されたIDのエージェント情報を取得する
   * @param id エージェントID
   * @returns エージェント情報（存在しない場合はundefined）
   */
  public getAgentById(id: string): AgentConfig | undefined {
    try {
      return this.getById(id);
    } catch (error) {
      console.error(
        `ID: ${id} のエージェント情報の取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * エージェント情報を更新する
   * @param id エージェントID
   * @param config 更新するエージェント設定情報
   * @returns 更新されたエージェント情報（存在しない場合はundefined）
   */
  public updateAgent(
    id: string,
    config: Partial<AgentConfig>,
  ): AgentConfig | undefined {
    try {
      // 既存のエージェント情報を取得
      const existingAgent = this.getById(id);
      if (!existingAgent) {
        return undefined;
      }

      // 既存のcreatedAtを取得
      const createdAtResult = this.db.get<{ created_at: number }>(
        `SELECT created_at FROM ${this.tableName} WHERE id = :id`,
        { id },
      );
      const createdAt = createdAtResult?.created_at || Date.now();

      // 更新するフィールドを設定
      const updatedAgent: AgentConfig = {
        ...existingAgent,
        name: config.name !== undefined ? config.name : existingAgent.name,
        mcpServers:
          config.mcpServers !== undefined
            ? config.mcpServers
            : existingAgent.mcpServers,
        purpose:
          config.purpose !== undefined ? config.purpose : existingAgent.purpose,
        description:
          config.description !== undefined
            ? config.description
            : existingAgent.description,
        instructions:
          config.instructions !== undefined
            ? config.instructions
            : existingAgent.instructions,
        toolPermissions:
          config.toolPermissions !== undefined
            ? config.toolPermissions
            : existingAgent.toolPermissions,
        autoExecuteTool:
          config.autoExecuteTool !== undefined
            ? config.autoExecuteTool
            : existingAgent.autoExecuteTool,
      };

      // 行データを生成
      const row = this.mapEntityToRowForUpdate(updatedAgent, createdAt);

      // SET句を生成
      const setClauses = Object.keys(row)
        .filter((key) => key !== "id") // IDは更新しない
        .map((key) => `${key} = :${key}`)
        .join(", ");

      // SQL文を構築
      const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE id = :id`;

      // クエリを実行
      this.db.execute(sql, row);

      return updatedAgent;
    } catch (error) {
      console.error(
        `ID: ${id} のエージェント情報の更新中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * エージェント情報を削除する
   * @param id エージェントID
   * @returns 削除に成功した場合はtrue、失敗した場合はfalse
   */
  public deleteAgent(id: string): boolean {
    try {
      const agent = this.getById(id);
      if (!agent) {
        return false;
      }

      const result = this.delete(id);

      if (result) {
        console.log(
          `エージェント "${agent.name}" が削除されました (ID: ${id})`,
        );
      }

      return result;
    } catch (error) {
      console.error(
        `ID: ${id} のエージェント情報の削除中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }
}

/**
 * AgentRepositoryのシングルトンインスタンスを取得
 */
let instance: AgentRepository | null = null;
let currentDb: SqliteManager | null = null;

export function getAgentRepository(): AgentRepository {
  const db = getSqliteManager("mcprouter");

  // Check if database instance has changed
  if (!instance || currentDb !== db) {
    console.log(
      "[AgentRepository] Database instance changed, creating new repository",
    );
    instance = new AgentRepository(db);
    currentDb = db;
  }

  return instance;
}

/**
 * AgentRepositoryのインスタンスをリセット（ワークスペース切り替え時に使用）
 */
export function resetAgentRepository(): void {
  console.log("[AgentRepository] Resetting repository instance");
  instance = null;
  currentDb = null;
}
