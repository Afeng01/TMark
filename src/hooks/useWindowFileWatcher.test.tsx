import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useWindowFileWatcher } from "./useWindowFileWatcher";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@/utils/workspaceStorage", () => ({
  windowScopedStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/contexts/WindowContext", () => ({
  useWindowLabel: () => "main",
}));

function resetStores() {
  useWorkspaceStore.setState({
    rootPath: null,
    workspaceRoots: [],
    config: null,
    isWorkspaceMode: false,
  });
  useTabStore.setState({
    tabs: {},
    activeTabId: {},
    untitledCounter: 0,
    closedTabs: {},
  });
  useDocumentStore.setState({ documents: {} });
}

describe("useWindowFileWatcher", () => {
  beforeEach(() => {
    resetStores();
    mocks.invoke.mockClear();
  });

  it("starts one watcher per workspace root", async () => {
    useWorkspaceStore.setState({
      rootPath: "/workspace",
      workspaceRoots: ["/workspace", "/archive/notes"],
      config: null,
      isWorkspaceMode: true,
    });

    renderHook(() => useWindowFileWatcher());

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("start_watching", {
        watchId: "main",
        path: "/workspace",
      });
      expect(mocks.invoke).toHaveBeenCalledWith("start_watching", {
        watchId: "main:workspace-root:/archive/notes",
        path: "/archive/notes",
      });
    });
  });
});
