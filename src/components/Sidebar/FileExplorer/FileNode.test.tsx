import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileNode } from "./FileNode";
import type { FileNode as FileNodeType } from "./types";
import type { NodeRendererProps } from "react-arborist";

function makeProps(overrides: Partial<NodeRendererProps<FileNodeType>> = {}) {
  const edit = vi.fn();
  const node = {
    data: {
      id: "/workspace/note.md",
      name: "note.md",
      isFolder: false,
    },
    isEditing: false,
    isSelected: false,
    isOpen: false,
    edit,
    reset: vi.fn(),
    submit: vi.fn(),
    toggle: vi.fn(),
  };

  return {
    node,
    style: {},
    dragHandle: vi.fn(),
    tree: {},
    preview: null,
    ...overrides,
  } as unknown as NodeRendererProps<FileNodeType> & { node: typeof node };
}

const labels = {
  rename: "Rename",
  delete: "Delete",
  pin: "Pin",
  unpin: "Unpin",
};

describe("FileNode", () => {
  it("starts inline rename when the file name is double-clicked", () => {
    const props = makeProps();

    render(<FileNode {...props} currentFilePath={null} labels={labels} />);

    fireEvent.doubleClick(screen.getByText("note.md"));

    expect(props.node.edit).toHaveBeenCalled();
  });

  it("shows quick actions for files and routes rename, pin, and delete", () => {
    const props = makeProps();
    const onTogglePin = vi.fn();
    const onDelete = vi.fn();

    render(
      <FileNode
        {...props}
        currentFilePath={null}
        labels={labels}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(props.node.edit).toHaveBeenCalled();
    expect(onTogglePin).toHaveBeenCalledWith("/workspace/note.md");
    expect(onDelete).toHaveBeenCalledWith("/workspace/note.md", false);
  });
});
