/**
 * @module auto-save
 * Auto-save and crash recovery logic for the Electron main process.
 *
 * Manages:
 * - Writing auto-save files to a temp directory every 2 minutes
 * - Checking for recovery files on startup
 * - Cleaning up auto-save files after successful save
 *
 * Auto-save files are stored in: {userData}/autosave/
 * File format: {documentId}.psxp.autosave
 *
 * @see APP-008: Auto-save + finishing touches
 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { bufferToArrayBuffer } from './buffer-utils';

/** Metadata stored alongside the auto-save file. */
export interface AutoSaveEntry {
  /** Document ID (UUID). */
  documentId: string;
  /** Document display name. */
  documentName: string;
  /** Original file path, or null for unsaved documents. */
  filePath: string | null;
  /** ISO 8601 timestamp of the auto-save. */
  savedAt: string;
}

/** Auto-save directory path within userData. */
function autoSaveDir(): string {
  return path.join(app.getPath('userData'), 'autosave');
}

/** Ensure the auto-save directory exists. */
function ensureAutoSaveDir(): void {
  const dir = autoSaveDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Path to the auto-save data file. */
function autoSaveDataPath(documentId: string): string {
  return path.join(autoSaveDir(), `${documentId}.autosave`);
}

/** Path to the auto-save metadata file. */
function autoSaveMetaPath(documentId: string): string {
  return path.join(autoSaveDir(), `${documentId}.meta.json`);
}

/**
 * Write an auto-save file for the given document.
 * @param documentId  - UUID of the document.
 * @param documentName - Display name of the document.
 * @param filePath    - Original file path (null for unsaved).
 * @param data        - PSD/project binary data.
 */
export function writeAutoSave(
  documentId: string,
  documentName: string,
  filePath: string | null,
  data: Buffer,
): void {
  try {
    ensureAutoSaveDir();
    fs.writeFileSync(autoSaveDataPath(documentId), data);
    const meta: AutoSaveEntry = {
      documentId,
      documentName,
      filePath,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(autoSaveMetaPath(documentId), JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    // Silently ignore write errors (e.g. disk full)
  }
}

/**
 * Remove auto-save files for a given document.
 * Called after a successful manual save or on discard.
 */
export function clearAutoSave(documentId: string): void {
  try {
    const dataPath = autoSaveDataPath(documentId);
    const metaPath = autoSaveMetaPath(documentId);
    if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {
    // Silently ignore
  }
}

/** Remove all auto-save files. */
export function clearAllAutoSaves(): void {
  try {
    const dir = autoSaveDir();
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      fs.unlinkSync(path.join(dir, file));
    }
  } catch {
    // Silently ignore
  }
}

/**
 * List all recoverable auto-save entries.
 * Returns metadata entries for each auto-save file that exists.
 */
export function listRecoveryFiles(): AutoSaveEntry[] {
  try {
    const dir = autoSaveDir();
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.meta.json'));
    const entries: AutoSaveEntry[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
        const meta: unknown = JSON.parse(raw);
        if (meta && typeof meta === 'object' && 'documentId' in meta) {
          const entry = meta as AutoSaveEntry;
          // Verify the data file also exists
          if (fs.existsSync(autoSaveDataPath(entry.documentId))) {
            entries.push(entry);
          }
        }
      } catch {
        // Skip malformed meta files
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Read the auto-save data for a given document.
 * @returns The binary data, or null if not found.
 */
export function readAutoSave(documentId: string): Buffer | null {
  try {
    const dataPath = autoSaveDataPath(documentId);
    if (!fs.existsSync(dataPath)) return null;
    return fs.readFileSync(dataPath);
  } catch {
    return null;
  }
}

/**
 * Register IPC handlers for auto-save and recovery operations.
 */
export function registerAutoSaveHandlers(): void {
  ipcMain.handle(
    'autosave:write',
    (_event, documentId: string, documentName: string, filePath: string | null, data: ArrayBuffer) => {
      writeAutoSave(documentId, documentName, filePath, Buffer.from(data));
      return true;
    },
  );

  ipcMain.handle('autosave:clear', (_event, documentId: string) => {
    clearAutoSave(documentId);
    return true;
  });

  ipcMain.handle('autosave:clearAll', () => {
    clearAllAutoSaves();
    return true;
  });

  ipcMain.handle('autosave:listRecovery', () => {
    return listRecoveryFiles();
  });

  ipcMain.handle('autosave:readRecovery', (_event, documentId: string) => {
    const data = readAutoSave(documentId);
    if (!data) return null;
    return { data: bufferToArrayBuffer(data) };
  });
}
