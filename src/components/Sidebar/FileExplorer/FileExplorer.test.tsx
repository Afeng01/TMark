import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileExplorer } from "./FileExplorer";
import type { FileNode } from "./types";

const tree: FileNode[] = [
  {
    id: "/workspace/folder",
    name: "folder",
    isFolder: true,
    children: [{ id: "/workspace/folder/a.md", name: "a", isFolder: false }],
  },
];

vi.mock("react-arborist", () => ({
  Tree: ({ data }: { data: FileNode[] }) => (
    <div role="tree">
      {data.map((node) => (
        <div key={node.id}>{node.name}</div>
      ))}
    </div>
  ),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("./useFileTree", () => ({
  useFileTree: vi.fn(() => ({ tree, isLoading: false, refresh: vi.fn() })),
}));

vi.mock("./useExplorerOperations", () => ({
  useExplorerOperations: () => ({
    createFile: vi.fn(),
    createFolder: vi.fn(),
    renameItem: vi.fn(),
    deleteItem: vi.fn(),
    moveItem: vi.fn(),
    openFile: vi.fn(),
    openWithDefaultApp: vi.fn(),
    duplicateFile: vi.fn(),
    copyPath: vi.fn(),
    revealInFinder: vi.fn(),
  }),
}));

vi.mock("./useFileExplorerOpenState", () => ({
  useFileExplorerOpenState: () => ({
    initialOpenState: {},
    handleToggle: vi.fn(),
    collapseAll: vi.fn(),
    expandAll: vi.fn(),
  }),
}));

vi.mock("./useObservedHeight", () => ({
  useObservedHeight: () => [vi.fn(), 200],
}));

vi.mock("@/stores/workspaceStore", () => ({
  useWorkspaceStore: (selector: (state: unknown) => unknown) =>
    selector({
      rootPath: "/workspace",
      isWorkspaceMode: true,
      config: { excludeFolders: [], showHiddenFiles: false, showAllFiles: false },
    }),
}));

vi.mock("@/contexts/WindowContext", () => ({
  useWindowLabel: () => "main",
}));

describe("FileExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collapses the whole workspace root without treating it as a folder toggle", () => {
    render(<FileExplorer currentFilePath={null} rootPathOverride="/workspace" compactLayout />);

    expect(screen.getByText("folder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse workspace/i }));

    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByText("workspace")).toBeInTheDocument();
  });
});
