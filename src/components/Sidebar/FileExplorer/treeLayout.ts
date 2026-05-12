import type { FileNode } from "./types";

export const FILE_TREE_ROW_HEIGHT = 26;
export const FILE_TREE_MAX_COMPACT_ROWS = 8;

export function countVisibleTreeRows(
  nodes: FileNode[],
  openState: Record<string, boolean>,
): number {
  let count = 0;

  const visit = (items: FileNode[]) => {
    for (const item of items) {
      count += 1;
      if (item.isFolder && openState[item.id] && item.children) {
        visit(item.children);
      }
    }
  };

  visit(nodes);
  return count;
}

export function getCompactTreeHeight(
  nodes: FileNode[],
  openState: Record<string, boolean>,
): number {
  const visibleRows = countVisibleTreeRows(nodes, openState);
  const rows = Math.max(1, Math.min(FILE_TREE_MAX_COMPACT_ROWS, visibleRows));
  return rows * FILE_TREE_ROW_HEIGHT;
}

export function getExpandedFolderState(nodes: FileNode[]): Record<string, boolean> {
  const state: Record<string, boolean> = {};

  const visit = (items: FileNode[]) => {
    for (const item of items) {
      if (!item.isFolder) continue;
      state[item.id] = true;
      if (item.children) visit(item.children);
    }
  };

  visit(nodes);
  return state;
}
