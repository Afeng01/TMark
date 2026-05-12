/**
 * MCP adapter utilities.
 *
 * Purpose: Convert between TMark server types and MCP SDK types,
 * with proper error wrapping per project conventions.
 *
 * @coordinates-with cli.ts (consumer of these adapters)
 */

/**
 * Content item from TMark server tool results.
 */
interface TMarkContentItem {
  type: string;
  text?: string;
}

/**
 * Resource content item from TMark server resource results.
 */
interface TMarkResourceItem {
  uri: string;
  text?: string;
  mimeType?: string;
}

/**
 * MCP SDK text content format.
 */
interface McpTextContent {
  type: 'text';
  text: string;
}

/**
 * MCP SDK resource content format.
 * Index signature required for compatibility with MCP SDK's ReadResourceCallback.
 */
interface McpResourceContent {
  [key: string]: unknown;
  uri: string;
  text: string;
  mimeType?: string;
}

/**
 * MCP SDK tool call result.
 * Index signature required for compatibility with MCP SDK's CallToolCallback.
 */
interface McpToolResult {
  [key: string]: unknown;
  content: McpTextContent[];
  isError?: boolean;
}

/**
 * MCP SDK resource read result.
 * Index signature required for compatibility with MCP SDK's ReadResourceCallback.
 */
interface McpResourceResult {
  [key: string]: unknown;
  contents: McpResourceContent[];
}

/**
 * Tool call function signature (matches TMarkMcpServer.callTool).
 */
type CallToolFn = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ content: TMarkContentItem[]; isError?: boolean }>;

/**
 * Resource read function signature (matches TMarkMcpServer.readResource).
 */
type ReadResourceFn = (
  uri: string
) => Promise<{ contents: TMarkResourceItem[] }>;

/**
 * Convert TMark content items to MCP SDK content format.
 * Filters to text-only items with valid text values.
 */
export function toMcpContent(
  items: TMarkContentItem[]
): McpTextContent[] {
  return items
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => ({ type: 'text' as const, text: item.text! }));
}

/**
 * Convert TMark resource contents to MCP SDK format.
 * Filters to items with valid text values.
 */
export function toMcpContents(
  items: TMarkResourceItem[]
): McpResourceContent[] {
  return items
    .filter((item) => typeof item.text === 'string')
    .map((item) => ({
      uri: item.uri,
      text: item.text!,
      mimeType: item.mimeType,
    }));
}

/**
 * Create an error-wrapped tool handler callback for MCP SDK registration.
 *
 * Wraps the TMark server's callTool + toMcpContent pipeline in try/catch.
 * On error, returns a proper MCP error response instead of rejecting.
 */
export function createToolHandler(
  toolName: string,
  callTool: CallToolFn
): (args: Record<string, unknown>) => Promise<McpToolResult> {
  return async (args) => {
    try {
      const result = await callTool(toolName, args);
      return {
        content: toMcpContent(result.content),
        isError: result.isError,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Create an error-wrapped resource handler callback for MCP SDK registration.
 *
 * Wraps the TMark server's readResource + toMcpContents pipeline in try/catch.
 * On error, re-throws with descriptive context.
 */
export function createResourceHandler(
  resourceUri: string,
  readResource: ReadResourceFn
): () => Promise<McpResourceResult> {
  return async () => {
    try {
      const result = await readResource(resourceUri);
      return { contents: toMcpContents(result.contents) };
    } catch (error) {
      throw new Error(
        `Resource read failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}
