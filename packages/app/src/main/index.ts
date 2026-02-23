/**
 * @module main
 * Electron main process entry point.
 *
 * Responsibilities:
 * - Create the BrowserWindow with security-hardened settings
 * - Register IPC handlers for file operations
 * - Build the application menu
 *
 * Security: contextIsolation=true, sandbox=true, nodeIntegration=false.
 * All renderer↔main communication goes through the Context Bridge.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/security
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { buildMenu } from './menu';

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

/**
 * Register IPC handlers for file operations.
 */
function registerIpcHandlers(): void {
  // File > Open
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [
        { name: 'PSD Files', extensions: ['psd'] },
        { name: 'Project Files', extensions: ['psxp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    return { filePath, data: data.buffer };
  });

  // File > Save
  ipcMain.handle('dialog:saveFile', async (_event, data: ArrayBuffer, defaultPath?: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [
        { name: 'PSD Files', extensions: ['psd'] },
        { name: 'Project Files', extensions: ['psxp'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, Buffer.from(data));
    return result.filePath;
  });

  // File > Export
  ipcMain.handle('dialog:exportFile', async (_event, data: ArrayBuffer, defaultPath?: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
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
}

// App lifecycle
app.whenReady().then(() => {
  registerIpcHandlers();
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
