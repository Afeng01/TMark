import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Tauri invoke before importing the store
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/utils/safeStorage", () => ({
  createSafeStorage: () => ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }),
}));

vi.mock("@/utils/debug", () => ({
  recentWarn: vi.fn(),
}));

vi.mock("@/utils/pathUtils", () => ({
  getFileName: (path: string) => path.split("/").pop() ?? path,
}));

import { sortRecentFilesFirstOpened, useRecentFilesStore } from "../recentFilesStore";

beforeEach(() => {
  useRecentFilesStore.setState({ files: [], maxFiles: 15 });
});

describe("recentFilesStore", () => {
  describe("sortRecentFilesFirstOpened", () => {
    it("migrates old MRU persisted entries to timestamp order", () => {
      expect(sortRecentFilesFirstOpened([
        { path: "/b.md", name: "b.md", timestamp: 2 },
        { path: "/a.md", name: "a.md", timestamp: 1 },
      ]).map((file) => file.path)).toEqual(["/a.md", "/b.md"]);
    });
  });

  describe("addFile", () => {
    it("adds a file in first-opened order", () => {
      useRecentFilesStore.getState().addFile("/path/to/file.md");
      const files = useRecentFilesStore.getState().files;
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("/path/to/file.md");
      expect(files[0].name).toBe("file.md");
      expect(files[0].timestamp).toBeGreaterThan(0);
    });

    it("keeps duplicate in its first-seen position", () => {
      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().addFile("/b.md");
      useRecentFilesStore.getState().addFile("/a.md");
      const files = useRecentFilesStore.getState().files;
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe("/a.md");
      expect(files[1].path).toBe("/b.md");
    });

    it("enforces maxFiles limit", () => {
      useRecentFilesStore.setState({ maxFiles: 3 });
      useRecentFilesStore.getState().addFile("/1.md");
      useRecentFilesStore.getState().addFile("/2.md");
      useRecentFilesStore.getState().addFile("/3.md");
      useRecentFilesStore.getState().addFile("/4.md");
      const files = useRecentFilesStore.getState().files;
      expect(files).toHaveLength(3);
      expect(files[2].path).toBe("/4.md");
      expect(files.find((f) => f.path === "/1.md")).toBeUndefined();
    });

    it("defaults to keeping 15 recent files", () => {
      expect(useRecentFilesStore.getState().maxFiles).toBe(15);
    });

    it("handles empty path gracefully", () => {
      useRecentFilesStore.getState().addFile("");
      expect(useRecentFilesStore.getState().files).toHaveLength(1);
    });
  });

  describe("removeFile", () => {
    it("removes a file by path", () => {
      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().addFile("/b.md");
      useRecentFilesStore.getState().removeFile("/a.md");
      const files = useRecentFilesStore.getState().files;
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("/b.md");
    });

    it("is a no-op for non-existent path", () => {
      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().removeFile("/nonexistent.md");
      expect(useRecentFilesStore.getState().files).toHaveLength(1);
    });
  });

  describe("updateFilePath", () => {
    it("updates a recent file path in place without changing first-opened order", () => {
      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().addFile("/b.md");

      useRecentFilesStore.getState().updateFilePath("/a.md", "/renamed.md");

      const files = useRecentFilesStore.getState().files;
      expect(files.map((file) => file.path)).toEqual(["/renamed.md", "/b.md"]);
      expect(files[0].name).toBe("renamed.md");
    });
  });

  describe("clearAll", () => {
    it("removes all files", () => {
      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().addFile("/b.md");
      useRecentFilesStore.getState().clearAll();
      expect(useRecentFilesStore.getState().files).toHaveLength(0);
    });

    it("is safe on empty list", () => {
      useRecentFilesStore.getState().clearAll();
      expect(useRecentFilesStore.getState().files).toHaveLength(0);
    });
  });

  describe("syncToNativeMenu", () => {
    it("calls invoke with current files list", async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().addFile("/b.md");

      (invoke as ReturnType<typeof vi.fn>).mockClear();
      useRecentFilesStore.getState().syncToNativeMenu();

      // syncToNativeMenu calls updateNativeMenu which calls invoke
      expect(invoke).toHaveBeenCalledWith(
        "update_recent_files",
        expect.objectContaining({ files: ["/a.md", "/b.md"] })
      );
    });

    it("handles empty file list", async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      (invoke as ReturnType<typeof vi.fn>).mockClear();
      useRecentFilesStore.getState().syncToNativeMenu();

      expect(invoke).toHaveBeenCalledWith(
        "update_recent_files",
        expect.objectContaining({ files: [] })
      );
    });
  });

  describe("addFile calls native functions", () => {
    it("calls invoke for native menu update and dock registration", async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      (invoke as ReturnType<typeof vi.fn>).mockClear();
      useRecentFilesStore.getState().addFile("/new-file.md");

      expect(invoke).toHaveBeenCalledWith(
        "update_recent_files",
        expect.objectContaining({ files: ["/new-file.md"] })
      );
      expect(invoke).toHaveBeenCalledWith(
        "register_dock_recent",
        expect.objectContaining({ path: "/new-file.md" })
      );
    });
  });

  describe("updateNativeMenu error handling", () => {
    it("handles invoke rejection gracefully", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { recentWarn } = await import("@/utils/debug");

      vi.mocked(invoke).mockRejectedValueOnce(new Error("native error"));
      useRecentFilesStore.getState().addFile("/fail.md");

      // Wait for the async updateNativeMenu to settle
      await vi.waitFor(() => {
        expect(recentWarn).toHaveBeenCalledWith(
          "Failed to update recent files native menu:",
          expect.any(Error)
        );
      });
    });
  });

  describe("removeFile calls native menu update", () => {
    it("syncs native menu after removal", async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      useRecentFilesStore.getState().addFile("/a.md");
      useRecentFilesStore.getState().addFile("/b.md");

      (invoke as ReturnType<typeof vi.fn>).mockClear();
      useRecentFilesStore.getState().removeFile("/a.md");

      expect(invoke).toHaveBeenCalledWith(
        "update_recent_files",
        expect.objectContaining({ files: ["/b.md"] })
      );
    });
  });
});
