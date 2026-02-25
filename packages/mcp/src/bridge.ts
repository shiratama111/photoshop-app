/**
 * @module bridge
 * HTTP client that communicates with the Electron app's HTTP bridge.
 *
 * Reads the port from ~/.photoshop-app-mcp-port (written by the Electron app)
 * and sends EditorAction payloads via POST /api/actions.
 *
 * @see packages/app/src/main/http-bridge.ts
 * @see Phase 2-3: MCP Server
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Path to the port file written by the Electron app. */
const PORT_FILE = path.join(os.homedir(), '.photoshop-app-mcp-port');

/** Read the port number from the port file. Throws if not available. */
function getPort(): number {
  if (!fs.existsSync(PORT_FILE)) {
    throw new Error(
      'Photoshop App is not running (port file not found). ' +
      'Start the app first, then retry.',
    );
  }
  const content = fs.readFileSync(PORT_FILE, 'utf-8').trim();
  const port = parseInt(content, 10);
  if (isNaN(port) || port <= 0) {
    throw new Error(`Invalid port in ${PORT_FILE}: "${content}"`);
  }
  return port;
}

/**
 * Send an array of EditorActions to the Electron app and return the results.
 * Each action produces one ActionResult in the returned array.
 */
export async function callEditor(actions: unknown[]): Promise<unknown[]> {
  const port = getPort();
  const res = await fetch(`http://127.0.0.1:${port}/api/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(actions),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Editor returned HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<unknown[]>;
}

/** Check if the Electron app's HTTP bridge is reachable. */
export async function healthCheck(): Promise<boolean> {
  try {
    const port = getPort();
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
