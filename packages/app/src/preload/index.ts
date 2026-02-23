/**
 * @module preload
 * Electron preload script \u2014 Context Bridge API.
 *
 * Exposes a minimal, typed API to the renderer process.
 * All communication with the main process goes through this bridge.
 *
 * Security: Only exposes specific, controlled functions.
 * Never exposes raw ipcRenderer or Node.js APIs.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/context-isolation
 * @see APP-004: writeTo, getRecentFiles, clearRecentFiles
 * @see APP-008: auto-save, recovery, title bar, close confirmation, drag-drop
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

  writeTo: (data: ArrayBuffer, filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:writeTo', data, filePath),

  getRecentFiles: (): Promise<Array<{ filePath: string; name: string; openedAt: string }>> =>
    ipcRenderer.invoke('file:getRecent'),

  clearRecentFiles: (): Promise<boolean> =>
    ipcRenderer.invoke('file:clearRecent'),

  // Auto-save and recovery \u2014 APP-008
  autoSaveWrite: (
    documentId: string,
    documentName: string,
    filePath: string | null,
    data: ArrayBuffer,
  ): Promise<boolean> =>
    ipcRenderer.invoke('autosave:write', documentId, documentName, filePath, data),

  autoSaveClear: (documentId: string): Promise<boolean> =>
    ipcRenderer.invoke('autosave:clear', documentId),

  autoSaveClearAll: (): Promise<boolean> =>
    ipcRenderer.invoke('autosave:clearAll'),

  listRecoveryFiles: (): Promise<
    Array<{
      documentId: string;
      documentName: string;
      filePath: string | null;
      savedAt: string;
    }>
  > => ipcRenderer.invoke('autosave:listRecovery'),

  readRecoveryFile: (
    documentId: string,
  ): Promise<{ data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('autosave:readRecovery', documentId),

  // Title bar \u2014 APP-008
  setTitle: (title: string): Promise<void> =>
    ipcRenderer.invoke('window:setTitle', title),

  // Read file by path (for drag-drop) \u2014 APP-008
  readFileByPath: (filePath: string): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('file:readByPath', filePath),

  // Close confirmation \u2014 APP-008
  onBeforeClose: (callback: () => void): void => {
    ipcRenderer.on('app:beforeClose', callback);
  },
  confirmClose: (action: 'save' | 'discard' | 'cancel'): void => {
    ipcRenderer.send('app:confirmClose', action);
  },

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
