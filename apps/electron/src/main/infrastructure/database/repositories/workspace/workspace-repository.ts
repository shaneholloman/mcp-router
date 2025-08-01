import { BaseRepository } from "../../core/base-repository";
import { SqliteManager } from "../../core/sqlite-manager";
import { Workspace } from "@mcp_router/shared";

export class WorkspaceRepository extends BaseRepository<Workspace> {
  constructor(db: SqliteManager) {
    super(db, "workspaces");
    console.log(
      "[WorkspaceRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * テーブルを初期化（BaseRepositoryの抽象メソッドを実装）
   */
  protected initializeTable(): void {
    try {
      // workspacesテーブルを作成（存在しない場合）
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('local', 'remote')),
          isActive INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          lastUsedAt TEXT NOT NULL,
          localConfig TEXT,
          remoteConfig TEXT,
          displayInfo TEXT
        )
      `);

      // インデックスを作成
      this.db.execute(
        "CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(isActive)",
      );
      this.db.execute(
        "CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type)",
      );
      this.db.execute(
        "CREATE INDEX IF NOT EXISTS idx_workspaces_last_used ON workspaces(lastUsedAt)",
      );

      console.log("[WorkspaceRepository] テーブルの初期化が完了しました");
    } catch (error) {
      console.error("[WorkspaceRepository] テーブルの初期化中にエラー:", error);
      throw error;
    }
  }

  /**
   * データベースから取得したレコードをWorkspaceオブジェクトに変換
   */
  protected mapRowToEntity(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isActive: row.isActive === 1,
      createdAt: new Date(row.createdAt),
      lastUsedAt: new Date(row.lastUsedAt),
      localConfig: row.localConfig ? JSON.parse(row.localConfig) : undefined,
      remoteConfig: row.remoteConfig ? JSON.parse(row.remoteConfig) : undefined,
      displayInfo: row.displayInfo ? JSON.parse(row.displayInfo) : undefined,
    };
  }

  /**
   * Workspaceオブジェクトをデータベース保存用に変換
   */
  protected mapEntityToRow(workspace: Workspace): any {
    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      isActive: workspace.isActive ? 1 : 0,
      createdAt: workspace.createdAt.toISOString(),
      lastUsedAt: workspace.lastUsedAt.toISOString(),
      localConfig: workspace.localConfig
        ? JSON.stringify(workspace.localConfig)
        : null,
      remoteConfig: workspace.remoteConfig
        ? JSON.stringify(workspace.remoteConfig)
        : null,
      displayInfo: workspace.displayInfo
        ? JSON.stringify(workspace.displayInfo)
        : null,
    };
  }

  /**
   * アクティブワークスペースを取得
   */
  getActiveWorkspace(): Workspace | null {
    return this.findOne("isActive = ?", [1]);
  }

  /**
   * ワークスペースを切り替え
   */
  setActiveWorkspace(workspaceId: string): void {
    this.db.transaction(() => {
      // 全てのワークスペースを非アクティブに
      this.db.execute("UPDATE workspaces SET isActive = 0");
      // 指定されたワークスペースをアクティブに
      this.db.execute(
        "UPDATE workspaces SET isActive = 1, lastUsedAt = :lastUsedAt WHERE id = :id",
        {
          lastUsedAt: new Date().toISOString(),
          id: workspaceId,
        },
      );
    });
  }

  /**
   * 暗号化された認証情報を更新
   */
  updateCredentials(workspaceId: string, encryptedToken: Buffer): void {
    const workspace = this.findById(workspaceId);
    if (!workspace) {
      throw new Error("ワークスペースが見つかりません");
    }

    const remoteConfig: any = workspace.remoteConfig || {};
    remoteConfig.authToken = encryptedToken.toString("base64");

    this.db.execute(
      "UPDATE workspaces SET remoteConfig = :remoteConfig WHERE id = :id",
      {
        remoteConfig: JSON.stringify(remoteConfig),
        id: workspaceId,
      },
    );
  }

  /**
   * 暗号化された認証情報を取得
   */
  getCredentials(workspaceId: string): string | null {
    const workspace = this.findById(workspaceId);
    if (!workspace || !workspace.remoteConfig) {
      return null;
    }

    return workspace.remoteConfig.authToken || null;
  }
}
