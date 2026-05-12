/**
 * Sidebar Component
 *
 * Navigation sidebar using a fixed 1.x-style workbench layout.
 */

import { useRef, useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Pencil,
  FilePlus,
  FileText,
  FolderPlus,
  FolderOpen,
  History,
  PanelLeftClose,
  Pin,
  PinOff,
  Plus,
  TableOfContents,
  Trash2,
} from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { deleteDocumentHistory } from "@/hooks/useHistoryRecovery";
import { emitHistoryCleared } from "@/utils/historyTypes";
import { useUIStore, type SidebarViewMode } from "@/stores/uiStore";
import { useDocumentFilePath, useDocumentIsDirty } from "@/hooks/useDocumentState";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { useTabStore, type Tab } from "@/stores/tabStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useWindowLabel } from "@/contexts/WindowContext";
import { createUntitledTab } from "@/utils/newFile";
import { isWithinRoot } from "@/utils/paths";
import { handleOpenFile } from "@/hooks/useFileOpen";
import { FileExplorer, type FileExplorerHandle } from "./FileExplorer";
import { useExplorerOperations } from "./FileExplorer/useExplorerOperations";
import { OutlineView } from "./OutlineView";
import { HistoryView } from "./HistoryView";
import { clampWorkspaceHeight, readWorkspaceHeight, writeWorkspaceHeight } from "./workspaceSizing";
import "./Sidebar.css";

// Constants
const TRAFFIC_LIGHTS_SPACER_PX = 28;
const MAX_RECENT_ITEMS = 15;
const WORKSPACE_HEIGHT_KEY = "tmark.sidebar.workspaceHeight";
const EMPTY_TABS: Tab[] = [];

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || filePath;
}

function normalizeWorkspaceRoots(workspaceRoots: unknown, rootPath: string | null): string[] {
  if (!Array.isArray(workspaceRoots)) {
    return rootPath ? [rootPath] : [];
  }
  return workspaceRoots.filter((root): root is string => typeof root === "string" && root.length > 0);
}

/** Navigation sidebar with fixed Current, Drafts, Recent, and Workspace sections. */
export function Sidebar() {
  const { t } = useTranslation("sidebar");
  const windowLabel = useWindowLabel();
  const viewMode = useUIStore((state) => state.sidebarViewMode);
  const filePath = useDocumentFilePath();
  const isDirty = useDocumentIsDirty();
  const recentFiles = useRecentFilesStore((state) => state.files);
  const removeRecentFile = useRecentFilesStore((state) => state.removeFile);
  const updateRecentFilePath = useRecentFilesStore((state) => state.updateFilePath);
  const tabsForWindow = useTabStore((state) => state.tabs[windowLabel] ?? EMPTY_TABS);
  const pinnedTabs = useMemo(
    () => tabsForWindow.filter((tab) => tab.isPinned),
    [tabsForWindow]
  );
  const workspaceRootPath = useWorkspaceStore((state) => state.rootPath);
  const storedWorkspaceRoots = useWorkspaceStore((state) => state.workspaceRoots);
  const workspaceRoots = useMemo(
    () => normalizeWorkspaceRoots(storedWorkspaceRoots, workspaceRootPath),
    [storedWorkspaceRoots, workspaceRootPath]
  );
  const { openFile, renameItem, deleteItem } = useExplorerOperations();
  const fileExplorerRefs = useRef<Record<string, FileExplorerHandle | null>>({});
  const isClearingRef = useRef(false);
  const [fileListMode, setFileListMode] = useState<"drafts" | "recent">("drafts");
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [workspaceHeight, setWorkspaceHeight] = useState(() => readWorkspaceHeight(WORKSPACE_HEIGHT_KEY));
  const currentTitle = filePath ? fileNameFromPath(filePath) : t("currentFileFallback");
  const visibleRecentFiles = recentFiles
    .filter((file) => file.path !== filePath)
    .slice(0, MAX_RECENT_ITEMS);

  const handleClearDocumentHistory = useCallback(async () => {
    if (!filePath || isClearingRef.current) return;
    isClearingRef.current = true;
    try {
      const confirmed = await ask(
        t("clearHistoryMessage"),
        { title: t("clearDocumentHistory"), kind: "warning" }
      );
      if (confirmed) {
        await deleteDocumentHistory(filePath);
        emitHistoryCleared();
      }
    } finally {
      isClearingRef.current = false;
    }
  }, [filePath, t]);

  const handleToggleCurrentPanel = (mode: Extract<SidebarViewMode, "outline" | "history">) => {
    const { sidebarViewMode, setSidebarViewMode } = useUIStore.getState();
    setSidebarViewMode(sidebarViewMode === mode ? "files" : mode);
  };

  const getActionRoot = useCallback(() => {
    if (filePath) {
      const matchingRoot = workspaceRoots.find((root) => isWithinRoot(root, filePath));
      if (matchingRoot) return matchingRoot;
    }
    return workspaceRootPath ?? workspaceRoots[0] ?? null;
  }, [filePath, workspaceRootPath, workspaceRoots]);

  const getActionExplorer = useCallback(() => {
    const root = getActionRoot();
    return root ? fileExplorerRefs.current[root] : null;
  }, [getActionRoot]);

  const handleAddWorkspaceRoot = useCallback(async () => {
    const selected = await invoke<string | null>("open_folder_dialog");
    if (selected) {
      useWorkspaceStore.getState().addWorkspaceRoot(selected);
    }
  }, []);

  const handleCreateDraft = useCallback(() => {
    createUntitledTab(windowLabel);
  }, [windowLabel]);

  const handleActivatePinnedTab = useCallback((tabId: string) => {
    useTabStore.getState().setActiveTab(windowLabel, tabId);
  }, [windowLabel]);

  const handleUnpinTab = useCallback((tabId: string) => {
    useTabStore.getState().togglePin(windowLabel, tabId);
  }, [windowLabel]);

  const handlePinFilePath = useCallback(async (path: string) => {
    let tab = useTabStore.getState().findTabByPath(windowLabel, path);
    if (!tab) {
      await handleOpenFile(windowLabel, path);
      tab = useTabStore.getState().findTabByPath(windowLabel, path);
    }
    if (tab) useTabStore.getState().togglePin(windowLabel, tab.id);
  }, [windowLabel]);

  const handleRenameRecentFile = useCallback(async (path: string, name: string) => {
    const nextName = window.prompt(t("renameRecentFilePrompt", { name }), name.replace(/\.md$/i, ""));
    const trimmedName = nextName?.trim();
    if (!trimmedName) return;
    const newPath = await renameItem(path, trimmedName);
    if (newPath) updateRecentFilePath(path, newPath);
  }, [renameItem, t, updateRecentFilePath]);

  const handleDeleteRecentFile = useCallback(async (path: string) => {
    const deleted = await deleteItem(path, false);
    if (deleted) {
      removeRecentFile(path);
    }
  }, [deleteItem, removeRecentFile]);

  const handleWorkspaceResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = workspaceHeight;

    const handleMove = (moveEvent: MouseEvent) => {
      const nextHeight = clampWorkspaceHeight(startHeight - (moveEvent.clientY - startY));
      setWorkspaceHeight(nextHeight);
      writeWorkspaceHeight(WORKSPACE_HEIGHT_KEY, nextHeight);
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [workspaceHeight]);

  return (
    <div className="sidebar" style={{ width: "100%", height: "100%" }}>
      {/* Spacer for traffic lights area */}
      <div style={{ height: TRAFFIC_LIGHTS_SPACER_PX, flexShrink: 0, padding: 0, margin: 0 }} />
      <div className="sidebar-header">
        <BookOpenText size={16} className="sidebar-header-icon" aria-hidden="true" />
        <span className="sidebar-title">{t("workbenchTitle")}</span>
      </div>

      <div className="sidebar-content sidebar-workbench">
        <div className="sidebar-main-sections">
          <section className="sidebar-section" aria-labelledby="sidebar-pinned-heading">
            <div className="sidebar-section-header">
              <h2 id="sidebar-pinned-heading" className="sidebar-section-title">
                {t("sections.pinned")}
              </h2>
              <div className="sidebar-header-actions">
                <button
                  type="button"
                  className="sidebar-btn"
                  onClick={() => setPinnedCollapsed((collapsed) => !collapsed)}
                  title={pinnedCollapsed ? t("expandPinned") : t("collapsePinned")}
                  aria-label={pinnedCollapsed ? t("expandPinned") : t("collapsePinned")}
                  aria-expanded={!pinnedCollapsed}
                >
                  {pinnedCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
            {!pinnedCollapsed && pinnedTabs.length > 0 ? (
              <div className="sidebar-list sidebar-pinned-list">
                {pinnedTabs.map((tab) => {
                  const title = tab.title || (tab.filePath ? fileNameFromPath(tab.filePath) : t("currentFileFallback"));
                  return (
                    <div
                      key={tab.id}
                      className="sidebar-file-row"
                      title={tab.filePath ?? title}
                    >
                      <button
                        type="button"
                        className="sidebar-file sidebar-file-button"
                        onClick={() => handleActivatePinnedTab(tab.id)}
                        aria-label={t("openPinnedTab", { name: title })}
                      >
                        <Pin size={14} className="file-icon" aria-hidden="true" />
                        <span className="sidebar-file-name">{title}</span>
                      </button>
                      <button
                        type="button"
                        className="sidebar-row-action"
                        onClick={() => handleUnpinTab(tab.id)}
                        title={t("quickActions.unpin")}
                        aria-label={t("unpinPinnedTab", { name: title })}
                      >
                        <PinOff size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : !pinnedCollapsed ? (
              <div className="sidebar-empty sidebar-empty-compact">{t("pinnedEmpty")}</div>
            ) : null}
          </section>

          <section className="sidebar-section" aria-labelledby="sidebar-current-heading">
            <div className="sidebar-section-header">
              <h2 id="sidebar-current-heading" className="sidebar-section-title">
                {t("sections.current")}
              </h2>
              <div className="sidebar-header-actions">
                <button
                  className={`sidebar-btn ${viewMode === "outline" ? "active" : ""}`}
                  onClick={() => handleToggleCurrentPanel("outline")}
                  title={viewMode === "outline" ? t("hideCurrentPanel") : t("showCurrentOutline")}
                  aria-label={viewMode === "outline" ? t("hideCurrentPanel") : t("showCurrentOutline")}
                  aria-pressed={viewMode === "outline"}
                >
                  <TableOfContents size={14} />
                </button>
                <button
                  className={`sidebar-btn ${viewMode === "history" ? "active" : ""}`}
                  onClick={() => handleToggleCurrentPanel("history")}
                  title={viewMode === "history" ? t("hideCurrentPanel") : t("showCurrentHistory")}
                  aria-label={viewMode === "history" ? t("hideCurrentPanel") : t("showCurrentHistory")}
                  aria-pressed={viewMode === "history"}
                >
                  <History size={14} />
                </button>
              </div>
            </div>
            <div className="sidebar-current-file" title={filePath ?? currentTitle}>
              <FileText size={14} className="file-icon" aria-hidden="true" />
              <span className="sidebar-file-name">{currentTitle}</span>
              {isDirty && (
                <span
                  className="file-dirty-dot"
                  title={t("dirtyIndicator")}
                  aria-label={t("dirtyIndicator")}
                />
              )}
            </div>
            {viewMode === "outline" && (
              <div className="sidebar-current-panel">
                <OutlineView />
              </div>
            )}
            {viewMode === "history" && (
              <div className="sidebar-current-panel">
                {filePath && (
                  <div className="sidebar-current-panel-actions">
                    <button
                      className="sidebar-btn"
                      onClick={handleClearDocumentHistory}
                      title={t("clearDocumentHistory")}
                      aria-label={t("clearDocumentHistory")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                <HistoryView />
              </div>
            )}
          </section>

          <section className="sidebar-section" aria-label={`${t("sections.drafts")} / ${t("sections.recent")}`}>
            <div className="sidebar-tablist" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={fileListMode === "drafts"}
                className={`sidebar-tab ${fileListMode === "drafts" ? "active" : ""}`}
                onClick={() => setFileListMode("drafts")}
              >
                {t("sections.drafts")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fileListMode === "recent"}
                className={`sidebar-tab ${fileListMode === "recent" ? "active" : ""}`}
                onClick={() => setFileListMode("recent")}
              >
                {t("sections.recent")}
              </button>
              <button
                type="button"
                className="sidebar-tab-action"
                onClick={handleCreateDraft}
                title={t("newDraft")}
                aria-label={t("newDraft")}
              >
                <Plus size={14} />
              </button>
            </div>
            {fileListMode === "drafts" ? (
              <div className="sidebar-empty sidebar-empty-compact">{t("draftsEmpty")}</div>
            ) : visibleRecentFiles.length > 0 ? (
              <div className="sidebar-list">
                {visibleRecentFiles.map((file) => (
                  <div
                    key={file.path}
                    className="sidebar-file-row"
                    title={file.path}
                  >
                    <button
                      type="button"
                      className="sidebar-file sidebar-file-button"
                      onClick={() => void openFile(file.path)}
                      aria-label={t("openRecentFile", { name: file.name })}
                    >
                      <FileText size={14} className="file-icon" aria-hidden="true" />
                      <span className="sidebar-file-name">{file.name}</span>
                    </button>
                    <div className="sidebar-row-actions">
                      <button
                        type="button"
                        className="sidebar-row-action"
                        onClick={() => void handleRenameRecentFile(file.path, file.name)}
                        title={t("quickActions.rename")}
                        aria-label={t("renameRecentFile", { name: file.name })}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="sidebar-row-action"
                        onClick={() => void handlePinFilePath(file.path)}
                        title={t("quickActions.pin")}
                        aria-label={t("pinRecentFile", { name: file.name })}
                      >
                        <Pin size={13} />
                      </button>
                      <button
                        type="button"
                        className="sidebar-row-action"
                        onClick={() => void handleDeleteRecentFile(file.path)}
                        title={t("quickActions.delete")}
                        aria-label={t("deleteRecentFile", { name: file.name })}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sidebar-empty sidebar-empty-compact">{t("recentEmpty")}</div>
            )}
          </section>
        </div>

        <div
          className="sidebar-workspace-resize-handle"
          role="separator"
          aria-orientation="horizontal"
          onMouseDown={handleWorkspaceResizeStart}
        />
        <section
          className="sidebar-section sidebar-workspace-section"
          aria-labelledby="sidebar-workspace-heading"
          style={{ height: workspaceHeight }}
        >
          <div className="sidebar-section-header">
            <h2 id="sidebar-workspace-heading" className="sidebar-section-title">
              {t("sections.workspace")}
            </h2>
            <div className="sidebar-header-actions">
              <button
                className="sidebar-btn"
                onClick={() => void handleAddWorkspaceRoot()}
                title={t("addWorkspaceFolder")}
                aria-label={t("addWorkspaceFolder")}
              >
                <FolderOpen size={14} />
              </button>
              <button
                className="sidebar-btn"
                onClick={() => {
                  for (const ref of Object.values(fileExplorerRefs.current)) ref?.expandAll();
                }}
                title={t("expandAllFolders")}
                aria-label={t("expandAllFolders")}
              >
                <ChevronsUpDown size={14} />
              </button>
              <button
                className="sidebar-btn"
                onClick={() => {
                  for (const ref of Object.values(fileExplorerRefs.current)) ref?.collapseAll();
                }}
                title={t("collapseAllFolders")}
                aria-label={t("collapseAllFolders")}
              >
                <ChevronsDownUp size={14} />
              </button>
              <button
                className="sidebar-btn"
                onClick={() => getActionExplorer()?.createNewFile()}
                title={t("newFile")}
                aria-label={t("newFile")}
              >
                <FilePlus size={14} />
              </button>
              <button
                className="sidebar-btn"
                onClick={() => getActionExplorer()?.createNewFolder()}
                title={t("newFolder")}
                aria-label={t("newFolder")}
              >
                <FolderPlus size={14} />
              </button>
            </div>
          </div>
          <div className={`sidebar-workspace-body ${workspaceRoots.length > 1 ? "has-multiple-roots" : ""}`}>
            {workspaceRoots.length > 0 ? (
              workspaceRoots.map((root) => (
                <div className="sidebar-workspace-root" key={root}>
                  <FileExplorer
                    ref={(handle) => {
                      fileExplorerRefs.current[root] = handle;
                    }}
                    currentFilePath={filePath}
                    rootPathOverride={root}
                    compactLayout={workspaceRoots.length > 1}
                  />
                </div>
              ))
            ) : (
              <div className="sidebar-workspace-root">
                <FileExplorer currentFilePath={filePath} />
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="sidebar-footer">
        <button
          className="sidebar-btn"
          onClick={() => useUIStore.getState().toggleSidebar()}
          title={t("closeSidebar")}
          aria-label={t("closeSidebar")}
          aria-expanded={true}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
