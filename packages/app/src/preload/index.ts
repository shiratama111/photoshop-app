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

  // Font system
  getSystemFonts: (): Promise<string[]> =>
    ipcRenderer.invoke('font:getSystemFonts'),

  loadCustomFont: (filePath: string): Promise<{ data: ArrayBuffer; name: string } | null> =>
    ipcRenderer.invoke('font:loadCustomFont', filePath),

  loadLocalFont: (relativePath: string): Promise<{ data: ArrayBuffer; name: string } | null> =>
    ipcRenderer.invoke('font:loadLocalFont', relativePath),

  // Google Fonts — FONT-001
  searchGoogleFonts: (
    query: string,
    category: string,
    sort: string,
    offset: number,
    limit: number,
  ): Promise<unknown> =>
    ipcRenderer.invoke('font:searchGoogleFonts', query, category, sort, offset, limit),

  downloadGoogleFont: (
    family: string,
    variant?: string,
  ): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('font:downloadGoogleFont', family, variant),

  getDownloadedGoogleFonts: (): Promise<unknown[]> =>
    ipcRenderer.invoke('font:getDownloadedGoogleFonts'),

  loadGoogleFontFile: (
    family: string,
  ): Promise<{ family: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('font:loadGoogleFontFile', family),

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
    return (): void => { ipcRenderer.removeListener('app:beforeClose', listener); };
  },
  confirmClose: (action: 'save' | 'discard' | 'cancel'): void => {
    ipcRenderer.send('app:confirmClose', action);
  },

  // Menu event listeners
  onMenuNew: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:new', listener);
    return (): void => { ipcRenderer.removeListener('menu:new', listener); };
  },
  onMenuOpen: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:open', listener);
    return (): void => { ipcRenderer.removeListener('menu:open', listener); };
  },
  onMenuSave: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:save', listener);
    return (): void => { ipcRenderer.removeListener('menu:save', listener); };
  },
  onMenuSaveAs: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:saveAs', listener);
    return (): void => { ipcRenderer.removeListener('menu:saveAs', listener); };
  },
  onMenuExport: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:export', listener);
    return (): void => { ipcRenderer.removeListener('menu:export', listener); };
  },
  onMenuUndo: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:undo', listener);
    return (): void => { ipcRenderer.removeListener('menu:undo', listener); };
  },
  onMenuRedo: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:redo', listener);
    return (): void => { ipcRenderer.removeListener('menu:redo', listener); };
  },
  onMenuZoomIn: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:zoomIn', listener);
    return (): void => { ipcRenderer.removeListener('menu:zoomIn', listener); };
  },
  onMenuZoomOut: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:zoomOut', listener);
    return (): void => { ipcRenderer.removeListener('menu:zoomOut', listener); };
  },
  onMenuFitToWindow: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:fitToWindow', listener);
    return (): void => { ipcRenderer.removeListener('menu:fitToWindow', listener); };
  },
  onMenuActualSize: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:actualSize', listener);
    return (): void => { ipcRenderer.removeListener('menu:actualSize', listener); };
  },
  onMenuAbout: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:about', listener);
    return (): void => { ipcRenderer.removeListener('menu:about', listener); };
  },

  // Image/Filter menu events
  onMenuAdjustment: (callback: (type: string) => void): (() => void) => {
    const listener = (_event: unknown, type: string): void => callback(type);
    ipcRenderer.on('menu:adjustment', listener as (...args: unknown[]) => void);
    return (): void => { ipcRenderer.removeListener('menu:adjustment', listener as (...args: unknown[]) => void); };
  },
  onMenuFilter: (callback: (type: string) => void): (() => void) => {
    const listener = (_event: unknown, type: string): void => callback(type);
    ipcRenderer.on('menu:filter', listener as (...args: unknown[]) => void);
    return (): void => { ipcRenderer.removeListener('menu:filter', listener as (...args: unknown[]) => void); };
  },
  onMenuImageSize: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:imageSize', listener);
    return (): void => { ipcRenderer.removeListener('menu:imageSize', listener); };
  },
  onMenuCanvasSize: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:canvasSize', listener);
    return (): void => { ipcRenderer.removeListener('menu:canvasSize', listener); };
  },
  onMenuRotateCanvas: (callback: (direction: string) => void): (() => void) => {
    const listener = (_event: unknown, direction: string): void => callback(direction);
    ipcRenderer.on('menu:rotateCanvas', listener as (...args: unknown[]) => void);
    return (): void => { ipcRenderer.removeListener('menu:rotateCanvas', listener as (...args: unknown[]) => void); };
  },
  onMenuFlipCanvas: (callback: (direction: string) => void): (() => void) => {
    const listener = (_event: unknown, direction: string): void => callback(direction);
    ipcRenderer.on('menu:flipCanvas', listener as (...args: unknown[]) => void);
    return (): void => { ipcRenderer.removeListener('menu:flipCanvas', listener as (...args: unknown[]) => void); };
  },
  onMenuFill: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:fill', listener);
    return (): void => { ipcRenderer.removeListener('menu:fill', listener); };
  },
  onMenuSelectAll: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:selectAll', listener);
    return (): void => { ipcRenderer.removeListener('menu:selectAll', listener); };
  },
  onMenuDeselect: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:deselect', listener);
    return (): void => { ipcRenderer.removeListener('menu:deselect', listener); };
  },
  onMenuCrop: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:crop', listener);
    return (): void => { ipcRenderer.removeListener('menu:crop', listener); };
  },

  // Phase 1: Place Image menu
  onMenuPlaceImage: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:placeImage', listener);
    return (): void => { ipcRenderer.removeListener('menu:placeImage', listener); };
  },

  // Phase 1: Template menu
  onMenuSaveTemplate: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:saveTemplate', listener);
    return (): void => { ipcRenderer.removeListener('menu:saveTemplate', listener); };
  },
  onMenuLoadTemplate: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:loadTemplate', listener);
    return (): void => { ipcRenderer.removeListener('menu:loadTemplate', listener); };
  },

  // TMPL-001: Template file I/O (.psxp)
  saveTemplateFile: (data: ArrayBuffer, defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveTemplateFile', data, defaultName),

  openTemplateFile: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:openTemplateFile'),

  // Phase 1: Place image file dialog
  openPlaceImageDialog: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:placeImage'),

  // Phase 1-3/1-4: Insert menu events
  onMenuInsertBackground: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:insertBackground', listener);
    return (): void => { ipcRenderer.removeListener('menu:insertBackground', listener); };
  },
  onMenuInsertPattern: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:insertPattern', listener);
    return (): void => { ipcRenderer.removeListener('menu:insertPattern', listener); };
  },
  onMenuInsertBorder: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:insertBorder', listener);
    return (): void => { ipcRenderer.removeListener('menu:insertBorder', listener); };
  },
  onMenuGradientMask: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('menu:gradientMask', listener);
    return (): void => { ipcRenderer.removeListener('menu:gradientMask', listener); };
  },

  // Photoshop preset auto-import — PRESET-001
  scanPhotoshopPresets: (): Promise<unknown> => ipcRenderer.invoke('psimport:scan'),
  resetPhotoshopImportManifest: (): Promise<boolean> => ipcRenderer.invoke('psimport:resetManifest'),

  // Phase 2-1: Editor Action API IPC
  executeEditorActions: (actions: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke('editor:executeActions', actions),
  onEditorExecuteActions: (callback: (actions: unknown[]) => unknown[]): (() => void) => {
    const listener = (_event: unknown, actions: unknown[]): unknown[] => callback(actions);
    ipcRenderer.on('editor:executeActions', listener as (...args: unknown[]) => void);
    return (): void => { ipcRenderer.removeListener('editor:executeActions', listener as (...args: unknown[]) => void); };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/** Type declaration for the exposed API. */
export type ElectronAPI = typeof electronAPI;

