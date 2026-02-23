/**
 * @module store
 * Zustand state store for the renderer process.
 *
 * Manages:
 * - Active document state
 * - Layer operations (add, remove, reorder, property changes)
 * - Command history (undo/redo)
 * - Viewport (zoom/pan)
 * - Canvas renderer integration
 * - Event bus for cross-module communication
 * - PSD open/save and compatibility dialog (APP-004)
 * - Auto-save, title bar, recovery, drag-drop (APP-008)
 *
 * All layer mutations go through Commands for undo/redo support.
 *
 * @see https://github.com/pmndrs/zustand
 * @see APP-002: Canvas view + layer panel integration
 * @see APP-004: PSD open/save integration
 * @see APP-008: Auto-save + finishing touches
 */

import { create } from 'zustand';
import type {
  BlendMode,
  Command,
  CompatibilityReport,
  Document,
  Layer,
  LayerEffect,
  LayerGroup,
  RasterLayer,
} from '@photoshop-app/types';
import {
  CommandHistoryImpl,
  EventBusImpl,
  createRasterLayer,
  createLayerGroup,
  createTextLayer,
  findLayerById,
  findParentGroup,
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  SetLayerPropertyCommand,
} from '@photoshop-app/core';
import { importPsd, exportPsd } from '@photoshop-app/adapter-psd';
import { Canvas2DRenderer, ViewportImpl } from '@photoshop-app/render';

/** Active tool in the toolbar. */
export type Tool = 'select' | 'move' | 'brush' | 'eraser' | 'text' | 'crop' | 'segment';

/** Recent file entry from the main process (APP-004). */
export interface RecentFileEntry {
  filePath: string;
  name: string;
  openedAt: string;
}

/** Recovery file entry from auto-save (APP-008). */
export interface RecoveryEntry {
  documentId: string;
  documentName: string;
  filePath: string | null;
  savedAt: string;
}

/** Shared singleton instances. */
const commandHistory = new CommandHistoryImpl();
const eventBus = new EventBusImpl();
const viewport = new ViewportImpl();
const renderer = new Canvas2DRenderer();

/** Auto-save interval in ms (2 minutes). */
const AUTO_SAVE_INTERVAL_MS = 2 * 60 * 1000;

/** Auto-save interval handle. */
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/** Application state. */
export interface AppState {
  /** Currently active document, or null. */
  document: Document | null;
  /** Active tool. */
  activeTool: Tool;
  /** Current zoom level. */
  zoom: number;
  /** Viewport pan offset. */
  panOffset: { x: number; y: number };
  /** Status bar message. */
  statusMessage: string;
  /** Whether the about dialog is visible. */
  showAbout: boolean;
  /** ID of the currently selected layer. */
  selectedLayerId: string | null;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
  /** Revision counter \u2014 incremented on every document mutation to trigger re-renders. */
  revision: number;
  /** Context menu state. */
  contextMenu: { x: number; y: number; layerId: string } | null;
  /** Pending PSD import awaiting user confirmation (APP-004). */
  pendingPsdImport: { document: Document; report: CompatibilityReport } | null;
  /** Recent files list (APP-004). */
  recentFiles: RecentFileEntry[];
  /** ID of the text layer currently being inline-edited (APP-005). */
  editingTextLayerId: string | null;
  /** Layer style dialog state (APP-005). */
  layerStyleDialog: { layerId: string } | null;
  /** Recovery entries found on startup (APP-008). */
  recoveryEntries: RecoveryEntry[];
  /** Whether a close confirmation is pending (APP-008). */
  pendingClose: boolean;
  /** Whether a drag-drop hover is active (APP-008). */
  dragOverActive: boolean;
  /** Current selection rectangle, or null (APP-015). */
  selection: { x: number; y: number; width: number; height: number } | null;
}

/** Actions on the state. */
export interface AppActions {
  /** Set the active document. */
  setDocument: (doc: Document | null) => void;
  /** Set the active tool. */
  setActiveTool: (tool: Tool) => void;
  /** Set the zoom level. */
  setZoom: (zoom: number) => void;
  /** Set the pan offset. */
  setPanOffset: (offset: { x: number; y: number }) => void;
  /** Set the status bar message. */
  setStatusMessage: (msg: string) => void;
  /** Toggle the about dialog. */
  toggleAbout: () => void;
  /** Create a new empty document. */
  newDocument: (name: string, width: number, height: number) => void;

  // Layer operations (all undoable)
  /** Select a layer by ID. */
  selectLayer: (layerId: string | null) => void;
  /** Add a new raster layer. */
  addRasterLayer: (name?: string) => void;
  /** Add a new layer group. */
  addLayerGroup: (name?: string) => void;
  /** Remove a layer by ID. */
  removeLayer: (layerId: string) => void;
  /** Duplicate a layer by ID. */
  duplicateLayer: (layerId: string) => void;
  /** Toggle layer visibility. */
  toggleLayerVisibility: (layerId: string) => void;
  /** Set layer opacity (0-1). */
  setLayerOpacity: (layerId: string, opacity: number) => void;
  /** Set layer blend mode. */
  setLayerBlendMode: (layerId: string, blendMode: BlendMode) => void;
  /** Rename a layer. */
  renameLayer: (layerId: string, name: string) => void;
  /** Move a layer to a new index within its parent. */
  reorderLayer: (layerId: string, newIndex: number) => void;

  // Text layer operations \u2014 APP-005
  /** Add a new text layer. */
  addTextLayer: (name?: string, text?: string) => void;
  /** Set a text-specific property (undoable). */
  setTextProperty: (layerId: string, key: string, value: unknown) => void;
  /** Add an effect to a layer (undoable). */
  addLayerEffect: (layerId: string, effect: LayerEffect) => void;
  /** Remove an effect from a layer by index (undoable). */
  removeLayerEffect: (layerId: string, index: number) => void;
  /** Update an effect on a layer by index (undoable). */
  updateLayerEffect: (layerId: string, index: number, effect: LayerEffect) => void;
  /** Start inline editing a text layer. */
  startEditingText: (layerId: string) => void;
  /** Stop inline editing. */
  stopEditingText: () => void;
  /** Open the layer style dialog. */
  openLayerStyleDialog: (layerId: string) => void;
  /** Close the layer style dialog. */
  closeLayerStyleDialog: () => void;

  // Effect operations \u2014 APP-007
  /** Replace all effects on a layer in a single undoable operation. */
  setLayerEffects: (layerId: string, effects: LayerEffect[]) => void;

  // History
  /** Undo the last command. */
  undo: () => void;
  /** Redo the last undone command. */
  redo: () => void;

  // Context menu
  /** Show context menu at position for a layer. */
  showContextMenu: (x: number, y: number, layerId: string) => void;
  /** Hide the context menu. */
  hideContextMenu: () => void;

  // Rendering
  /** Render the document to a canvas element. */
  renderToCanvas: (canvas: HTMLCanvasElement) => void;
  /** Render a layer thumbnail. */
  renderLayerThumbnail: (layerId: string, size: number) => HTMLCanvasElement | null;
  /** Fit the viewport to the canvas container size. */
  fitToWindow: (containerWidth: number, containerHeight: number) => void;

  // File operations \u2014 APP-004
  /** Open a PSD file via the system dialog. */
  openFile: () => Promise<void>;
  /** Save the current document. */
  saveFile: () => Promise<void>;
  /** Save As \u2014 always shows the save dialog. */
  saveAsFile: () => Promise<void>;
  /** Accept a pending PSD import (after reviewing compatibility report). */
  acceptPsdImport: () => void;
  /** Cancel a pending PSD import. */
  cancelPsdImport: () => void;
  /** Load the recent files list from the main process. */
  loadRecentFiles: () => Promise<void>;

  // Auto-save and recovery \u2014 APP-008
  /** Start the auto-save timer. */
  startAutoSave: () => void;
  /** Stop the auto-save timer. */
  stopAutoSave: () => void;
  /** Trigger an immediate auto-save. */
  doAutoSave: () => Promise<void>;
  /** Update the window title bar (includes dirty indicator). */
  updateTitleBar: () => void;
  /** Check for recovery files and populate recoveryEntries. */
  checkRecovery: () => Promise<void>;
  /** Recover a document from an auto-save entry. */
  recoverDocument: (documentId: string) => Promise<void>;
  /** Discard all recovery entries. */
  discardRecovery: () => Promise<void>;
  /** Open a file from a drag-drop file path. */
  openFileByPath: (filePath: string) => Promise<void>;
  /** Set drag-over active state. */
  setDragOverActive: (active: boolean) => void;
  /** Handle close confirmation (save, discard, or cancel). */
  handleCloseConfirmation: (action: 'save' | 'discard' | 'cancel') => Promise<void>;
  /** Set pending close state. */
  setPendingClose: (pending: boolean) => void;

  // Export — APP-010
  /** Export the current document as PNG/JPEG/WebP. */
  exportAsImage: (format?: 'png' | 'jpeg' | 'webp') => Promise<void>;

  // Selection -- APP-015
  /** Set the current selection. */
  setSelection: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Select all (entire document). */
  selectAll: () => void;
}

/**
 * Execute a command and update undo/redo availability.
 * Bumps the revision counter to trigger React re-renders.
 */
function executeCommand(command: Command, set: (partial: Partial<AppState>) => void): void {
  commandHistory.execute(command);
  set({
    canUndo: commandHistory.canUndo,
    canRedo: commandHistory.canRedo,
    revision: useAppStore.getState().revision + 1,
  });
  eventBus.emit('document:changed');
}

/** Deep-clone a layer for duplication. */
function cloneLayer(layer: Layer): Layer {
  const base = {
    ...layer,
    id: crypto.randomUUID(),
    name: `${layer.name} copy`,
    parentId: null,
    effects: layer.effects.map((e) => ({ ...e })),
  };

  if (layer.type === 'raster') {
    const raster = base as RasterLayer;
    raster.imageData = layer.imageData
      ? new ImageData(
          new Uint8ClampedArray(layer.imageData.data),
          layer.imageData.width,
          layer.imageData.height,
        )
      : null;
    raster.bounds = { ...layer.bounds };
    return raster;
  }

  if (layer.type === 'group') {
    const group = base as LayerGroup;
    group.children = (layer as LayerGroup).children.map((child) => {
      const cloned = cloneLayer(child);
      cloned.parentId = group.id;
      return cloned;
    });
    group.expanded = (layer as LayerGroup).expanded;
    return group;
  }

  // Text layer \u2014 all primitives, spread is sufficient
  return base as Layer;
}

/** Extract file extension from a path (lowercase, no dot). */
function getExtension(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  return dot >= 0 ? filePath.slice(dot + 1).toLowerCase() : '';
}

/** Extract the file name from a full path. */
function getBaseName(filePath: string): string {
  const sep = filePath.lastIndexOf('/');
  const backSep = filePath.lastIndexOf('\\');
  const last = Math.max(sep, backSep);
  return last >= 0 ? filePath.slice(last + 1) : filePath;
}

/** Type-safe accessor for the Electron context bridge API. */
interface ElectronBridgeAPI {
  openFile: () => Promise<{ filePath: string; data: ArrayBuffer } | null>;
  saveFile: (data: ArrayBuffer, defaultPath?: string) => Promise<string | null>;
  exportFile: (data: ArrayBuffer, defaultPath?: string) => Promise<string | null>;
  writeTo: (data: ArrayBuffer, filePath: string) => Promise<string | null>;
  getRecentFiles: () => Promise<RecentFileEntry[]>;
  clearRecentFiles: () => Promise<boolean>;
  autoSaveWrite: (
    documentId: string,
    documentName: string,
    filePath: string | null,
    data: ArrayBuffer,
  ) => Promise<boolean>;
  autoSaveClear: (documentId: string) => Promise<boolean>;
  autoSaveClearAll: () => Promise<boolean>;
  listRecoveryFiles: () => Promise<RecoveryEntry[]>;
  readRecoveryFile: (documentId: string) => Promise<{ data: ArrayBuffer } | null>;
  setTitle: (title: string) => Promise<void>;
  readFileByPath: (filePath: string) => Promise<{ filePath: string; data: ArrayBuffer } | null>;
  confirmClose: (action: 'save' | 'discard' | 'cancel') => void;
}

function getElectronAPI(): ElectronBridgeAPI {
  return (window as unknown as { electronAPI: ElectronBridgeAPI }).electronAPI;
}

/**
 * Open a raster image (PNG/JPEG/WebP) as a new single-layer Document.
 * Uses createImageBitmap + OffscreenCanvas to decode the image data.
 */
async function openImageAsDocument(
  data: ArrayBuffer,
  filePath: string,
  set: (partial: Partial<AppState>) => void,
): Promise<void> {
  try {
    const blob = new Blob([data]);
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;

    // Draw to OffscreenCanvas to extract ImageData
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      set({ statusMessage: 'Failed to create canvas context' });
      bitmap.close();
      return;
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    bitmap.close();

    // Build the document
    const name = getBaseName(filePath);
    const layerId = crypto.randomUUID();
    const doc: Document = {
      id: crypto.randomUUID(),
      name,
      canvas: {
        size: { width, height },
        dpi: 72,
        colorMode: 'rgb',
        bitDepth: 8,
      },
      rootGroup: {
        id: crypto.randomUUID(),
        name: 'Root',
        type: 'group',
        visible: true,
        opacity: 1,
        blendMode: 'normal' as Document['rootGroup']['blendMode'],
        position: { x: 0, y: 0 },
        locked: false,
        effects: [],
        parentId: null,
        children: [
          {
            id: layerId,
            name: 'Background',
            type: 'raster' as const,
            visible: true,
            opacity: 1,
            blendMode: 'normal' as Document['rootGroup']['blendMode'],
            position: { x: 0, y: 0 },
            locked: false,
            effects: [],
            parentId: null,
            imageData,
            bounds: { x: 0, y: 0, width, height },
          },
        ],
        expanded: true,
      },
      selectedLayerId: layerId,
      filePath,
      dirty: false,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    commandHistory.clear();
    set({
      document: doc,
      selectedLayerId: layerId,
      canUndo: false,
      canRedo: false,
      revision: 0,
      statusMessage: `Opened: ${name} (${width}×${height})`,
    });
    eventBus.emit('document:changed');
  } catch {
    set({ statusMessage: `Failed to open image: ${getBaseName(filePath)}` });
  }
}

/**
 * Open a PSD from raw binary data and file path.
 * Shared logic used by openFile, openFileByPath, and recoverDocument.
 */
function openPsdFromData(
  data: ArrayBuffer,
  filePath: string,
  set: (partial: Partial<AppState>) => void,
): void {
  const ext = getExtension(filePath);
  const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp']);

  if (imageExtensions.has(ext)) {
    // Handle image import - create a single-layer document from the image
    void openImageAsDocument(data, filePath, set);
    return;
  }

  if (ext !== 'psd') {
    set({ statusMessage: `Unsupported file format: .${ext}` });
    return;
  }
  const { document: doc, report } = importPsd(new Uint8Array(data), getBaseName(filePath));
  doc.filePath = filePath;
  if (report.issues.length > 0) {
    set({ pendingPsdImport: { document: doc, report } });
  } else {
    commandHistory.clear();
    set({
      document: doc,
      selectedLayerId: null,
      canUndo: false,
      canRedo: false,
      revision: 0,
      statusMessage: `Opened: ${getBaseName(filePath)}`,
    });
    eventBus.emit('document:changed');
  }
}

/** Zustand store for application state. */
export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // State
  document: null,
  activeTool: 'select',
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  statusMessage: 'Ready',
  showAbout: false,
  selectedLayerId: null,
  canUndo: false,
  canRedo: false,
  revision: 0,
  contextMenu: null,
  pendingPsdImport: null,
  recentFiles: [],
  editingTextLayerId: null,
  layerStyleDialog: null,
  recoveryEntries: [],
  pendingClose: false,
  dragOverActive: false,
  selection: null,

  // Basic actions
  setDocument: (doc): void => set({ document: doc }),
  setActiveTool: (tool): void => set({ activeTool: tool }),
  setZoom: (zoom): void => {
    viewport.setZoom(zoom);
    set({ zoom: viewport.zoom, panOffset: viewport.offset });
  },
  setPanOffset: (offset): void => {
    viewport.setOffset(offset);
    set({ panOffset: viewport.offset });
  },
  setStatusMessage: (msg): void => set({ statusMessage: msg }),
  toggleAbout: (): void => set((s) => ({ showAbout: !s.showAbout })),

  newDocument: (name, width, height): void => {
    commandHistory.clear();
    const doc: Document = {
      id: crypto.randomUUID(),
      name,
      canvas: {
        size: { width, height },
        dpi: 72,
        colorMode: 'rgb',
        bitDepth: 8,
      },
      rootGroup: {
        id: crypto.randomUUID(),
        name: 'Root',
        type: 'group',
        visible: true,
        opacity: 1,
        blendMode: 'normal' as Document['rootGroup']['blendMode'],
        position: { x: 0, y: 0 },
        locked: false,
        effects: [],
        parentId: null,
        children: [],
        expanded: true,
      },
      selectedLayerId: null,
      filePath: null,
      dirty: false,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    set({
      document: doc,
      selectedLayerId: null,
      canUndo: false,
      canRedo: false,
      revision: 0,
      statusMessage: `Created: ${name} (${width}x${height})`,
    });
    eventBus.emit('document:changed');
    get().updateTitleBar();
    get().startAutoSave();
  },

  // Layer operations
  selectLayer: (layerId): void => {
    const { document: doc } = get();
    if (!doc) return;
    if (layerId && !findLayerById(doc.rootGroup, layerId)) return;
    set({ selectedLayerId: layerId });
    doc.selectedLayerId = layerId;
    eventBus.emit('selection:changed', { layerId });
  },

  addRasterLayer: (name): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layerName = name ?? `Layer ${doc.rootGroup.children.length + 1}`;
    const layer = createRasterLayer(layerName, doc.canvas.size.width, doc.canvas.size.height);
    const cmd = new AddLayerCommand(doc.rootGroup, layer);
    executeCommand(cmd, set);
    set({ selectedLayerId: layer.id, statusMessage: `Added: ${layerName}` });
    doc.selectedLayerId = layer.id;
    doc.dirty = true;
    eventBus.emit('layer:added', { layer, parentId: doc.rootGroup.id });
    get().updateTitleBar();
  },

  addLayerGroup: (name): void => {
    const { document: doc } = get();
    if (!doc) return;
    const groupName = name ?? `Group ${doc.rootGroup.children.length + 1}`;
    const group = createLayerGroup(groupName);
    const cmd = new AddLayerCommand(doc.rootGroup, group);
    executeCommand(cmd, set);
    set({ selectedLayerId: group.id, statusMessage: `Added group: ${groupName}` });
    doc.selectedLayerId = group.id;
    doc.dirty = true;
    eventBus.emit('layer:added', { layer: group, parentId: doc.rootGroup.id });
    get().updateTitleBar();
  },

  removeLayer: (layerId): void => {
    const { document: doc, selectedLayerId } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const parent = findParentGroup(doc.rootGroup, layerId);
    if (!parent) return;
    const cmd = new RemoveLayerCommand(parent, layer);
    executeCommand(cmd, set);
    if (selectedLayerId === layerId) {
      set({ selectedLayerId: null });
      doc.selectedLayerId = null;
    }
    doc.dirty = true;
    set({ statusMessage: `Removed: ${layer.name}` });
    eventBus.emit('layer:removed', { layerId, parentId: parent.id });
    get().updateTitleBar();
  },

  duplicateLayer: (layerId): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const parent = findParentGroup(doc.rootGroup, layerId);
    if (!parent) return;
    const cloned = cloneLayer(layer);
    const idx = parent.children.indexOf(layer);
    const cmd = new AddLayerCommand(parent, cloned, idx + 1);
    executeCommand(cmd, set);
    set({ selectedLayerId: cloned.id, statusMessage: `Duplicated: ${layer.name}` });
    doc.selectedLayerId = cloned.id;
    doc.dirty = true;
    eventBus.emit('layer:added', { layer: cloned, parentId: parent.id });
    get().updateTitleBar();
  },

  toggleLayerVisibility: (layerId): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const cmd = new SetLayerPropertyCommand(layer, 'visible', !layer.visible);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'visible' });
    get().updateTitleBar();
  },

  setLayerOpacity: (layerId, opacity): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const clamped = Math.max(0, Math.min(1, opacity));
    const cmd = new SetLayerPropertyCommand(layer, 'opacity', clamped);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'opacity' });
    get().updateTitleBar();
  },

  setLayerBlendMode: (layerId, blendMode): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const cmd = new SetLayerPropertyCommand(layer, 'blendMode', blendMode);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'blendMode' });
    get().updateTitleBar();
  },

  renameLayer: (layerId, name): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const cmd = new SetLayerPropertyCommand(layer, 'name', name);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'name' });
    get().updateTitleBar();
  },

  reorderLayer: (layerId, newIndex): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const parent = findParentGroup(doc.rootGroup, layerId);
    if (!parent) return;
    const cmd = new ReorderLayerCommand(parent, layer, newIndex);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:reordered', { parentId: parent.id });
    get().updateTitleBar();
  },

  setLayerEffects: (layerId, effects): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const cmd = new SetLayerPropertyCommand(layer, 'effects', [...effects]);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'effects' });
    get().updateTitleBar();
  },

  // Text layer operations \u2014 APP-005
  addTextLayer: (name, text): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layerName = name ?? `Text ${doc.rootGroup.children.length + 1}`;
    const layer = createTextLayer(layerName, text ?? 'New Text');
    const cmd = new AddLayerCommand(doc.rootGroup, layer);
    executeCommand(cmd, set);
    set({ selectedLayerId: layer.id, statusMessage: `Added: ${layerName}` });
    doc.selectedLayerId = layer.id;
    doc.dirty = true;
    eventBus.emit('layer:added', { layer, parentId: doc.rootGroup.id });
    get().updateTitleBar();
  },

  setTextProperty: (layerId, key, value): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer || layer.type !== 'text') return;
    const cmd = new SetLayerPropertyCommand(
      layer,
      key as unknown as keyof Layer,
      value as Layer[keyof Layer],
    );
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: key });
    get().updateTitleBar();
  },

  addLayerEffect: (layerId, effect): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const newEffects = [...layer.effects, effect];
    const cmd = new SetLayerPropertyCommand(layer, 'effects', newEffects);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'effects' });
    get().updateTitleBar();
  },

  removeLayerEffect: (layerId, index): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const newEffects = layer.effects.filter((_, i) => i !== index);
    const cmd = new SetLayerPropertyCommand(layer, 'effects', newEffects);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'effects' });
    get().updateTitleBar();
  },

  updateLayerEffect: (layerId, index, effect): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;
    const newEffects = [...layer.effects];
    newEffects[index] = effect;
    const cmd = new SetLayerPropertyCommand(layer, 'effects', newEffects);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'effects' });
    get().updateTitleBar();
  },

  startEditingText: (layerId): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer || layer.type !== 'text') return;
    set({ editingTextLayerId: layerId, selectedLayerId: layerId });
  },

  stopEditingText: (): void => {
    set({ editingTextLayerId: null });
  },

  openLayerStyleDialog: (layerId): void => {
    set({ layerStyleDialog: { layerId } });
  },

  closeLayerStyleDialog: (): void => {
    set({ layerStyleDialog: null });
  },

  // History
  undo: (): void => {
    if (!commandHistory.canUndo) return;
    commandHistory.undo();
    set({
      canUndo: commandHistory.canUndo,
      canRedo: commandHistory.canRedo,
      revision: get().revision + 1,
    });
    eventBus.emit('document:changed');
  },

  redo: (): void => {
    if (!commandHistory.canRedo) return;
    commandHistory.redo();
    set({
      canUndo: commandHistory.canUndo,
      canRedo: commandHistory.canRedo,
      revision: get().revision + 1,
    });
    eventBus.emit('document:changed');
  },

  // Context menu
  showContextMenu: (x, y, layerId): void => set({ contextMenu: { x, y, layerId } }),
  hideContextMenu: (): void => set({ contextMenu: null }),

  // Rendering
  renderToCanvas: (canvas): void => {
    const { document: doc } = get();
    if (!doc) return;
    renderer.render(doc, canvas, {
      viewport,
      renderEffects: true,
      showSelection: false,
      showGuides: false,
      background: 'checkerboard',
    });
  },

  renderLayerThumbnail: (layerId, size): HTMLCanvasElement | null => {
    const { document: doc } = get();
    if (!doc) return null;
    return renderer.renderLayerThumbnail(doc, layerId, { width: size, height: size });
  },

  fitToWindow: (containerWidth, containerHeight): void => {
    const { document: doc } = get();
    if (!doc) return;
    viewport.fitToWindow(
      { width: containerWidth, height: containerHeight },
      doc.canvas.size,
    );
    set({ zoom: viewport.zoom, panOffset: viewport.offset });
  },

  // \u2500\u2500 File operations \u2014 APP-004 \u2500\u2500

  openFile: async (): Promise<void> => {
    const api = getElectronAPI();
    const result = await api.openFile();
    if (!result) return;
    const { filePath, data } = result;
    openPsdFromData(data, filePath, set);
    get().updateTitleBar();
    get().startAutoSave();
  },

  saveFile: async (): Promise<void> => {
    const { document: doc } = get();
    if (!doc) return;

    // Quick-save if we already have a file path
    if (doc.filePath) {
      const api = getElectronAPI();
      const psdData = exportPsd(doc);
      const saved = await api.writeTo(psdData, doc.filePath);
      if (saved) {
        doc.dirty = false;
        doc.modifiedAt = new Date().toISOString();
        set({ statusMessage: `Saved: ${getBaseName(saved)}` });
        get().updateTitleBar();
        // Clear auto-save after successful save
        await api.autoSaveClear(doc.id);
      }
      return;
    }

    await get().saveAsFile();
  },

  saveAsFile: async (): Promise<void> => {
    const { document: doc } = get();
    if (!doc) return;
    const api = getElectronAPI();
    const defaultName = doc.name || 'Untitled';
    const psdData = exportPsd(doc);
    const saved = await api.saveFile(psdData, `${defaultName}.psd`);
    if (saved) {
      doc.filePath = saved;
      doc.dirty = false;
      doc.modifiedAt = new Date().toISOString();
      set({ statusMessage: `Saved: ${getBaseName(saved)}` });
      get().updateTitleBar();
      // Clear auto-save after successful save
      await api.autoSaveClear(doc.id);
    }
  },

  exportAsImage: async (format): Promise<void> => {
    const { document: doc } = get();
    if (!doc) {
      set({ statusMessage: 'No document to export' });
      return;
    }

    try {
      const { width, height } = doc.canvas.size;
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        set({ statusMessage: 'Failed to create export canvas' });
        return;
      }

      // Draw white background for JPEG (no alpha)
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      // Render document at 1:1 scale using the renderer
      renderer.render(doc, offscreen as unknown as HTMLCanvasElement, {
        viewport: { zoom: 1, offset: { x: 0, y: 0 }, visibleArea: { x: 0, y: 0, width, height } },
        renderEffects: true,
        showSelection: false,
        showGuides: false,
        background: format === 'jpeg' ? 'white' : 'checkerboard',
      });

      const blob = await offscreen.convertToBlob({ type: mimeType, quality: 0.92 });
      const arrayBuffer = await blob.arrayBuffer();

      const api = getElectronAPI();
      const ext = format === 'jpeg' ? 'jpg' : format ?? 'png';
      const defaultName = `${doc.name || 'Untitled'}.${ext}`;
      const saved = await api.exportFile(new Uint8Array(arrayBuffer).buffer, defaultName);
      if (saved) {
        set({ statusMessage: `Exported: ${getBaseName(saved)}` });
      }
    } catch {
      set({ statusMessage: 'Export failed' });
    }
  },

  acceptPsdImport: (): void => {
    const { pendingPsdImport } = get();
    if (!pendingPsdImport) return;
    const { document: doc } = pendingPsdImport;
    commandHistory.clear();
    set({
      document: doc,
      pendingPsdImport: null,
      selectedLayerId: null,
      canUndo: false,
      canRedo: false,
      revision: 0,
      statusMessage: `Opened: ${doc.name}`,
    });
    eventBus.emit('document:changed');
    get().updateTitleBar();
    get().startAutoSave();
  },

  cancelPsdImport: (): void => {
    set({ pendingPsdImport: null, statusMessage: 'Import cancelled' });
  },

  loadRecentFiles: async (): Promise<void> => {
    const api = getElectronAPI();
    const files = await api.getRecentFiles();
    set({ recentFiles: files });
  },

  // \u2500\u2500 Auto-save and recovery \u2014 APP-008 \u2500\u2500

  startAutoSave: (): void => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(() => {
      void get().doAutoSave();
    }, AUTO_SAVE_INTERVAL_MS);
  },

  stopAutoSave: (): void => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  },

  doAutoSave: async (): Promise<void> => {
    const { document: doc } = get();
    if (!doc || !doc.dirty) return;
    try {
      const api = getElectronAPI();
      const psdData = exportPsd(doc);
      await api.autoSaveWrite(doc.id, doc.name, doc.filePath, psdData);
      set({ statusMessage: 'Auto-saved' });
    } catch {
      // Silently ignore auto-save failures
    }
  },

  updateTitleBar: (): void => {
    const { document: doc } = get();
    try {
      const api = getElectronAPI();
      if (!doc) {
        void api.setTitle('Photoshop App');
        return;
      }
      const name = doc.filePath ? getBaseName(doc.filePath) : doc.name || 'Untitled';
      const dirtyIndicator = doc.dirty ? '*' : '';
      void api.setTitle(`${dirtyIndicator}${name} \u2014 Photoshop App`);
    } catch {
      // Ignore if electronAPI not available (e.g. in tests)
    }
  },

  checkRecovery: async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      const entries = await api.listRecoveryFiles();
      if (entries.length > 0) {
        set({ recoveryEntries: entries });
      }
    } catch {
      // Ignore
    }
  },

  recoverDocument: async (documentId): Promise<void> => {
    try {
      const api = getElectronAPI();
      const result = await api.readRecoveryFile(documentId);
      if (!result) {
        set({ statusMessage: 'Recovery failed: file not found' });
        return;
      }
      const entry = get().recoveryEntries.find((e) => e.documentId === documentId);
      const name = entry?.documentName ?? 'Recovered';
      const { document: doc, report } = importPsd(new Uint8Array(result.data), name);
      doc.filePath = entry?.filePath ?? null;
      doc.dirty = true; // Mark as dirty since it's recovered, not saved

      commandHistory.clear();
      if (report.issues.length > 0) {
        set({
          pendingPsdImport: { document: doc, report },
          recoveryEntries: [],
        });
      } else {
        set({
          document: doc,
          recoveryEntries: [],
          selectedLayerId: null,
          canUndo: false,
          canRedo: false,
          revision: 0,
          statusMessage: `Recovered: ${name}`,
        });
        eventBus.emit('document:changed');
      }
      // Clear the recovered auto-save file
      await api.autoSaveClear(documentId);
      get().updateTitleBar();
      get().startAutoSave();
    } catch {
      set({ statusMessage: 'Recovery failed' });
    }
  },

  discardRecovery: async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      await api.autoSaveClearAll();
      set({ recoveryEntries: [] });
    } catch {
      set({ recoveryEntries: [] });
    }
  },

  openFileByPath: async (filePath): Promise<void> => {
    try {
      const api = getElectronAPI();
      const result = await api.readFileByPath(filePath);
      if (!result) {
        set({ statusMessage: `Could not read: ${getBaseName(filePath)}` });
        return;
      }
      openPsdFromData(result.data, result.filePath, set);
      get().updateTitleBar();
      get().startAutoSave();
    } catch {
      set({ statusMessage: `Failed to open: ${getBaseName(filePath)}` });
    }
  },

  setDragOverActive: (active): void => {
    set({ dragOverActive: active });
  },

  handleCloseConfirmation: async (action): Promise<void> => {
    const api = getElectronAPI();
    if (action === 'cancel') {
      set({ pendingClose: false });
      api.confirmClose('cancel');
      return;
    }
    if (action === 'save') {
      await get().saveFile();
      set({ pendingClose: false });
      get().stopAutoSave();
      api.confirmClose('save');
      return;
    }
    // discard
    set({ pendingClose: false });
    get().stopAutoSave();
    api.confirmClose('discard');
  },

  setPendingClose: (pending): void => {
    set({ pendingClose: pending });
  },
  // Selection -- APP-015
  setSelection: (rect): void => {
    set({ selection: rect });
    if (rect) {
      set({ statusMessage: `Selection: ${Math.round(rect.width)}×${Math.round(rect.height)}` });
    }
  },

  clearSelection: (): void => {
    set({ selection: null, statusMessage: 'Selection cleared' });
  },

  selectAll: (): void => {
    const { document: doc } = get();
    if (!doc) return;
    const { width, height } = doc.canvas.size;
    set({
      selection: { x: 0, y: 0, width, height },
      statusMessage: `Selected all: ${width}×${height}`,
    });
  },

}));

/** Access the shared event bus (for component subscriptions). */
export function getEventBus(): EventBusImpl {
  return eventBus;
}

/** Access the shared viewport (for coordinate transforms). */
export function getViewport(): ViewportImpl {
  return viewport;
}
