/**
 * リクエストログ関連の型定義
 */

import { CursorPaginationOptions, CursorPaginationResult } from "./pagination";

/**
 * リクエストログエントリのインターフェース
 */
export interface RequestLogEntry {
  id: string; // 一意のID
  timestamp: number; // UNIX タイムスタンプ
  clientId: string; // クライアント識別子
  clientName: string; // クライアント名
  serverId: string; // サーバ識別子
  serverName: string; // サーバ名
  requestType: string; // リクエストタイプ（CallTool, ReadResource など）
  requestParams: any; // リクエストパラメータ
  responseStatus: "success" | "error"; // レスポンスステータス
  responseData?: any; // レスポンスデータ
  duration: number; // 処理時間（ms）
  errorMessage?: string; // エラーメッセージ（あれば）
}

/**
 * リクエストログ新規作成時の入力インターフェース（idとtimestampは自動生成）
 */
export type RequestLogEntryInput = Omit<RequestLogEntry, "id" | "timestamp">;

/**
 * 時系列データポイントのインターフェース
 */
export interface TimeSeriesDataPoint {
  timestamp: number;
  timeBucket: string;
  requestType: string;
  count: number;
  clientId: string; // クライアント識別子
  clientName?: string; // クライアント名 (オプショナル)
  serverId?: string; // サーバ識別子 (オプショナル)
  serverName?: string; // サーバ名 (オプショナル)
}

/**
 * リクエストログクエリのフィルターオプション
 */
export interface RequestLogFilters {
  clientId?: string;
  serverId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  responseStatus?: "success" | "error";
}

/**
 * リクエストログクエリのオプション
 */
export interface RequestLogQueryOptions
  extends RequestLogFilters,
    CursorPaginationOptions {}

/**
 * リクエストログクエリの結果
 */
export interface RequestLogQueryResult
  extends CursorPaginationResult<RequestLogEntry> {
  logs: RequestLogEntry[]; // 互換性のため残す
}

/**
 * クライアント統計情報
 */
export interface ClientStats {
  clientId: string;
  clientName: string;
  requestCount: number;
}

/**
 * サーバ統計情報
 */
export interface ServerStats {
  serverId: string;
  serverName: string;
  requestCount: number;
}

/**
 * リクエストタイプ統計情報
 */
export interface RequestTypeStats {
  requestType: string;
  count: number;
}
