const DEFAULT_WORKSPACE_HEIGHT = 280;
const MIN_WORKSPACE_HEIGHT = 160;
const MAX_WORKSPACE_HEIGHT = 420;
const MAX_WORKSPACE_VIEWPORT_RATIO = 0.58;

function readViewportHeight(): number {
  return typeof window !== "undefined" && Number.isFinite(window.innerHeight)
    ? window.innerHeight
    : 800;
}

export function getWorkspaceMaxHeight(viewportHeight = readViewportHeight()): number {
  return Math.max(
    MIN_WORKSPACE_HEIGHT,
    Math.min(MAX_WORKSPACE_HEIGHT, Math.floor(viewportHeight * MAX_WORKSPACE_VIEWPORT_RATIO))
  );
}

export function clampWorkspaceHeight(height: number, viewportHeight = readViewportHeight()): number {
  return Math.min(getWorkspaceMaxHeight(viewportHeight), Math.max(MIN_WORKSPACE_HEIGHT, height));
}

export function readWorkspaceHeight(storageKey: string): number {
  try {
    const stored = Number(globalThis.localStorage?.getItem(storageKey));
    return clampWorkspaceHeight(Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_WORKSPACE_HEIGHT);
  } catch {
    return clampWorkspaceHeight(DEFAULT_WORKSPACE_HEIGHT);
  }
}

export function writeWorkspaceHeight(storageKey: string, height: number): void {
  try {
    globalThis.localStorage?.setItem(storageKey, String(height));
  } catch {
    // Non-critical: resizing still works for the current session.
  }
}
