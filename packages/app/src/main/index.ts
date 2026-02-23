/**
 * @module main
 * Electron main process entry point.
 *
 * Responsibilities:
 * - Create the BrowserWindow with security-hardened settings
 * - Register IPC handlers for file operations (via file-dialog module)
 * - Build the application menu
 *
 * Security: contextIsolation=true, sandbox=true, nodeIntegration=false.
 * All renderer-main communication goes through the Context Bridge.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/security
 * @see APP-004: PSD open/save integration
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { buildMenu } from './menu';
import { registerFileDialogHandlers } from './file-dialog';

/** The main application window. */
let mainWindow: BrowserWindow | null = null;

/** Whether we're running in development mode. */
const isDev = !app.isPackaged;

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
    // In dev mode, load from Vite dev server
    void mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built HTML
    void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up application menu
  buildMenu(mainWindow);
}

// App lifecycle
app.whenReady().then(() => {
  registerFileDialogHandlers(() => mainWindow);
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
