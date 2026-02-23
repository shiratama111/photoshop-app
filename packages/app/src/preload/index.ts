/**
 * @module preload
 * Electron preload script — Context Bridge API.
 *
 * Exposes a minimal, typed API to the renderer process.
 * All communication with the main process goes through this bridge.
 *
 * Security: Only exposes specific, controlled functions.
 * Never exposes raw ipcRenderer or Node.js APIs.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/context-isolation
 */

import { contextBridge, ipcRenderer } from 'electron';

/** API exposed to the renderer via window.electronAPI. */
const electronAPI = {
  // File operations
  openFile: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:openFile'),

  saveFile: (data: ArrayBuffer, defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', data, defaultPath),

  exportFile: (data: ArrayBuffer, defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:exportFile', data, defaultPath),

  // Menu event listeners
  onMenuNew: (callback: () => void): void => {
    ipcRenderer.on('menu:new', callback);
  },
  onMenuOpen: (callback: () => void): void => {
    ipcRenderer.on('menu:open', callback);
  },
  onMenuSave: (callback: () => void): void => {
    ipcRenderer.on('menu:save', callback);
  },
  onMenuSaveAs: (callback: () => void): void => {
    ipcRenderer.on('menu:saveAs', callback);
  },
  onMenuExport: (callback: () => void): void => {
    ipcRenderer.on('menu:export', callback);
  },
  onMenuUndo: (callback: () => void): void => {
    ipcRenderer.on('menu:undo', callback);
  },
  onMenuRedo: (callback: () => void): void => {
    ipcRenderer.on('menu:redo', callback);
  },
  onMenuZoomIn: (callback: () => void): void => {
    ipcRenderer.on('menu:zoomIn', callback);
  },
  onMenuZoomOut: (callback: () => void): void => {
    ipcRenderer.on('menu:zoomOut', callback);
  },
  onMenuFitToWindow: (callback: () => void): void => {
    ipcRenderer.on('menu:fitToWindow', callback);
  },
  onMenuActualSize: (callback: () => void): void => {
    ipcRenderer.on('menu:actualSize', callback);
  },
  onMenuAbout: (callback: () => void): void => {
    ipcRenderer.on('menu:about', callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/** Type declaration for the exposed API. */
export type ElectronAPI = typeof electronAPI;
