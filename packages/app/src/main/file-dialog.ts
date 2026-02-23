/**
 * @module file-dialog
 * Centralized file I/O IPC handlers for Electron main process.
 *
 * Registers all IPC channels related to opening, saving, and exporting files.
 * Also manages the recent-files list persisted to userData.
 *
 * @see APP-004: PSD open/save integration
 * @see https://www.electronjs.org/docs/latest/api/dialog
 */

import { dialog, ipcMain, app } from 'electron';
import type { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** A single entry in the recent-files list. */
export interface RecentFileEntry {
  /** Absolute path to the file. */
  filePath: string;
  /** Display name (file name only). */
  name: string;
  /** ISO 8601 timestamp when the file was last opened. */
  openedAt: string;
}

/** Maximum number of recent files to track. */
const MAX_RECENT = 10;

/** Path to the recent-files JSON in userData. */
function recentFilesPath(): string {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

/** Load the recent-files list from disk. Returns [] on any error. */
export function loadRecentFiles(): RecentFileEntry[] {
  try {
    const raw = fs.readFileSync(recentFilesPath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentFileEntry[];
  } catch {
    return [];
  }
}

/** Persist the recent-files list to disk. Silently ignores write errors. */
export function saveRecentFiles(entries: RecentFileEntry[]): void {
  try {
    fs.writeFileSync(recentFilesPath(), JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // Ignore \u2014 e.g. read-only filesystem
  }
}

/** Add a file to the front of the recent list (deduplicates, trims to MAX_RECENT). */
export function addRecentFile(filePath: string): RecentFileEntry[] {
  const entries = loadRecentFiles().filter((e) => e.filePath !== filePath);
  const baseName = path.basename(filePath);
  entries.unshift({ filePath, name: baseName, openedAt: new Date().toISOString() });
  if (entries.length > MAX_RECENT) entries.length = MAX_RECENT;
  saveRecentFiles(entries);
  return entries;
}

/**
 * Register all file-dialog IPC handlers.
 * @param getWindow - Getter for the current BrowserWindow (may be null).
 */
export function registerFileDialogHandlers(
  getWindow: () => BrowserWindow | null,
): void {
  // File > Open
  ipcMain.handle('dialog:openFile', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      filters: [
        { name: 'Supported Files', extensions: ['psd', 'psxp', 'png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: 'PSD Files', extensions: ['psd'] },
        { name: 'Project Files', extensions: ['psxp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    addRecentFile(filePath);
    return { filePath, data: data.buffer };
  });

  // File > Save / Save As
  ipcMain.handle('dialog:saveFile', async (_event, data: ArrayBuffer, defaultPath?: string) => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      defaultPath,
      filters: [
        { name: 'PSD Files', extensions: ['psd'] },
        { name: 'Project Files', extensions: ['psxp'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, Buffer.from(data));
    addRecentFile(result.filePath);
    return result.filePath;
  });

  // Quick-save to an existing path (no dialog)
  ipcMain.handle('file:writeTo', async (_event, data: ArrayBuffer, filePath: string) => {
    try {
      fs.writeFileSync(filePath, Buffer.from(data));
      return filePath;
    } catch {
      return null;
    }
  });

  // File > Export
  ipcMain.handle('dialog:exportFile', async (_event, data: ArrayBuffer, defaultPath?: string) => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      defaultPath,
      filters: [
        { name: 'PNG Image', extensions: ['png'] },
        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
        { name: 'PSD File', extensions: ['psd'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, Buffer.from(data));
    return result.filePath;
  });

  // Recent files
  ipcMain.handle('file:getRecent', () => loadRecentFiles());
  ipcMain.handle('file:clearRecent', () => { saveRecentFiles([]); return true; });
}
