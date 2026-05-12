const WORKSPACE_ROOT_WATCH_SEGMENT = ":workspace-root:";

function normalizeWorkspaceRoots(workspaceRoots: unknown, rootPath: string | null): string[] {
  const roots = Array.isArray(workspaceRoots)
    ? workspaceRoots
    : rootPath
      ? [rootPath]
      : [];
  const seen = new Set<string>();
  return roots.filter((root): root is string => {
    if (typeof root !== "string" || root.length === 0 || seen.has(root)) return false;
    seen.add(root);
    return true;
  });
}

export interface WorkspaceWatchTarget {
  watchId: string;
  path: string;
}

export function getWorkspaceRootWatchId(
  windowLabel: string,
  rootPath: string,
  primaryRootPath: string | null,
): string {
  return rootPath === primaryRootPath
    ? windowLabel
    : `${windowLabel}${WORKSPACE_ROOT_WATCH_SEGMENT}${rootPath}`;
}

export function isWatchIdForWindow(watchId: string, windowLabel: string): boolean {
  return watchId === windowLabel || watchId.startsWith(`${windowLabel}${WORKSPACE_ROOT_WATCH_SEGMENT}`);
}

export function buildWorkspaceWatchTargets(
  windowLabel: string,
  rootPath: string | null,
  workspaceRoots: unknown,
): WorkspaceWatchTarget[] {
  return normalizeWorkspaceRoots(workspaceRoots, rootPath).map((root) => ({
    watchId: getWorkspaceRootWatchId(windowLabel, root, rootPath),
    path: root,
  }));
}
