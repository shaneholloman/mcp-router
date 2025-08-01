/**
 * Server management domain API
 */

import { MCPServerConfig, MCPServer } from "@mcp_router/shared";

export interface ServerStatus {
  type: "stopped" | "starting" | "running" | "stopping" | "error";
  error?: string;
  connectedAt?: Date;
  stats?: ServerStats;
}

interface ServerStats {
  requests: number;
  errors: number;
  uptime: number;
}

export interface CreateServerInput {
  config: MCPServerConfig;
}

export interface ServerAPI {
  list(): Promise<MCPServer[]>;
  get(id: string): Promise<MCPServer | null>;
  create(input: CreateServerInput): Promise<MCPServer>;
  update(id: string, updates: Partial<MCPServerConfig>): Promise<MCPServer>;
  delete(id: string): Promise<void>;
  start(id: string): Promise<boolean>;
  stop(id: string): Promise<boolean>;
  getStatus(id: string): Promise<ServerStatus>;
  fetchFromIndex(
    page?: number,
    limit?: number,
    search?: string,
    isVerified?: boolean,
  ): Promise<any>;
  fetchVersionDetails(displayId: string, version: string): Promise<any>;
}
