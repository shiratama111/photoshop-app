/**
 * @module font-list
 * IPC handlers for system font enumeration and custom font loading.
 *
 * Registers two IPC channels:
 * - `font:getSystemFonts` — Returns cached list of system font family names (PowerShell enumeration).
 * - `font:loadCustomFont` — Reads a font file from disk and returns its ArrayBuffer.
 *
 * @see https://www.electronjs.org/docs/latest/api/ipc-main
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
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
}
