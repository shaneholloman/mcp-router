/**
 * Settings management domain API
 */

import { AppSettings } from "@mcp_router/shared";

interface OverlayCountResult {
  success: boolean;
  count: number;
}

export interface SettingsAPI {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<boolean>;
  incrementOverlayCount(): Promise<OverlayCountResult>;
  submitFeedback(feedback: string): Promise<boolean>;
}
