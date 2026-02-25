/**
 * @module http-bridge
 * Local HTTP bridge for MCP server → Electron main process communication.
 *
 * Runs a lightweight HTTP server on localhost (random port) that accepts
 * EditorAction payloads and forwards them to the renderer via executeJavaScript.
 * The port is written to ~/.photoshop-app-mcp-port for the MCP server to discover.
 *
 * Security: Only accepts connections from 127.0.0.1 / ::1 (localhost).
 * Zero external dependencies — uses Node's built-in `http` module.
 *
 * @see Phase 2-3: MCP Server
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BrowserWindow } from 'electron';
import type { AddressInfo } from 'net';

/** Path to the port file that the MCP server reads. */
const PORT_FILE = path.join(os.homedir(), '.photoshop-app-mcp-port');

/** The HTTP server instance. */
let server: http.Server | null = null;

/**
 * Start the HTTP bridge server on a random localhost port.
 * Writes the port number to ~/.photoshop-app-mcp-port.
 *
 * @param getWindow - Getter for the current main window (may return null if closed).
 */
export function startHttpBridge(getWindow: () => BrowserWindow | null): void {
  if (server) return; // Already running

  server = http.createServer(async (req, res) => {
    // Security: only accept localhost connections
    const remote = req.socket.remoteAddress;
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: only localhost allowed' }));
      return;
    }

    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && req.url === '/api/health') {
        const win = getWindow();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', hasWindow: !!win }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/actions') {
        const body = await readBody(req);
        let actions: unknown[];
        try {
          actions = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        if (!Array.isArray(actions)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Body must be a JSON array of actions' }));
          return;
        }

        const win = getWindow();
        if (!win) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No editor window available' }));
          return;
        }

        const results = await win.webContents.executeJavaScript(
          `window.__EDITOR_DISPATCH_ACTIONS__(${JSON.stringify(actions)})`,
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
        return;
      }

      // Unknown endpoint
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
  });

  server.listen(0, '127.0.0.1', () => {
    const addr = server!.address() as AddressInfo;
    fs.writeFileSync(PORT_FILE, String(addr.port), 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`[MCP Bridge] HTTP server listening on 127.0.0.1:${addr.port}`);
  });

  server.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[MCP Bridge] Server error:', err);
  });
}

/** Stop the HTTP bridge server and clean up the port file. */
export function stopHttpBridge(): void {
  if (server) {
    server.close();
    server = null;
  }
  try {
    fs.unlinkSync(PORT_FILE);
  } catch {
    // Port file may not exist — that's fine
  }
}

/** Read the full request body as a string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
