/**
 * @module main
 * Electron main process entry point.
 *
 * Responsibilities:
 * - Create the BrowserWindow with security-hardened settings
 * - Register IPC handlers for file operations (via file-dialog module)
 * - Register IPC handlers for auto-save and recovery (via auto-save module)
 * - Build the application menu
 * - Handle close confirmation with unsaved-changes dialog
 * - Manage title bar updates
 *
 * Security: contextIsolation=true, sandbox=true, nodeIntegration=false.
 * All renderer-main communication goes through the Context Bridge.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/security
 * @see APP-004: PSD open/save integration
 * @see APP-008: Auto-save, close confirmation, title bar, drag-drop file read
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { buildMenu } from './menu';
import { registerFileDialogHandlers } from './file-dialog';
import { registerAutoSaveHandlers } from './auto-save';
import { bufferToArrayBuffer } from './buffer-utils';

/** The main application window. */
let mainWindow: BrowserWindow | null = null;

/** Whether we're running in development mode. */
const isDev = !app.isPackaged;

/** Whether the close has been confirmed by the renderer. */
let closeConfirmed = false;

/** Try loading the dev renderer from known local Vite ports. */
async function loadDevRenderer(win: BrowserWindow): Promise<void> {
  const configuredUrl = process.env.VITE_DEV_SERVER_URL;
  const candidates = [
    configuredUrl,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
  ].filter((u): u is string => Boolean(u));
  const uniqueCandidates = [...new Set(candidates)];

  let lastError: unknown = null;
  for (const url of uniqueCandidates) {
    try {
      await win.loadURL(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const message = encodeURIComponent(
    'Failed to connect to Vite dev server. Start it with: pnpm dev',
  );
  await win.loadURL(`data:text/html,<h2>${message}</h2>`);
  if (lastError) {
    // eslint-disable-next-line no-console
    console.error('Failed to load dev renderer from known ports:', lastError);
  }
}

/**
 * Create the main application window.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Photoshop App',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Load the renderer
  if (isDev) {
    // In dev mode, load from local Vite dev server (with port fallback).
    void loadDevRenderer(mainWindow);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built HTML
    void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Close confirmation \u2014 APP-008
  // Intercept the close event and let the renderer decide.
  mainWindow.on('close', (e) => {
    if (closeConfirmed) {
      closeConfirmed = false;
      return; // Allow close
    }
    // Ask the renderer whether the document has unsaved changes.
    // The renderer will respond via 'app:confirmClose'.
    e.preventDefault();
    mainWindow?.webContents.send('app:beforeClose');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up application menu
  buildMenu(mainWindow);
}

/**
 * Register IPC handlers that require a reference to the main window.
 */
function registerWindowHandlers(): void {
  // Title bar update \u2014 APP-008
  ipcMain.handle('window:setTitle', (_event, title: string) => {
    if (mainWindow) {
      mainWindow.setTitle(title);
    }
  });

  // Read file by path (for drag-drop) \u2014 APP-008
  ipcMain.handle('file:readByPath', (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const data = fs.readFileSync(filePath);
      return { filePath, data: bufferToArrayBuffer(data) };
    } catch {
      return null;
    }
  });

  // Close confirmation response from renderer \u2014 APP-008
  ipcMain.on('app:confirmClose', (_event, action: string) => {
    if (action === 'cancel') {
      // User cancelled \u2014 do nothing, window stays open
      return;
    }
    if (action === 'save' || action === 'discard') {
      // Renderer has either saved or the user chose to discard.
      // Allow the close to proceed.
      closeConfirmed = true;
      mainWindow?.close();
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  registerFileDialogHandlers(() => mainWindow);
  registerAutoSaveHandlers();
  registerWindowHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
