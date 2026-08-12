import readline from 'readline';
import { READ_TOOLS_DEFINITIONS, handleReadToolCall } from './tools/readTools.js';
import { WRITE_TOOLS_DEFINITIONS, handleWriteToolCall } from './tools/writeTools.js';
import { MCP_RESOURCES_DEFINITIONS, handleReadResource } from './resources/resources.js';

// Combine Read & Write tools
const ALL_TOOLS = [...READ_TOOLS_DEFINITIONS, ...WRITE_TOOLS_DEFINITIONS];

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Model Context Protocol (MCP) Official Protocol Server Implementation
 */
export class MCPServer {
  private name = 'orderflow-mcp-server';
  private version = '1.0.0';

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
                resources: {}
              },
              serverInfo: {
                name: this.name,
                version: this.version
              }
            }
          };

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { tools: ALL_TOOLS }
          };

        case 'tools/call': {
          const { name, arguments: args } = params || {};
          const isWriteTool = WRITE_TOOLS_DEFINITIONS.some((t) => t.name === name);

          let toolResult: any;
          if (isWriteTool) {
            toolResult = await handleWriteToolCall(name, args || {});
          } else {
            toolResult = await handleReadToolCall(name, args || {});
          }

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(toolResult, null, 2)
                }
              ]
            }
          };
        }

        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { resources: MCP_RESOURCES_DEFINITIONS }
          };

        case 'resources/read': {
          const { uri } = params || {};
          const contents = await handleReadResource(uri);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(contents, null, 2)
                }
              ]
            }
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          };
      }
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message || 'Internal MCP Error'
        }
      };
    }
  }

  /**
   * Listen for MCP JSON-RPC Messages over Stdio Transport
   */
  startStdioTransport() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    console.error(`⚡ [OrderFlow MCP Server v${this.version}] Operational via Stdio Transport.`);

    rl.on('line', async (line) => {
      if (!line.trim()) return;
      try {
        const request = JSON.parse(line);
        const response = await this.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (err: any) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' }
          }) + '\n'
        );
      }
    });
  }
}

export const mcpServerInstance = new MCPServer();

// Direct API / Express Router Helper Exports
export async function executeMCPTool(toolName: string, args: any) {
  const isWriteTool = WRITE_TOOLS_DEFINITIONS.some((t) => t.name === toolName);
  if (isWriteTool) {
    return await handleWriteToolCall(toolName, args);
  } else {
    return await handleReadToolCall(toolName, args);
  }
}

export function getMCPToolsList() {
  return ALL_TOOLS;
}

export function getMCPResourcesList() {
  return MCP_RESOURCES_DEFINITIONS;
}

// Start Stdio Transport if executed directly via CLI
if (process.argv[1] && process.argv[1].includes('server.ts')) {
  mcpServerInstance.startStdioTransport();
}
