import { describe, expect, it } from "vitest";
import {
  buildWorkspaceWatchTargets,
  getWorkspaceRootWatchId,
  isWatchIdForWindow,
} from "./workspaceWatchIds";

describe("workspaceWatchIds", () => {
  it("keeps the primary workspace root on the window watch id", () => {
    expect(getWorkspaceRootWatchId("main", "/workspace", "/workspace")).toBe("main");
  });

  it("derives stable watcher ids for additional workspace roots", () => {
    expect(getWorkspaceRootWatchId("main", "/archive/notes", "/workspace")).toBe(
      "main:workspace-root:/archive/notes"
    );
  });

  it("builds deduplicated watch targets for workspace roots", () => {
    expect(buildWorkspaceWatchTargets("main", "/workspace", ["/workspace", "/archive", "/archive"])).toEqual([
      { watchId: "main", path: "/workspace" },
      { watchId: "main:workspace-root:/archive", path: "/archive" },
    ]);
  });

  it("matches derived workspace root watch ids to the owning window only", () => {
    expect(isWatchIdForWindow("main:workspace-root:/archive", "main")).toBe(true);
    expect(isWatchIdForWindow("other:workspace-root:/archive", "main")).toBe(false);
  });
});
