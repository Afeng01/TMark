import { describe, expect, it } from "vitest";
import { FILE_TREE_ROW_HEIGHT, getCompactTreeHeight, getExpandedFolderState } from "./treeLayout";
import type { FileNode } from "./types";

const tree: FileNode[] = [
  {
    id: "/root/a",
    name: "a",
    isFolder: true,
    children: [
      { id: "/root/a/one.md", name: "one", isFolder: false },
      { id: "/root/a/two.md", name: "two", isFolder: false },
    ],
  },
  { id: "/root/b.md", name: "b", isFolder: false },
];

describe("treeLayout", () => {
  it("shrinks compact tree height when folders are collapsed", () => {
    expect(getCompactTreeHeight(tree, {})).toBe(2 * FILE_TREE_ROW_HEIGHT);
    expect(getCompactTreeHeight(tree, { "/root/a": true })).toBe(4 * FILE_TREE_ROW_HEIGHT);
  });

  it("builds open state for every folder when expanding all", () => {
    expect(getExpandedFolderState(tree)).toEqual({ "/root/a": true });
  });
});
