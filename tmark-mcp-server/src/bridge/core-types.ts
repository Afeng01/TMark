/**
 * Core bridge types for communication between the MCP server and TMark.
 *
 * The pruned 5-tool surface defines BridgeRequest as a union of the 15
 * `tmark.*` action types. The Rust bridge parser extracts `type` as the
 * request_type and forwards every other key as args, so all extra
 * fields here are flat (not nested under `args`).
 *
 * Plan: dev-docs/plans/20260504-mcp-pruning.md
 */

/**
 * Window labels are still string identifiers; kept here so callers can
 * import the type without dragging in the deleted legacy bundles.
 */
export type WindowId = string;

/**
 * Bridge request types — every command the MCP server can send.
 *
 * One entry per (tool, action) pair. See the workflow tool for the
 * IRPatch shape rules; `patches` is `unknown[]` because the
 * discriminated union for IRPatch lives in the frontend repo
 * (`src/lib/ghaWorkflow/save/mutators.ts`) and we don't want to
 * duplicate the shape here.
 */
export type BridgeRequest =
  | { type: 'tmark.session.get_state' }
  | { type: 'tmark.workspace.new'; kind?: string; windowLabel?: string }
  | { type: 'tmark.workspace.open'; filePath: string; windowLabel?: string }
  | { type: 'tmark.workspace.save'; tabId?: string }
  | { type: 'tmark.workspace.save_as'; tabId?: string; filePath: string }
  | { type: 'tmark.workspace.close'; tabId: string; force?: boolean }
  | { type: 'tmark.workspace.switch_tab'; tabId: string }
  | { type: 'tmark.workspace.focus_window'; windowLabel: string }
  | { type: 'tmark.document.read'; tabId?: string }
  | {
      type: 'tmark.document.write';
      tabId?: string;
      content: string;
      expected_revision?: string;
    }
  | {
      type: 'tmark.document.transform';
      tabId?: string;
      kind: string;
      expected_revision?: string;
    }
  | {
      type: 'tmark.workflow.apply_patch';
      tabId?: string;
      patches: unknown[];
      expected_revision?: string;
    }
  | { type: 'tmark.workflow.validate'; tabId?: string }
  | { type: 'tmark.selection.get'; tabId?: string }
  | {
      type: 'tmark.selection.set';
      tabId?: string;
      content: string;
      expected_revision?: string;
    };

/**
 * Bridge response types — what TMark returns.
 *
 * The `error` field carries either a free-form message (legacy) or a
 * JSON-stringified V2Error envelope ({error, message, current_revision?}).
 * Tools parse opportunistically.
 */
export type BridgeResponse =
  | { success: true; data: unknown }
  | { success: false; error: string; code?: string };

/**
 * Bridge interface — abstracts the WebSocket transport from the tools.
 */
export interface Bridge {
  send<T = unknown>(
    request: BridgeRequest,
  ): Promise<BridgeResponse & { data: T }>;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
