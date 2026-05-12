/**
 * Purpose: Route the pruned 5-tool MCP surface — `tmark.session.*`,
 *   `tmark.workspace.*`, `tmark.document.*`, `tmark.workflow.*`,
 *   `tmark.selection.*` — to their handlers. Returns `true` iff the
 *   request type matched.
 *
 * Plan: dev-docs/plans/20260504-mcp-pruning.md WI-1.2 (initial 4 tools)
 *   and WI-2.1 (selection re-add per ADR-7).
 *
 * @coordinates-with hooks/mcpBridge/handleRequest.ts — top-level router
 * @module hooks/mcpBridge/v2/dispatch
 */

import type { McpRequestEvent } from "../types";
import { handleSessionGetState } from "./session";
import {
  handleDocumentRead,
  handleDocumentWrite,
  handleDocumentTransform,
} from "./document";
import {
  handleWorkspaceNew,
  handleWorkspaceOpen,
  handleWorkspaceSave,
  handleWorkspaceSaveAs,
  handleWorkspaceClose,
  handleWorkspaceSwitchTab,
  handleWorkspaceFocusWindow,
} from "./workspace";
import {
  handleWorkflowApplyPatch,
  handleWorkflowValidate,
} from "./workflow";
import { handleSelectionGet, handleSelectionSet } from "./selection";

/**
 * App version used in the `session.get_state` capabilities payload.
 *
 * Sourced from `package.json` at build time via Vite's `import.meta.env`
 * is the cleanest path, but TMark currently propagates the version
 * through other channels (Cargo, MCP CLI). For now we hard-code; a
 * follow-up wires this through the build pipeline.
 */
const APP_VERSION = "0.7.0";

export async function dispatchV2(event: McpRequestEvent): Promise<boolean> {
  const { id, type, args } = event;
  switch (type) {
    case "tmark.session.get_state":
      await handleSessionGetState(id, APP_VERSION);
      return true;

    case "tmark.workspace.new":
      await handleWorkspaceNew(id, args);
      return true;
    case "tmark.workspace.open":
      await handleWorkspaceOpen(id, args);
      return true;
    case "tmark.workspace.save":
      await handleWorkspaceSave(id, args);
      return true;
    case "tmark.workspace.save_as":
      await handleWorkspaceSaveAs(id, args);
      return true;
    case "tmark.workspace.close":
      await handleWorkspaceClose(id, args);
      return true;
    case "tmark.workspace.switch_tab":
      await handleWorkspaceSwitchTab(id, args);
      return true;
    case "tmark.workspace.focus_window":
      await handleWorkspaceFocusWindow(id, args);
      return true;

    case "tmark.document.read":
      await handleDocumentRead(id, args);
      return true;
    case "tmark.document.write":
      await handleDocumentWrite(id, args);
      return true;
    case "tmark.document.transform":
      await handleDocumentTransform(id, args);
      return true;

    case "tmark.workflow.apply_patch":
      await handleWorkflowApplyPatch(id, args);
      return true;
    case "tmark.workflow.validate":
      await handleWorkflowValidate(id, args);
      return true;

    case "tmark.selection.get":
      await handleSelectionGet(id, args);
      return true;
    case "tmark.selection.set":
      await handleSelectionSet(id, args);
      return true;

    default:
      return false;
  }
}
