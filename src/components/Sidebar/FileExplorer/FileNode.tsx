/**
 * FileNode
 *
 * Purpose: Renders a single node (file or folder) in the file explorer tree.
 * Handles expand/collapse, active file highlighting, and inline rename editing.
 *
 * Key decisions:
 *   - Inline rename auto-selects the filename without extension on focus,
 *     so users can type a new name without manually deselecting ".md".
 *   - IME guard prevents Escape/Enter during CJK composition from
 *     triggering rename actions.
 *
 * @coordinates-with FileExplorer.tsx — used as the react-arborist node renderer
 * @module components/Sidebar/FileExplorer/FileNode
 */
import { ChevronRight, ChevronDown, Folder, FileText, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { isImeKeyEvent } from "@/utils/imeGuard";
import type { NodeRendererProps } from "react-arborist";
import type { FileNode as FileNodeType } from "./types";

interface FileNodeProps extends NodeRendererProps<FileNodeType> {
  currentFilePath: string | null;
  isPinned?: boolean;
  onTogglePin?: (path: string) => void;
  onDelete?: (path: string, isFolder: boolean) => void;
  labels?: {
    rename: string;
    delete: string;
    pin: string;
    unpin: string;
  };
}

/** Renders a single file or folder node in the explorer tree with inline rename support. */
export function FileNode({
  node,
  style,
  dragHandle,
  currentFilePath,
  isPinned = false,
  onTogglePin,
  onDelete,
  labels,
}: FileNodeProps) {
  const data = node.data;
  const isActive = data.id === currentFilePath;
  const isEditing = node.isEditing;
  const canShowQuickActions = !data.isFolder && !isEditing;

  return (
    <div
      ref={dragHandle}
      style={style}
      data-node-id={data.id}
      className={`file-node ${isActive ? "active" : ""} ${node.isSelected ? "selected" : ""}`}
      onDoubleClick={(event) => {
        if (data.isFolder) return;
        event.stopPropagation();
        node.edit();
      }}
    >
      <span className="file-node-indent" />

      {data.isFolder ? (
        <span
          className="file-node-arrow"
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
        >
          {node.isOpen ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>
      ) : (
        <span className="file-node-arrow" />
      )}

      <span className="file-node-icon">
        {data.isFolder ? (
          <Folder size={14} />
        ) : (
          <FileText size={14} />
        )}
      </span>

      {isEditing ? (
        <input
          type="text"
          className="file-node-input"
          defaultValue={data.name}
          autoFocus
          onFocus={(e) => {
            // Select filename without extension
            const input = e.target;
            const dotIndex = input.value.lastIndexOf(".");
            if (dotIndex > 0) {
              input.setSelectionRange(0, dotIndex);
            } else {
              input.select();
            }
          }}
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (isImeKeyEvent(e)) return;
            if (e.key === "Escape") {
              node.reset();
            } else if (e.key === "Enter") {
              node.submit(e.currentTarget.value);
            }
          }}
        />
      ) : (
        <>
          <span className="file-node-name">{data.name}</span>
          {canShowQuickActions && (
            <span className="file-node-actions" aria-label={labels?.rename ?? "File actions"}>
              <button
                type="button"
                className="file-node-action"
                title={labels?.rename}
                aria-label={labels?.rename}
                onClick={(event) => {
                  event.stopPropagation();
                  node.edit();
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="file-node-action"
                title={isPinned ? labels?.unpin : labels?.pin}
                aria-label={isPinned ? labels?.unpin : labels?.pin}
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin?.(data.id);
                }}
              >
                {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              </button>
              <button
                type="button"
                className="file-node-action file-node-action-danger"
                title={labels?.delete}
                aria-label={labels?.delete}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(data.id, data.isFolder);
                }}
              >
                <Trash2 size={13} />
              </button>
            </span>
          )}
        </>
      )}
    </div>
  );
}
