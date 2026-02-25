/**
 * @module mcp
 * MCP (Model Context Protocol) server for the Photoshop App editor.
 *
 * Communicates with Claude Code via stdio and bridges commands to the
 * Electron app via a local HTTP bridge (localhost:PORT).
 *
 * Architecture:
 *   Claude Code ──stdio──> This MCP Server (Node.js)
 *                               │ HTTP (localhost:PORT)
 *                               ↓
 *                        Electron Main Process
 *                               │ IPC (executeJavaScript)
 *                               ↓
 *                        Renderer (Zustand store + editor-actions)
 *
 * @see Phase 2-3: MCP Server
 * @see packages/app/src/main/http-bridge.ts (HTTP bridge)
 * @see packages/app/src/renderer/editor-actions/ (EditorAction API)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, handleToolCall } from './tools.js';

const server = new Server(
  { name: 'photoshop-app', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, (args ?? {}) as Record<string, unknown>);
});

const transport = new StdioServerTransport();
await server.connect(transport);
