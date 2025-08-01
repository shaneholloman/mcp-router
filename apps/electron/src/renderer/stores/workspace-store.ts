import { create } from "zustand";
import { Workspace } from "@/main/infrastructure/platform-api";
import { electronPlatformAPI } from "../lib/electron-platform-api";
import { RemotePlatformAPI } from "../lib/remote-platform-api";
import type { PlatformAPI } from "@/main/infrastructure/platform-api/types/platform-api";
import { useAuthStore } from "@/renderer/stores";

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;

  // Platform API cache
  remotePlatformAPICache: Map<string, PlatformAPI>;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadCurrentWorkspace: () => Promise<void>;
  createWorkspace: (config: any) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: any) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setError: (error: string | null) => void;

  // Platform API related
  getPlatformAPI: () => PlatformAPI;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  isLoading: false,
  error: null,
  remotePlatformAPICache: new Map(),

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await electronPlatformAPI.workspaces.list();
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの読み込みに失敗しました",
        isLoading: false,
      });
    }
  },

  loadCurrentWorkspace: async () => {
    try {
      const workspace = await electronPlatformAPI.workspaces.getActive();
      set({ currentWorkspace: workspace });
    } catch (error) {
      console.error("Failed to load current workspace:", error);
    }
  },

  createWorkspace: async (config) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkspace = await electronPlatformAPI.workspaces.create(config);
      const workspaces = [...get().workspaces, newWorkspace];
      set({ workspaces, isLoading: false });
      return newWorkspace;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの作成に失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  updateWorkspace: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updatedWorkspace = await electronPlatformAPI.workspaces.update(
        id,
        updates,
      );
      const workspaces = get().workspaces.map((w) =>
        w.id === id ? updatedWorkspace : w,
      );
      set({ workspaces, isLoading: false });

      // 現在のワークスペースが更新された場合
      if (get().currentWorkspace?.id === id) {
        set({ currentWorkspace: updatedWorkspace });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの更新に失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await electronPlatformAPI.workspaces.delete(id);
      const workspaces = get().workspaces.filter((w) => w.id !== id);
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの削除に失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  switchWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await electronPlatformAPI.workspaces.switch(id);
      const workspace = get().workspaces.find((w) => w.id === id);
      if (workspace) {
        set({ currentWorkspace: workspace, isLoading: false });

        // ストアの再作成をトリガー（新しいPlatform APIを使用）
        const { useServerStore, useAgentStore, useAuthStore } = await import(
          "../stores"
        );

        // Clear all stores before switching
        useServerStore.getState().clearStore();
        useAgentStore.getState().clearStore();
        useAuthStore.getState().clearStore();

        // 1. First, refresh auth store to ensure authentication is ready
        try {
          // Always use electron API to get settings (doesn't require auth)
          const settings = await electronPlatformAPI.settings.get();
          await useAuthStore.getState().initializeFromSettings(settings);

          // For remote workspaces, check auth status
          if (workspace.type === "remote") {
            await useAuthStore.getState().checkAuthStatus();

            // Verify authentication for remote workspaces
            const authState = useAuthStore.getState();
            if (!authState.isAuthenticated || !authState.authToken) {
              console.log("Remote workspace requires authentication");
              // Don't refresh data if not authenticated
              return;
            }
          }
        } catch (error) {
          console.error("Failed to refresh auth store:", error);
          // For remote workspaces, auth failure means we can't proceed
          if (workspace.type === "remote") {
            return;
          }
        }

        // 2. Now refresh servers and agents (auth is ready)
        try {
          await useServerStore.getState().refreshServers();
        } catch (error) {
          console.error("Failed to refresh servers:", error);
        }

        try {
          await useAgentStore.getState().refreshAgents();
        } catch (error) {
          console.error("Failed to refresh agents:", error);
        }
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの切り替えに失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  setError: (error) => {
    set({ error });
  },

  getPlatformAPI: () => {
    const currentWorkspace = get().currentWorkspace;
    const cache = get().remotePlatformAPICache;

    // If no workspace or local workspace, use electron API
    if (!currentWorkspace || currentWorkspace.type === "local") {
      return electronPlatformAPI;
    }

    // For remote workspaces, use cached instance or create new one
    if (currentWorkspace.type === "remote" && currentWorkspace.remoteConfig) {
      // Get the user token from auth store
      const authToken = useAuthStore.getState().authToken;

      if (!authToken) {
        console.error(
          "No user authentication token available for remote workspace",
        );
        return electronPlatformAPI; // Fallback to electron API
      }

      const cacheKey = `${currentWorkspace.id}-${currentWorkspace.remoteConfig.apiUrl}-${authToken}`;

      if (!cache.has(cacheKey)) {
        const remoteAPI = new RemotePlatformAPI({
          apiUrl: currentWorkspace.remoteConfig.apiUrl,
          userToken: authToken,
        });
        cache.set(cacheKey, remoteAPI);

        // Clear old cache entries for this workspace
        for (const [key] of cache) {
          if (key.startsWith(`${currentWorkspace.id}-`) && key !== cacheKey) {
            cache.delete(key);
          }
        }
      }

      return cache.get(cacheKey)!;
    }

    // Fallback to electron API if remote config is missing
    return electronPlatformAPI;
  },
}));

// ワークスペース切り替えイベントのリスナー設定
if (typeof window !== "undefined" && window.electronAPI) {
  window.electronAPI.onWorkspaceSwitched((workspace: Workspace) => {
    useWorkspaceStore.getState().setCurrentWorkspace(workspace);
  });
}
