import { forwardRef, useImperativeHandle } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { clampWorkspaceHeight } from "./workspaceSizing";

const openFileMock = vi.fn();
const renameItemMock = vi.fn();
const deleteItemMock = vi.fn();
const explorerProps: Array<{ rootPathOverride?: string; compactLayout?: boolean }> = [];
const { createUntitledTabMock, setActiveTabMock, togglePinMock, toggleSidebarMock } = vi.hoisted(() => ({
  createUntitledTabMock: vi.fn(),
  setActiveTabMock: vi.fn(),
  togglePinMock: vi.fn(),
  toggleSidebarMock: vi.fn(),
}));
let mockWorkspaceRoots: unknown = ["/workspace", "/archive/notes"];

vi.mock("@/hooks/useDocumentState", () => ({
  useDocumentFilePath: () => "/workspace/notes/current.md",
  useDocumentIsDirty: () => true,
}));

vi.mock("@/stores/recentFilesStore", () => ({
  useRecentFilesStore: (selector: (state: unknown) => unknown) =>
    selector({
      files: [
        { path: "/workspace/notes/current.md", name: "current.md", timestamp: 3 },
        { path: "/workspace/notes/brief.md", name: "brief.md", timestamp: 2 },
      ],
      removeFile: vi.fn(),
      updateFilePath: vi.fn(),
    }),
}));

vi.mock("@/stores/uiStore", () => {
  const state = {
    sidebarViewMode: "files",
    toggleSidebar: toggleSidebarMock,
    setSidebarViewMode: vi.fn(),
  };
  const useUIStore = (selector: (value: typeof state) => unknown) => selector(state);
  useUIStore.getState = () => state;
  return { useUIStore };
});

vi.mock("@/stores/workspaceStore", () => {
  const state = {
    rootPath: "/workspace",
    addWorkspaceRoot: vi.fn(),
  };
  const useWorkspaceStore = (selector: (value: typeof state & { workspaceRoots: unknown }) => unknown) =>
    selector({ ...state, workspaceRoots: mockWorkspaceRoots });
  useWorkspaceStore.getState = () => state;
  return { useWorkspaceStore };
});

vi.mock("@/contexts/WindowContext", () => ({
  useWindowLabel: () => "main",
}));

vi.mock("@/utils/newFile", () => ({
  createUntitledTab: createUntitledTabMock,
}));

vi.mock("@/stores/tabStore", () => {
  const tabs = [
    { id: "tab-pinned", title: "Pinned Note", filePath: "/workspace/pinned.md", isPinned: true, formatId: "markdown" },
    { id: "tab-other", title: "Other", filePath: "/workspace/other.md", isPinned: false, formatId: "markdown" },
  ];
  const state = {
    tabs: { main: tabs },
    getTabsByWindow: () => tabs,
    setActiveTab: setActiveTabMock,
    togglePin: togglePinMock,
    findTabByPath: vi.fn(() => null),
  };
  const useTabStore = (selector: (value: typeof state) => unknown) => {
    const first = selector(state);
    const second = selector(state);
    if (!Object.is(first, second)) {
      throw new Error("unstable useTabStore selector result");
    }
    return first;
  };
  useTabStore.getState = () => state;
  return { useTabStore };
});

vi.mock("./FileExplorer", () => ({
  FileExplorer: forwardRef((props: { rootPathOverride?: string; compactLayout?: boolean }, ref) => {
    explorerProps.push(props);
    useImperativeHandle(ref, () => ({
      createNewFile: vi.fn(),
      createNewFolder: vi.fn(),
      collapseAll: vi.fn(),
      expandAll: vi.fn(),
    }));
    return <div data-testid="file-explorer">Workspace tree {props.rootPathOverride}</div>;
  }),
}));

vi.mock("./FileExplorer/useExplorerOperations", () => ({
  useExplorerOperations: () => ({
    openFile: openFileMock,
    renameItem: renameItemMock,
    deleteItem: deleteItemMock,
  }),
}));

vi.mock("./OutlineView", () => ({
  OutlineView: () => <div data-testid="outline-view">Outline</div>,
}));

vi.mock("./HistoryView", () => ({
  HistoryView: () => <div data-testid="history-view">History</div>,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    mockWorkspaceRoots = ["/workspace", "/archive/notes"];
    explorerProps.length = 0;
    createUntitledTabMock.mockClear();
    setActiveTabMock.mockClear();
    togglePinMock.mockClear();
    toggleSidebarMock.mockClear();
    openFileMock.mockClear();
    renameItemMock.mockClear();
    deleteItemMock.mockClear();
  });

  it("renders current, drafts/recent tabs, and workspace sections", () => {
    const { container } = render(<Sidebar />);

    expect(screen.getByRole("heading", { name: "Pinned" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Drafts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText("current.md")).toBeInTheDocument();
    expect(screen.queryByText("brief.md")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("file-explorer")).toHaveLength(2);
    expect(container.querySelector(".sidebar-footer")).toContainElement(
      screen.getByRole("button", { name: /close sidebar/i })
    );
  });

  it("switches between drafts and recent without moving current outline controls", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("tab", { name: "Recent" }));

    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show.*outline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show.*history/i })).toBeInTheDocument();
  });

  it("creates an untitled draft from the draft/recent action", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: /new draft/i }));

    expect(createUntitledTabMock).toHaveBeenCalledWith("main");
  });

  it("keeps multiple workspace roots as separate visible explorers", () => {
    const { container } = render(<Sidebar />);

    expect(explorerProps.map((props) => props.rootPathOverride)).toEqual([
      "/workspace",
      "/archive/notes",
    ]);
    expect(explorerProps.every((props) => props.compactLayout)).toBe(true);
    expect(container.querySelectorAll(".sidebar-workspace-root")).toHaveLength(2);
    expect(container.querySelector(".sidebar-workspace-body")).toHaveClass("has-multiple-roots");
  });

  it("falls back to rootPath when persisted workspaceRoots is malformed", () => {
    mockWorkspaceRoots = "/not-an-array";

    render(<Sidebar />);

    expect(explorerProps.map((props) => props.rootPathOverride)).toEqual(["/workspace"]);
  });

  it("activates pinned tabs from the pinned section", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: /open pinned tab pinned note/i }));

    expect(setActiveTabMock).toHaveBeenCalledWith("main", "tab-pinned");
  });

  it("can unpin and collapse pinned documents from the pinned section", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: /unpin pinned note/i }));

    expect(togglePinMock).toHaveBeenCalledWith("main", "tab-pinned");

    fireEvent.click(screen.getByRole("button", { name: /collapse pinned/i }));

    expect(screen.queryByRole("button", { name: /open pinned tab pinned note/i })).not.toBeInTheDocument();
  });

  it("shows rename, pin, and delete actions for recent files", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("tab", { name: "Recent" }));

    expect(screen.getByRole("button", { name: /rename brief.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pin brief.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete brief.md/i })).toBeInTheDocument();
  });

  it("clamps workspace height to a viewport-aware threshold", () => {
    expect(clampWorkspaceHeight(999, 720)).toBeLessThanOrEqual(420);
    expect(clampWorkspaceHeight(20, 720)).toBe(160);
  });
});
