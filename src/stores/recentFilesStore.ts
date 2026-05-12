/**
 * Recent Files Store
 *
 * Purpose: Tracks recently opened files (max 15) with persistence via
 *   zustand/persist. Syncs the list to the native File > Recent menu
 *   and macOS Dock recent documents.
 *
 * Pipeline: File opened → addFile(path) → first-seen list updated → Rust
 *   update_recent_files rebuilds native menu → register_dock_recent
 *   adds to macOS Dock (silently ignored on other platforms).
 *
 * @coordinates-with recentWorkspacesStore.ts — same pattern for workspace folders
 * @coordinates-with menu.rs — native Recent Files submenu
 * @module stores/recentFilesStore
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/utils/safeStorage";
import { invoke } from "@tauri-apps/api/core";
import { getFileName } from "@/utils/pathUtils";
import { recentWarn } from "@/utils/debug";

/** A recently opened file entry with path, display name, and timestamp. */
export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
}

interface RecentFilesState {
  files: RecentFile[];
  maxFiles: number;
  addFile: (path: string) => void;
  removeFile: (path: string) => void;
  updateFilePath: (oldPath: string, newPath: string) => void;
  clearAll: () => void;
  syncToNativeMenu: () => void;
}

// Helper to sync files to native menu
async function updateNativeMenu(files: RecentFile[]) {
  try {
    await invoke("update_recent_files", { files: files.map((f) => f.path) });
  } catch (error) {
    recentWarn("Failed to update recent files native menu:", error);
  }
}

/** Register file with macOS Dock recent documents (silently ignored on other platforms) */
async function registerDockRecent(path: string) {
  try {
    await invoke("register_dock_recent", { path });
  } catch {
    // Silently ignore — command only exists on macOS
  }
}

export function sortRecentFilesFirstOpened(files: RecentFile[]): RecentFile[] {
  return [...files].sort((a, b) => a.timestamp - b.timestamp);
}

/** Manages recently opened files (max 15) with persistence and native menu sync. Use selectors, not destructuring. */
export const useRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set, get) => ({
      files: [],
      maxFiles: 15,

      addFile: (path: string) => {
        const { files, maxFiles } = get();
        const name = getFileName(path) || path;

        const existing = files.find((f) => f.path === path);
        if (existing) {
          updateNativeMenu(files);
          registerDockRecent(path);
          return;
        }

        // Keep entries in first-opened order. Reopening an existing file does
        // not reshuffle the list; adding beyond the cap drops the oldest entry.
        const newFiles = [
          ...files,
          { path, name, timestamp: Date.now() },
        ].slice(-maxFiles);

        set({ files: newFiles });
        updateNativeMenu(newFiles);
        registerDockRecent(path);
      },

      removeFile: (path: string) => {
        const newFiles = get().files.filter((f) => f.path !== path);
        set({ files: newFiles });
        updateNativeMenu(newFiles);
      },

      updateFilePath: (oldPath: string, newPath: string) => {
        const { files } = get();
        const existing = files.find((f) => f.path === oldPath);
        if (!existing) return;

        const name = getFileName(newPath) || newPath;
        const newFiles = files.map((file) =>
          file.path === oldPath
            ? { ...file, path: newPath, name }
            : file
        );
        set({ files: newFiles });
        updateNativeMenu(newFiles);
        registerDockRecent(newPath);
      },

      clearAll: () => {
        set({ files: [] });
        updateNativeMenu([]);
      },

      syncToNativeMenu: () => {
        updateNativeMenu(get().files);
      },
    }),
    {
      name: "vmark-recent-files",
      storage: createJSONStorage(() => createSafeStorage()),
      version: 2,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        const state = persistedState as Partial<RecentFilesState>;
        if (!Array.isArray(state.files)) return persistedState;
        return {
          ...state,
          files: sortRecentFilesFirstOpened(state.files),
        };
      },
    }
  )
);
