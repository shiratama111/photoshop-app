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
  onBeforeClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('app:beforeClose', listener);
    return (): void => ipcRenderer.removeListener('app:beforeClose', listener);
  },
  confirmClose: (action: 'save' | 'discard' | 'cancel'): void => {
    ipcRenderer.send('app:confirmClose', action);
  },

  // Menu event listeners
  onMenuNew: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:new', listener);
    return (): void => ipcRenderer.removeListener('menu:new', listener);
  },
  onMenuOpen: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:open', listener);
    return (): void => ipcRenderer.removeListener('menu:open', listener);
  },
  onMenuSave: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:save', listener);
    return (): void => ipcRenderer.removeListener('menu:save', listener);
  },
  onMenuSaveAs: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:saveAs', listener);
    return (): void => ipcRenderer.removeListener('menu:saveAs', listener);
  },
  onMenuExport: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:export', listener);
    return (): void => ipcRenderer.removeListener('menu:export', listener);
  },
  onMenuUndo: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:undo', listener);
    return (): void => ipcRenderer.removeListener('menu:undo', listener);
  },
  onMenuRedo: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:redo', listener);
    return (): void => ipcRenderer.removeListener('menu:redo', listener);
  },
  onMenuZoomIn: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:zoomIn', listener);
    return (): void => ipcRenderer.removeListener('menu:zoomIn', listener);
  },
  onMenuZoomOut: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:zoomOut', listener);
    return (): void => ipcRenderer.removeListener('menu:zoomOut', listener);
  },
  onMenuFitToWindow: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:fitToWindow', listener);
    return (): void => ipcRenderer.removeListener('menu:fitToWindow', listener);
  },
  onMenuActualSize: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:actualSize', listener);
    return (): void => ipcRenderer.removeListener('menu:actualSize', listener);
  },
  onMenuAbout: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:about', listener);
    return (): void => ipcRenderer.removeListener('menu:about', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/** Type declaration for the exposed API. */
export type ElectronAPI = typeof electronAPI;
