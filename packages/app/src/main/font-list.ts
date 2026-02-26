/**
 * @module font-list
 * IPC handlers for system font enumeration and custom/local font loading.
 *
 * Registers IPC channels:
 * - `font:getSystemFonts` — Returns cached list of system font family names (PowerShell enumeration).
 * - `font:loadCustomFont` — Reads a font file from disk and returns its ArrayBuffer.
 * - `font:loadLocalFont` — Reads a local font from assets/fonts/japanese/ by relative path.
 *
 * @see https://www.electronjs.org/docs/latest/api/ipc-main
 */

import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { bufferToArrayBuffer } from './buffer-utils';

/** Cached system font list (populated on first request). */
let cachedFonts: string[] | null = null;

/**
 * Enumerate system fonts via PowerShell (Windows).
 * Falls back to a minimal list on non-Windows platforms or on error.
 */
function getSystemFontList(): string[] {
  if (cachedFonts) return cachedFonts;

  try {
    const cmd =
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }"';
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 10_000 });
    cachedFonts = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    // Fallback for non-Windows or if PowerShell fails
    cachedFonts = [
      'Arial',
      'Helvetica',
      'Times New Roman',
      'Georgia',
      'Courier New',
      'Verdana',
      'Impact',
      'Comic Sans MS',
      'Trebuchet MS',
      'Tahoma',
    ];
  }

  return cachedFonts;
}

/**
 * Resolve the base directory for local Japanese fonts.
 * In production: resources/assets/fonts/japanese/
 * In development: project root/assets/fonts/japanese/
 */
function getLocalFontsBaseDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', 'fonts', 'japanese');
  }
  // Development: walk up from app directory to project root
  return path.join(app.getAppPath(), '..', '..', '..', '..', 'assets', 'fonts', 'japanese');
}

/**
 * Validate that a relative path does not escape the base directory.
 * Prevents path traversal attacks (e.g. ../../etc/passwd).
 * @param relativePath - The relative path to validate.
 * @param baseDir - The allowed base directory.
 * @returns The resolved absolute path, or null if invalid.
 */
function safeResolveFontPath(relativePath: string, baseDir: string): string | null {
  // Reject obviously malicious patterns
  if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  const resolved = path.resolve(baseDir, relativePath);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    return null;
  }
  return resolved;
}

/** Register font-related IPC handlers. */
export function registerFontHandlers(): void {
  ipcMain.handle('font:getSystemFonts', () => {
    return getSystemFontList();
  });

  ipcMain.handle('font:loadCustomFont', async (_event, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath);
      return { data: bufferToArrayBuffer(buffer), name: filePath };
    } catch {
      return null;
    }
  });

  ipcMain.handle('font:loadLocalFont', async (_event, relativePath: string) => {
    try {
      const baseDir = getLocalFontsBaseDir();
      const resolved = safeResolveFontPath(relativePath, baseDir);
      if (!resolved) {
        return null;
      }
      if (!fs.existsSync(resolved)) {
        return null;
      }
      const buffer = fs.readFileSync(resolved);
      return { data: bufferToArrayBuffer(buffer), name: path.basename(resolved) };
    } catch {
      return null;
    }
  });
}
