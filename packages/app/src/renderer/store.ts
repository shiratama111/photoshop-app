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
 *
 * All layer mutations go through Commands for undo/redo support.
 *
 * @see https://github.com/pmndrs/zustand
 * @see APP-002: Canvas view + layer panel integration
 * @see APP-004: PSD open/save integration
 */

import { create } from 'zustand';
import type {
  BlendMode,
  Command,
  CompatibilityReport,
  Document,
  Layer,
  LayerGroup,
  RasterLayer,
} from '@photoshop-app/types';
import {
  CommandHistoryImpl,
  EventBusImpl,
  createRasterLayer,
  createLayerGroup,
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

/** Shared singleton instances. */
const commandHistory = new CommandHistoryImpl();
const eventBus = new EventBusImpl();
const viewport = new ViewportImpl();
const renderer = new Canvas2DRenderer();

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
}

function getElectronAPI(): ElectronBridgeAPI {
  return (window as unknown as { electronAPI: ElectronBridgeAPI }).electronAPI;
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
    const ext = getExtension(filePath);

    if (ext === 'psd') {
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
    } else {
      set({ statusMessage: `Unsupported file format: .${ext}` });
    }
  },

  saveFile: async (): Promise<void> => {
    const { document: doc } = get();
    if (!doc) return;
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
  },

  cancelPsdImport: (): void => {
    set({ pendingPsdImport: null, statusMessage: 'Import cancelled' });
  },

  loadRecentFiles: async (): Promise<void> => {
    const api = getElectronAPI();
    const files = await api.getRecentFiles();
    set({ recentFiles: files });
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
