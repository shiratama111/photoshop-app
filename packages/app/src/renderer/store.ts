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
  TextLayer,
} from '@photoshop-app/types';
import type { BrushVariantId } from './brush-engine';
import {
  CommandHistoryImpl,
  EventBusImpl,
  createRasterLayer,
  createLayerGroup,
  createTextLayer,
  findLayerById,
  findParentGroup,
  flattenLayers,
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  SetLayerPropertyCommand,
  ModifyPixelsCommand,
  rotate90CW,
  rotate90CCW,
  rotate180,
  scaleImage,
  flipHorizontal,
  flipVertical,
  cropImage,
} from '@photoshop-app/core';
import { importPsd, exportPsd } from '@photoshop-app/adapter-psd';
import { Canvas2DRenderer, ViewportImpl } from '@photoshop-app/render';
import { t } from './i18n';

/** Active tool in the toolbar. */
export type Tool =
  | 'select'
  | 'move'
  | 'brush'
  | 'eraser'
  | 'text'
  | 'crop'
  | 'segment'
  | 'gradient'
  | 'eyedropper'
  | 'fill'
  | 'shape'
  | 'dodge'
  | 'burn'
  | 'clone';

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

/** Persistent defaults used when creating a new text layer with the Text tool. */
export type TextToolDefaults = Pick<
  TextLayer,
  'fontFamily'
  | 'fontSize'
  | 'color'
  | 'bold'
  | 'italic'
  | 'alignment'
  | 'lineHeight'
  | 'letterSpacing'
  | 'writingMode'
  | 'underline'
  | 'strikethrough'
>;

/** Live transform preview for inline-edited text layer (not yet committed to history). */
export interface TextTransformPreview {
  layerId: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export type CanvasAnchorPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ResizeDocumentOptions {
  mode?: 'image' | 'canvas';
  anchor?: CanvasAnchorPosition;
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

/** Floating-point comparison epsilon for viewport values. */
const VIEWPORT_EPSILON = 1e-4;
const DEFAULT_TEXT_TOOL_DEFAULTS: TextToolDefaults = {
  fontFamily: 'Arial',
  fontSize: 16,
  color: { r: 0, g: 0, b: 0, a: 1 },
  bold: false,
  italic: false,
  alignment: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  writingMode: 'horizontal-tb',
  underline: false,
  strikethrough: false,
};
const TEXT_TOOL_STYLE_KEYS = new Set<keyof TextToolDefaults>([
  'fontFamily',
  'fontSize',
  'color',
  'bold',
  'italic',
  'alignment',
  'lineHeight',
  'letterSpacing',
  'writingMode',
  'underline',
  'strikethrough',
]);
const AUTO_TEXT_LAYER_NAME_PATTERN = /^Text \d+$/;
const MAX_AUTO_TEXT_LAYER_NAME_CHARS = 40;

function deriveAutoTextLayerName(text: string): string | null {
  const collapsed = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!collapsed) return null;

  const chars = [...collapsed];
  if (chars.length <= MAX_AUTO_TEXT_LAYER_NAME_CHARS) {
    return collapsed;
  }
  return `${chars.slice(0, MAX_AUTO_TEXT_LAYER_NAME_CHARS).join('')}...`;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= VIEWPORT_EPSILON;
}

function offsetsEqual(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return nearlyEqual(a.x, b.x) && nearlyEqual(a.y, b.y);
}

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
  /** Live text transform preview bounds while dragging handles. */
  textTransformPreview: TextTransformPreview | null;
  /** Default text style for new layers created by the Text tool. */
  textToolDefaults: TextToolDefaults;
  /** Layer style dialog state (APP-005). */
  layerStyleDialog: { layerId: string } | null;
  /** Recovery entries found on startup (APP-008). */
  recoveryEntries: RecoveryEntry[];
  /** Whether a close confirmation is pending (APP-008). */
  pendingClose: boolean;
  /** Whether a drag-drop hover is active (APP-008). */
  dragOverActive: boolean;
  /** Whether a transform operation is active (APP-012). */
  transformActive: boolean;
  /** Adjustments dialog state: which adjustment is active, or null. */
  adjustmentDialog: {
    type: 'brightness-contrast' | 'hue-saturation' | 'levels' | 'curves' | 'color-balance';
    preview: boolean;
  } | null;
  /** Image size dialog visibility. */
  showImageSizeDialog: boolean;
  /** Canvas size dialog visibility. */
  showCanvasSizeDialog: boolean;
  /** Gradient tool type. */
  gradientType: 'linear' | 'radial' | 'angle' | 'diamond';
  /** Shape tool type. */
  shapeType: 'rectangle' | 'ellipse' | 'line';
  /** Fill tolerance for paint bucket. */
  fillTolerance: number;
  /** Brush size in pixels (APP-014). */
  brushSize: number;
  /** Brush hardness 0-1 (APP-014). */
  brushHardness: number;
  /** Brush opacity 0-1 (APP-014). */
  brushOpacity: number;
  /** Brush color RGBA (APP-014). */
  brushColor: { r: number; g: number; b: number; a: number };
  /** Active brush variant (APP-016). */
  brushVariant: BrushVariantId;
  /** Background color RGBA (APP-016). */
  backgroundColor: { r: number; g: number; b: number; a: number };
  /** Current selection rectangle, or null (APP-015). */
  selection: { x: number; y: number; width: number; height: number } | null;
  /** Selection sub-tool type. */
  selectionSubTool: 'rect' | 'ellipse' | 'wand';
  /** Whether the new document dialog is visible. */
  showNewDocumentDialog: boolean;
  /** History panel entries (descriptions), starting with 'Original'. */
  historyEntries: string[];
  /** Current position in the history entries list. 0 = Original. */
  historyIndex: number;
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
  /** Set layer position in document coordinates. */
  setLayerPosition: (layerId: string, x: number, y: number) => void;
  /** Move a layer to a new index within its parent. */
  reorderLayer: (layerId: string, newIndex: number) => void;

  // Text layer operations \u2014 APP-005
  /** Add a new text layer. */
  addTextLayer: (name?: string, text?: string) => void;
  /** Add a new text layer at a specific document position and start editing (PS-TEXT-003). */
  addTextLayerAt: (x: number, y: number, name?: string) => void;
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
  /** Stop inline editing. If expectedLayerId is provided, stop only when it matches current editor. */
  stopEditingText: (expectedLayerId?: string) => void;
  /** Set or clear live transform preview for inline text editor UI. */
  setTextTransformPreview: (preview: TextTransformPreview | null) => void;
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

  // Export 窶・APP-010
  /** Export the current document as PNG/JPEG/WebP. */
  exportAsImage: (format?: 'png' | 'jpeg' | 'webp') => Promise<void>;

  // Transform — APP-012 / PS-TEXT-006
  /** Resize a layer to new dimensions (undoable for raster layers). */
  resizeLayer: (layerId: string, newWidth: number, newHeight: number) => void;
  /** Resize a text layer: update textBounds + fontSize proportionally (undoable). */
  resizeTextLayer: (layerId: string, newWidth: number, newHeight: number) => void;
  /** Set whether a transform operation is active. */
  setTransformActive: (active: boolean) => void;

  // Brush 窶・APP-014
  /** Set the brush size. */
  setBrushSize: (size: number) => void;
  /** Set the brush opacity. */
  setBrushOpacity: (opacity: number) => void;
  /** Set the brush color. */
  setBrushColor: (color: { r: number; g: number; b: number; a: number }) => void;
  /** Set the brush hardness. */
  setBrushHardness: (hardness: number) => void;
  /** Commit a completed brush stroke (for undo). */
  commitBrushStroke: (layerId: string, region: { x: number; y: number; width: number; height: number }, oldPixels: Uint8ClampedArray, newPixels: Uint8ClampedArray) => void;
  /** Set the active brush variant (APP-016). */
  setBrushVariant: (variant: BrushVariantId) => void;
  /** Set the background color (APP-016). */
  setBackgroundColor: (color: { r: number; g: number; b: number; a: number }) => void;
  /** Swap foreground and background colors (APP-016). */
  swapColors: () => void;
  /** Reset foreground to black, background to white (APP-016). */
  resetColors: () => void;

  // Selection -- APP-015
  /** Set the current selection. */
  setSelection: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Select all (entire document). */
  selectAll: () => void;
  /** Set selection sub-tool (rect, ellipse, wand). */
  setSelectionSubTool: (subTool: AppState['selectionSubTool']) => void;
  /** Crop the document to the current selection. */
  cropToSelection: () => void;

  // New Document Dialog
  /** Open the new document dialog. */
  openNewDocumentDialog: () => void;
  /** Close the new document dialog. */
  closeNewDocumentDialog: () => void;

  // Adjustments 窶・CORE-005 integration
  /** Open an adjustment dialog. */
  openAdjustmentDialog: (type: AppState['adjustmentDialog'] extends null ? never : NonNullable<AppState['adjustmentDialog']>['type']) => void;
  /** Close the adjustment dialog. */
  closeAdjustmentDialog: () => void;
  /** Apply a filter to the active raster layer (undoable). */
  applyFilter: (filterFn: (imageData: ImageData) => ImageData) => void;

  // Image operations 窶・CORE-008 integration
  /** Open the image size dialog. */
  openImageSizeDialog: () => void;
  /** Close the image size dialog. */
  closeImageSizeDialog: () => void;
  /** Resize the document image or canvas, depending on mode. */
  resizeDocument: (newWidth: number, newHeight: number, options?: ResizeDocumentOptions) => void;
  /** Open the canvas size dialog. */
  openCanvasSizeDialog: () => void;
  /** Close the canvas size dialog. */
  closeCanvasSizeDialog: () => void;
  /** Rotate the entire canvas (90CW, 90CCW, 180). */
  rotateCanvas: (direction: '90cw' | '90ccw' | '180') => void;
  /** Flip the entire canvas. */
  flipCanvas: (direction: 'horizontal' | 'vertical') => void;

  // Gradient tool settings
  /** Set the gradient type. */
  setGradientType: (type: AppState['gradientType']) => void;
  /** Set the shape tool type. */
  setShapeType: (type: AppState['shapeType']) => void;
  /** Set the fill tolerance. */
  setFillTolerance: (tolerance: number) => void;
}

/**
 * Execute a command and update undo/redo availability.
 * Bumps the revision counter to trigger React re-renders.
 */
function executeCommand(command: Command, set: (partial: Partial<AppState>) => void): void {
  commandHistory.execute(command);
  const state = useAppStore.getState();
  const history = getHistorySnapshot(state, { appendDescription: command.description });
  set({
    canUndo: commandHistory.canUndo,
    canRedo: commandHistory.canRedo,
    revision: state.revision + 1,
    ...history,
  });
  eventBus.emit('document:changed');
}

function getHistorySnapshot(
  state: Pick<AppState, 'historyEntries' | 'historyIndex'>,
  options?: { appendDescription?: string; indexDelta?: number },
): Pick<AppState, 'historyEntries' | 'historyIndex'> {
  const history = commandHistory as unknown as { entries?: unknown; currentIndex?: unknown };
  if (Array.isArray(history.entries) && typeof history.currentIndex === 'number') {
    return {
      historyEntries: ['Original', ...history.entries],
      historyIndex: history.currentIndex,
    };
  }

  if (options?.appendDescription) {
    const entries = state.historyEntries.slice(0, state.historyIndex + 1);
    entries.push(options.appendDescription);
    return {
      historyEntries: entries,
      historyIndex: entries.length - 1,
    };
  }

  const nextIndex = Math.max(
    0,
    Math.min(
      state.historyEntries.length - 1,
      state.historyIndex + (options?.indexDelta ?? 0),
    ),
  );
  return {
    historyEntries: state.historyEntries,
    historyIndex: nextIndex,
  };
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

const ANCHOR_FACTORS: Record<CanvasAnchorPosition, { x: number; y: number }> = {
  'top-left': { x: 0, y: 0 },
  'top-center': { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  'middle-left': { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  'middle-right': { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  'bottom-center': { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 },
};

function getAnchorFactors(anchor: CanvasAnchorPosition = 'center'): { x: number; y: number } {
  return ANCHOR_FACTORS[anchor] ?? ANCHOR_FACTORS.center;
}

function getLayerSize(layer: Layer): { width: number; height: number } {
  if (layer.type === 'raster') {
    return {
      width: layer.bounds.width,
      height: layer.bounds.height,
    };
  }
  if (layer.type === 'text' && layer.textBounds) {
    return {
      width: layer.textBounds.width,
      height: layer.textBounds.height,
    };
  }
  return { width: 0, height: 0 };
}

function estimateTextLayerBounds(layer: TextLayer): { x: number; y: number; width: number; height: number } {
  const lines = layer.text.split('\n');
  const longestLine = Math.max(...lines.map((line) => line.length));
  const estimatedWidth = longestLine * layer.fontSize * 0.6;
  const estimatedHeight = lines.length * layer.fontSize * layer.lineHeight;
  return {
    x: layer.position.x,
    y: layer.position.y,
    width: Math.max(20, estimatedWidth),
    height: Math.max(20, estimatedHeight),
  };
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
      set({ statusMessage: t('status.failedCreateCanvasContext') });
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
      historyEntries: ['Original'],
      historyIndex: 0,
      statusMessage: `${t('status.opened')}: ${name} (${width} x ${height})`,
    });
    eventBus.emit('document:changed');
  } catch {
    set({ statusMessage: `${t('status.failedOpenImage')}: ${getBaseName(filePath)}` });
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
    set({ statusMessage: `${t('status.unsupportedFileFormat')}: .${ext}` });
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
      historyEntries: ['Original'],
      historyIndex: 0,
      statusMessage: `${t('status.opened')}: ${getBaseName(filePath)}`,
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
  statusMessage: t('status.ready'),
  showAbout: false,
  selectedLayerId: null,
  canUndo: false,
  canRedo: false,
  revision: 0,
  contextMenu: null,
  pendingPsdImport: null,
  recentFiles: [],
  editingTextLayerId: null,
  textTransformPreview: null,
  textToolDefaults: { ...DEFAULT_TEXT_TOOL_DEFAULTS, color: { ...DEFAULT_TEXT_TOOL_DEFAULTS.color } },
  layerStyleDialog: null,
  recoveryEntries: [],
  pendingClose: false,
  dragOverActive: false,
  transformActive: false,
  adjustmentDialog: null,
  showImageSizeDialog: false,
  showCanvasSizeDialog: false,
  gradientType: 'linear',
  shapeType: 'rectangle',
  fillTolerance: 32,
  brushSize: 10,
  brushHardness: 0.8,
  brushOpacity: 1,
  brushColor: { r: 0, g: 0, b: 0, a: 1 },
  brushVariant: 'soft' as BrushVariantId,
  backgroundColor: { r: 255, g: 255, b: 255, a: 1 },
  selection: null,
  selectionSubTool: 'rect',
  showNewDocumentDialog: false,
  historyEntries: ['Original'],
  historyIndex: 0,

  // Basic actions
  setDocument: (doc): void => set({ document: doc }),
  setActiveTool: (tool): void => set({ activeTool: tool }),
  setZoom: (zoom): void => {
    viewport.setZoom(zoom);
    const nextZoom = viewport.zoom;
    const nextOffset = viewport.offset;
    const state = get();
    if (nearlyEqual(state.zoom, nextZoom) && offsetsEqual(state.panOffset, nextOffset)) return;
    set({ zoom: nextZoom, panOffset: nextOffset });
  },
  setPanOffset: (offset): void => {
    viewport.setOffset(offset);
    const nextOffset = viewport.offset;
    const state = get();
    if (offsetsEqual(state.panOffset, nextOffset)) return;
    set({ panOffset: nextOffset });
  },
  setStatusMessage: (msg): void => set({ statusMessage: msg }),
  toggleAbout: (): void => set((s) => ({ showAbout: !s.showAbout })),

  newDocument: (name, width, height): void => {
    commandHistory.clear();
    const bgLayer = createRasterLayer('背景', width, height);
    if (typeof ImageData !== 'undefined') {
      bgLayer.imageData = new ImageData(width, height);
      new Uint32Array(bgLayer.imageData.data.buffer).fill(0xFFFFFFFF);
    }
    bgLayer.bounds = { x: 0, y: 0, width, height };
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
        children: [bgLayer],
        expanded: true,
      },
      selectedLayerId: bgLayer.id,
      filePath: null,
      dirty: false,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    set({
      document: doc,
      selectedLayerId: bgLayer.id,
      canUndo: false,
      canRedo: false,
      revision: 0,
      historyEntries: ['Original'],
      historyIndex: 0,
      statusMessage: `${t('status.created')}: ${name} (${width}x${height})`,
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
    const { width, height } = doc.canvas.size;
    const layer = createRasterLayer(layerName, width, height);
    // Initialize pixel buffer so the brush engine can paint on it.
    // ImageData may not exist in Node.js test environments.
    if (typeof ImageData !== 'undefined') {
      layer.imageData = new ImageData(width, height);
    }
    const cmd = new AddLayerCommand(doc.rootGroup, layer);
    executeCommand(cmd, set);
    set({ selectedLayerId: layer.id, statusMessage: `${t('status.added')}: ${layerName}` });
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
    set({ selectedLayerId: group.id, statusMessage: `${t('status.addedGroup')}: ${groupName}` });
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
    set({ statusMessage: `${t('status.removed')}: ${layer.name}` });
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
    set({ selectedLayerId: cloned.id, statusMessage: `${t('status.duplicated')}: ${layer.name}` });
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

  setLayerPosition: (layerId, x, y): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer) return;

    const next = { x, y };
    if (layer.position.x === next.x && layer.position.y === next.y) return;

    const cmd = new SetLayerPropertyCommand(layer, 'position', next);
    executeCommand(cmd, set);
    doc.dirty = true;
    eventBus.emit('layer:property-changed', { layerId, property: 'position' });
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
    const style = get().textToolDefaults;
    const layer = createTextLayer(layerName, text ?? 'New Text', {
      ...style,
      color: { ...style.color },
    });
    const cmd = new AddLayerCommand(doc.rootGroup, layer);
    executeCommand(cmd, set);
    set({ selectedLayerId: layer.id, statusMessage: `${t('status.added')}: ${layerName}` });
    doc.selectedLayerId = layer.id;
    doc.dirty = true;
    eventBus.emit('layer:added', { layer, parentId: doc.rootGroup.id });
    get().updateTitleBar();
  },

  addTextLayerAt: (x, y, name): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layerName = name ?? `Text ${doc.rootGroup.children.length + 1}`;
    const style = get().textToolDefaults;
    const layer = createTextLayer(layerName, '', {
      ...style,
      color: { ...style.color },
    });
    layer.position = { x, y };
    const cmd = new AddLayerCommand(doc.rootGroup, layer);
    executeCommand(cmd, set);
    set({
      selectedLayerId: layer.id,
      editingTextLayerId: layer.id,
      statusMessage: `${t('status.added')}: ${layerName}`,
    });
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
    const previousName = layer.name;
    const previousText = layer.text;
    const textLayer = layer as Layer & { underline?: boolean; strikethrough?: boolean };
    if (key === 'writingMode' && layer.writingMode === undefined) {
      // Backward compatibility: old documents may lack writingMode.
      layer.writingMode = 'horizontal-tb';
    }
    if (key === 'underline' && textLayer.underline === undefined) {
      // Backward compatibility: old documents may lack underline flag.
      textLayer.underline = false;
    }
    if (key === 'strikethrough' && textLayer.strikethrough === undefined) {
      // Backward compatibility: old documents may lack strikethrough flag.
      textLayer.strikethrough = false;
    }
    const cmd = new SetLayerPropertyCommand(
      layer,
      key as unknown as keyof Layer,
      value as Layer[keyof Layer],
    );
    executeCommand(cmd, set);
    if (get().activeTool === 'text' && TEXT_TOOL_STYLE_KEYS.has(key as keyof TextToolDefaults)) {
      set((state) => ({
        textToolDefaults: {
          ...state.textToolDefaults,
          [key]: key === 'color'
            ? { ...(value as TextToolDefaults['color']) }
            : value as TextToolDefaults[keyof TextToolDefaults],
        },
      }));
    }
    if (key === 'text' && typeof value === 'string') {
      const nextText = value;
      const previousAutoName = deriveAutoTextLayerName(previousText);
      const nextAutoName = deriveAutoTextLayerName(nextText);
      const wasAutoNamed = AUTO_TEXT_LAYER_NAME_PATTERN.test(previousName)
        || (previousAutoName !== null && previousName === previousAutoName);
      if (wasAutoNamed && nextAutoName && layer.name !== nextAutoName) {
        layer.name = nextAutoName;
        eventBus.emit('layer:property-changed', { layerId, property: 'name' });
      }
    }
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

  stopEditingText: (expectedLayerId): void => {
    if (expectedLayerId) {
      const { editingTextLayerId } = get();
      if (editingTextLayerId !== expectedLayerId) return;
    }
    set({ editingTextLayerId: null, textTransformPreview: null });
  },

  setTextTransformPreview: (preview): void => {
    const current = get().textTransformPreview;
    if (
      current?.layerId === preview?.layerId
      && current?.bounds.x === preview?.bounds.x
      && current?.bounds.y === preview?.bounds.y
      && current?.bounds.width === preview?.bounds.width
      && current?.bounds.height === preview?.bounds.height
    ) {
      return;
    }
    set({ textTransformPreview: preview });
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
    const state = get();
    const history = getHistorySnapshot(state, { indexDelta: -1 });
    set({
      canUndo: commandHistory.canUndo,
      canRedo: commandHistory.canRedo,
      revision: state.revision + 1,
      ...history,
    });
    eventBus.emit('document:changed');
  },

  redo: (): void => {
    if (!commandHistory.canRedo) return;
    commandHistory.redo();
    const state = get();
    const history = getHistorySnapshot(state, { indexDelta: 1 });
    set({
      canUndo: commandHistory.canUndo,
      canRedo: commandHistory.canRedo,
      revision: state.revision + 1,
      ...history,
    });
    eventBus.emit('document:changed');
  },

  // Context menu
  showContextMenu: (x, y, layerId): void => set({ contextMenu: { x, y, layerId } }),
  hideContextMenu: (): void => set({ contextMenu: null }),

  // Rendering
  renderToCanvas: (canvas): void => {
    const { document: doc, editingTextLayerId } = get();
    if (!doc) return;
    try {
      renderer.render(doc, canvas, {
        viewport,
        renderEffects: true,
        showSelection: false,
        showGuides: false,
        background: 'checkerboard',
        documentSize: { width: doc.canvas.size.width, height: doc.canvas.size.height },
        hiddenLayerIds: editingTextLayerId ? [editingTextLayerId] : undefined,
      });
    } catch {
      const renderFailedMessage = t('status.renderFailed');
      if (get().statusMessage !== renderFailedMessage) {
        set({ statusMessage: renderFailedMessage });
      }
    }
  },

  renderLayerThumbnail: (layerId, size): HTMLCanvasElement | null => {
    const { document: doc } = get();
    if (!doc) return null;
    return renderer.renderLayerThumbnail(doc, layerId, { width: size, height: size });
  },

  fitToWindow: (containerWidth, containerHeight): void => {
    const { document: doc } = get();
    if (!doc) return;
    const prevZoom = viewport.zoom;
    const prevOffset = viewport.offset;
    viewport.fitToWindow(
      { width: containerWidth, height: containerHeight },
      doc.canvas.size,
    );
    const nextZoom = viewport.zoom;
    const nextOffset = viewport.offset;
    if (nearlyEqual(prevZoom, nextZoom) && offsetsEqual(prevOffset, nextOffset)) return;
    const state = get();
    if (nearlyEqual(state.zoom, nextZoom) && offsetsEqual(state.panOffset, nextOffset)) return;
    set({ zoom: nextZoom, panOffset: nextOffset });
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
        set({ statusMessage: `${t('status.saved')}: ${getBaseName(saved)}` });
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
      set({ statusMessage: `${t('status.saved')}: ${getBaseName(saved)}` });
      get().updateTitleBar();
      // Clear auto-save after successful save
      await api.autoSaveClear(doc.id);
    }
  },

  exportAsImage: async (format): Promise<void> => {
    const { document: doc } = get();
    if (!doc) {
      set({ statusMessage: t('status.noDocumentToExport') });
      return;
    }

    try {
      const { width, height } = doc.canvas.size;
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        set({ statusMessage: t('status.failedCreateExportCanvas') });
        return;
      }

      // Draw white background for JPEG (no alpha)
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      // Render document at 1:1 scale using the renderer
      const exportViewport = new ViewportImpl({ width, height });
      renderer.render(doc, offscreen as unknown as HTMLCanvasElement, {
        viewport: exportViewport,
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
        set({ statusMessage: `${t('status.exported')}: ${getBaseName(saved)}` });
      }
    } catch {
      set({ statusMessage: t('status.exportFailed') });
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
      historyEntries: ['Original'],
      historyIndex: 0,
      statusMessage: `${t('status.opened')}: ${doc.name}`,
    });
    eventBus.emit('document:changed');
    get().updateTitleBar();
    get().startAutoSave();
  },

  cancelPsdImport: (): void => {
    set({ pendingPsdImport: null, statusMessage: t('status.importCancelled') });
  },

  loadRecentFiles: async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      if (!api?.getRecentFiles) {
        set({ recentFiles: [] });
        return;
      }
      const files = await api.getRecentFiles();
      set({ recentFiles: files });
    } catch {
      // Allow running renderer outside Electron (web dev/testing).
      set({ recentFiles: [] });
    }
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
      set({ statusMessage: t('status.autoSaved') });
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
        set({ statusMessage: t('status.recoveryFileNotFound') });
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
          historyEntries: ['Original'],
          historyIndex: 0,
          statusMessage: `${t('status.recovered')}: ${name}`,
        });
        eventBus.emit('document:changed');
      }
      // Clear the recovered auto-save file
      await api.autoSaveClear(documentId);
      get().updateTitleBar();
      get().startAutoSave();
    } catch {
      set({ statusMessage: t('status.recoveryFailed') });
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
        set({ statusMessage: `${t('status.couldNotRead')}: ${getBaseName(filePath)}` });
        return;
      }
      openPsdFromData(result.data, result.filePath, set);
      get().updateTitleBar();
      get().startAutoSave();
    } catch {
      set({ statusMessage: `${t('status.failedOpen')}: ${getBaseName(filePath)}` });
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

  // Transform 窶・APP-012
  resizeLayer: (layerId, newWidth, newHeight): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer || layer.type !== 'raster') return;
    const raster = layer as RasterLayer;
    if (!raster.imageData) return;

    const oldW = raster.bounds.width;
    const oldH = raster.bounds.height;
    if (oldW === newWidth && oldH === newHeight) return;

    // Snapshot old state
    const oldImageData = raster.imageData;

    // Scale using OffscreenCanvas
    try {
      const srcCanvas = new OffscreenCanvas(oldW, oldH);
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) return;
      srcCtx.putImageData(oldImageData, 0, 0);

      const dstCanvas = new OffscreenCanvas(newWidth, newHeight);
      const dstCtx = dstCanvas.getContext('2d');
      if (!dstCtx) return;
      dstCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);

      const newImageData = dstCtx.getImageData(0, 0, newWidth, newHeight);
      const newBounds = { x: 0, y: 0, width: newWidth, height: newHeight };

      // Apply the resize
      raster.imageData = newImageData;
      raster.bounds = newBounds;

      // Create an undoable command with captured old/new state
      const capturedOldImageData = new ImageData(
        new Uint8ClampedArray(oldImageData.data),
        oldW,
        oldH,
      );
      const capturedOldBounds = { x: 0, y: 0, width: oldW, height: oldH };
      const capturedNewImageData = new ImageData(
        new Uint8ClampedArray(newImageData.data),
        newWidth,
        newHeight,
      );
      const capturedNewBounds = { ...newBounds };

      const resizeCmd: Command = {
        description: `Resize "${raster.name}" to ${newWidth} x ${newHeight}`,
        execute(): void {
          raster.imageData = capturedNewImageData;
          raster.bounds = capturedNewBounds;
        },
        undo(): void {
          raster.imageData = capturedOldImageData;
          raster.bounds = capturedOldBounds;
        },
      };

      // Push to history (execute() is idempotent — safe to re-apply)
      commandHistory.execute(resizeCmd);
      const curState = useAppStore.getState();
      const history = getHistorySnapshot(curState, { appendDescription: resizeCmd.description });
      set({
        canUndo: commandHistory.canUndo,
        canRedo: commandHistory.canRedo,
        revision: curState.revision + 1,
        ...history,
      });
      eventBus.emit('document:changed');
      doc.dirty = true;
      set({ statusMessage: `${t('status.resizedLayer')}: ${newWidth} x ${newHeight}` });
      get().updateTitleBar();
    } catch {
      set({ statusMessage: t('status.resizeFailed') });
    }
  },

  // PS-TEXT-006: Resize text layer - update textBounds + fontSize proportionally
  resizeTextLayer: (layerId, newWidth, newHeight): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer || layer.type !== 'text') return;
    const textLayer = layer as TextLayer;

    const targetWidth = Math.max(1, Math.round(newWidth));
    const targetHeight = Math.max(1, Math.round(newHeight));

    // Compute old bounds from textBounds, or estimate from current text metrics.
    const oldBounds = textLayer.textBounds ?? estimateTextLayerBounds(textLayer);

    const oldW = oldBounds.width;
    const oldH = oldBounds.height;
    if (oldW === targetWidth && oldH === targetHeight) return;

    const scaleX = targetWidth / oldW;
    const scaleY = targetHeight / oldH;
    // Geometric mean keeps area-consistent scaling under non-uniform resize.
    const scaleFactor = Math.sqrt(scaleX * scaleY);

    const oldFontSize = textLayer.fontSize;
    const newFontSize = Math.max(1, Math.round(oldFontSize * scaleFactor));
    const newTextBounds = {
      x: textLayer.position.x,
      y: textLayer.position.y,
      width: targetWidth,
      height: targetHeight,
    };
    const oldTextBounds = textLayer.textBounds ? { ...textLayer.textBounds } : null;

    // Apply changes
    textLayer.fontSize = newFontSize;
    textLayer.textBounds = newTextBounds;

    // Undoable command (batch: fontSize + textBounds)
    const cmd: Command = {
      description: `Resize text "${textLayer.name}" to ${targetWidth} x ${targetHeight}`,
      execute(): void {
        textLayer.fontSize = newFontSize;
        textLayer.textBounds = newTextBounds;
      },
      undo(): void {
        textLayer.fontSize = oldFontSize;
        textLayer.textBounds = oldTextBounds;
      },
    };

    commandHistory.execute(cmd);
    const curState = useAppStore.getState();
    const history = getHistorySnapshot(curState, { appendDescription: cmd.description });
    set({
      canUndo: commandHistory.canUndo,
      canRedo: commandHistory.canRedo,
      revision: curState.revision + 1,
      ...history,
    });
    eventBus.emit('document:changed');
    eventBus.emit('layer:property-changed', { layerId, property: 'fontSize' });
    eventBus.emit('layer:property-changed', { layerId, property: 'textBounds' });
    doc.dirty = true;
    set({ statusMessage: `${t('status.resizedLayer')}: ${targetWidth} x ${targetHeight}` });
    get().updateTitleBar();
  },

  setTransformActive: (active): void => {
    set({ transformActive: active });
  },

  // Brush 窶・APP-014
  setBrushSize: (size): void => {
    set({ brushSize: Math.max(1, Math.min(500, size)) });
  },
  setBrushOpacity: (opacity): void => {
    set({ brushOpacity: Math.max(0, Math.min(1, opacity)) });
  },
  setBrushColor: (color): void => {
    set({ brushColor: color });
  },
  setBrushHardness: (hardness): void => {
    set({ brushHardness: Math.max(0, Math.min(1, hardness)) });
  },
  commitBrushStroke: (layerId, region, oldPixels, newPixels): void => {
    const { document: doc } = get();
    if (!doc) return;
    const layer = findLayerById(doc.rootGroup, layerId);
    if (!layer || layer.type !== 'raster') return;
    const cmd = new ModifyPixelsCommand(layer as RasterLayer, region, oldPixels, newPixels);
    executeCommand(cmd, set);
    doc.dirty = true;
    get().updateTitleBar();
  },
  setBrushVariant: (variant): void => {
    set({ brushVariant: variant });
  },
  setBackgroundColor: (color): void => {
    set({ backgroundColor: color });
  },
  swapColors: (): void => {
    const { brushColor, backgroundColor } = get();
    set({ brushColor: { ...backgroundColor }, backgroundColor: { ...brushColor } });
  },
  resetColors: (): void => {
    set({
      brushColor: { r: 0, g: 0, b: 0, a: 1 },
      backgroundColor: { r: 255, g: 255, b: 255, a: 1 },
    });
  },

  // Selection -- APP-015
  setSelection: (rect): void => {
    set({ selection: rect });
    if (rect) {
      set({ statusMessage: `${t('status.selection')}: ${Math.round(rect.width)} x ${Math.round(rect.height)}` });
    }
  },

  clearSelection: (): void => {
    set({ selection: null, statusMessage: t('status.selectionCleared') });
  },

  selectAll: (): void => {
    const { document: doc } = get();
    if (!doc) return;
    const { width, height } = doc.canvas.size;
    set({
      selection: { x: 0, y: 0, width, height },
      statusMessage: `${t('status.selectedAll')}: ${width} x ${height}`,
    });
  },

  setSelectionSubTool: (subTool): void => {
    set({ selectionSubTool: subTool });
  },

  cropToSelection: (): void => {
    const { document: doc, selection } = get();
    if (!doc || !selection) {
      set({ statusMessage: t('status.noSelectionToCrop') });
      return;
    }
    const sx = Math.max(0, Math.round(selection.x));
    const sy = Math.max(0, Math.round(selection.y));
    const sw = Math.round(selection.width);
    const sh = Math.round(selection.height);
    if (sw < 1 || sh < 1) return;

    const allLayers = flattenLayers(doc.rootGroup);
    for (const layer of allLayers) {
      if (layer.type === 'raster') {
        const raster = layer as RasterLayer;
        if (!raster.imageData) continue;
        const cropped = cropImage(
          raster.imageData,
          sx - raster.position.x,
          sy - raster.position.y,
          sw,
          sh,
        );
        raster.imageData = cropped;
        raster.bounds = { x: 0, y: 0, width: sw, height: sh };
        raster.position = { x: sx, y: sy };
      }
    }
    doc.canvas.size = { width: sw, height: sh };
    set({
      selection: null,
      statusMessage: `${t('status.cropped')}: ${sw} x ${sh}`,
      revision: get().revision + 1,
    });
    doc.dirty = true;
    get().updateTitleBar();
  },

  // New Document Dialog
  openNewDocumentDialog: (): void => {
    set({ showNewDocumentDialog: true });
  },

  closeNewDocumentDialog: (): void => {
    set({ showNewDocumentDialog: false });
  },

  // Adjustments 窶・CORE-005 integration
  openAdjustmentDialog: (type): void => {
    set({ adjustmentDialog: { type, preview: true } });
  },

  closeAdjustmentDialog: (): void => {
    set({ adjustmentDialog: null });
  },

  applyFilter: (filterFn): void => {
    const { document: doc, selectedLayerId } = get();
    if (!doc || !selectedLayerId) {
      set({ statusMessage: t('status.selectRasterLayerFirst') });
      return;
    }
    const layer = findLayerById(doc.rootGroup, selectedLayerId);
    if (!layer || layer.type !== 'raster') {
      set({ statusMessage: t('status.filterRasterOnly') });
      return;
    }
    const raster = layer as RasterLayer;
    if (!raster.imageData) return;

    const oldData = new Uint8ClampedArray(raster.imageData.data);
    const result = filterFn(raster.imageData);
    const newData = new Uint8ClampedArray(result.data);

    raster.imageData = result;

    const cmd = new ModifyPixelsCommand(
      raster,
      { x: 0, y: 0, width: raster.bounds.width, height: raster.bounds.height },
      oldData,
      newData,
    );
    executeCommand(cmd, set);
    doc.dirty = true;
    set({ statusMessage: t('status.filterApplied') });
    get().updateTitleBar();
  },

  // Image operations 窶・CORE-008 integration
  openImageSizeDialog: (): void => {
    set({ showImageSizeDialog: true });
  },

  closeImageSizeDialog: (): void => {
    set({ showImageSizeDialog: false });
  },

  resizeDocument: (newWidth, newHeight, options): void => {
    const { document: doc, selection } = get();
    if (!doc) return;
    if (newWidth < 1 || newHeight < 1 || newWidth > 16384 || newHeight > 16384) {
      set({ statusMessage: t('status.invalidDocumentSize') });
      return;
    }

    const oldWidth = doc.canvas.size.width;
    const oldHeight = doc.canvas.size.height;
    if (oldWidth === newWidth && oldHeight === newHeight) return;

    const mode = options?.mode ?? 'image';
    let nextSelection = selection;

    if (mode === 'canvas') {
      const { x: anchorX, y: anchorY } = getAnchorFactors(options?.anchor ?? 'center');
      const offsetX = Math.round((newWidth - oldWidth) * anchorX);
      const offsetY = Math.round((newHeight - oldHeight) * anchorY);

      for (const layer of flattenLayers(doc.rootGroup)) {
        if (layer.type === 'group') continue;
        layer.position = {
          x: layer.position.x + offsetX,
          y: layer.position.y + offsetY,
        };
      }

      if (nextSelection) {
        nextSelection = {
          ...nextSelection,
          x: nextSelection.x + offsetX,
          y: nextSelection.y + offsetY,
        };
      }
    } else {
      const scaleX = newWidth / oldWidth;
      const scaleY = newHeight / oldHeight;

      for (const layer of flattenLayers(doc.rootGroup)) {
        if (layer.type === 'group') continue;

        layer.position = {
          x: Math.round(layer.position.x * scaleX),
          y: Math.round(layer.position.y * scaleY),
        };

        if (layer.type === 'raster') {
          const raster = layer as RasterLayer;
          const targetWidth = Math.max(1, Math.round(raster.bounds.width * scaleX));
          const targetHeight = Math.max(1, Math.round(raster.bounds.height * scaleY));
          if (raster.imageData) {
            raster.imageData = scaleImage(raster.imageData, targetWidth, targetHeight);
          }
          raster.bounds = {
            ...raster.bounds,
            width: targetWidth,
            height: targetHeight,
          };
          continue;
        }

        if (layer.type === 'text') {
          layer.fontSize = Math.max(1, Math.round(layer.fontSize * ((scaleX + scaleY) / 2)));
          if (layer.textBounds) {
            layer.textBounds = {
              ...layer.textBounds,
              width: Math.max(1, Math.round(layer.textBounds.width * scaleX)),
              height: Math.max(1, Math.round(layer.textBounds.height * scaleY)),
            };
          }
        }
      }

      if (nextSelection) {
        nextSelection = {
          x: Math.round(nextSelection.x * scaleX),
          y: Math.round(nextSelection.y * scaleY),
          width: Math.max(1, Math.round(nextSelection.width * scaleX)),
          height: Math.max(1, Math.round(nextSelection.height * scaleY)),
        };
      }
    }

    doc.canvas.size = { width: newWidth, height: newHeight };
    doc.dirty = true;
    set({
      selection: nextSelection,
      revision: get().revision + 1,
      statusMessage: mode === 'canvas'
        ? `${t('status.canvasResized')}: ${newWidth} x ${newHeight}`
        : `${t('status.imageResized')}: ${newWidth} x ${newHeight}`,
    });
    eventBus.emit('document:changed');
    get().updateTitleBar();
  },

  openCanvasSizeDialog: (): void => {
    set({ showCanvasSizeDialog: true });
  },

  closeCanvasSizeDialog: (): void => {
    set({ showCanvasSizeDialog: false });
  },

  rotateCanvas: (direction): void => {
    const { document: doc, selection } = get();
    if (!doc) return;

    const oldWidth = doc.canvas.size.width;
    const oldHeight = doc.canvas.size.height;
    let nextSelection = selection;

    for (const layer of flattenLayers(doc.rootGroup)) {
      if (layer.type === 'group') continue;

      const { width: layerWidth, height: layerHeight } = getLayerSize(layer);
      const x = layer.position.x;
      const y = layer.position.y;

      if (direction === '180') {
        layer.position = {
          x: oldWidth - (x + layerWidth),
          y: oldHeight - (y + layerHeight),
        };
      } else if (direction === '90cw') {
        layer.position = {
          x: oldHeight - (y + layerHeight),
          y: x,
        };
      } else {
        layer.position = {
          x: y,
          y: oldWidth - (x + layerWidth),
        };
      }

      if (layer.type === 'raster') {
        const raster = layer as RasterLayer;
        if (raster.imageData) {
          if (direction === '180') {
            raster.imageData = rotate180(raster.imageData);
          } else if (direction === '90cw') {
            raster.imageData = rotate90CW(raster.imageData);
          } else {
            raster.imageData = rotate90CCW(raster.imageData);
          }
        }

        if (direction !== '180') {
          raster.bounds = {
            ...raster.bounds,
            width: raster.bounds.height,
            height: raster.bounds.width,
          };
        }
      } else if (layer.type === 'text' && layer.textBounds && direction !== '180') {
        layer.textBounds = {
          ...layer.textBounds,
          width: layer.textBounds.height,
          height: layer.textBounds.width,
        };
      }
    }

    if (direction !== '180') {
      doc.canvas.size = {
        width: oldHeight,
        height: oldWidth,
      };
    }

    if (nextSelection) {
      if (direction === '180') {
        nextSelection = {
          x: oldWidth - (nextSelection.x + nextSelection.width),
          y: oldHeight - (nextSelection.y + nextSelection.height),
          width: nextSelection.width,
          height: nextSelection.height,
        };
      } else if (direction === '90cw') {
        nextSelection = {
          x: oldHeight - (nextSelection.y + nextSelection.height),
          y: nextSelection.x,
          width: nextSelection.height,
          height: nextSelection.width,
        };
      } else {
        nextSelection = {
          x: nextSelection.y,
          y: oldWidth - (nextSelection.x + nextSelection.width),
          width: nextSelection.height,
          height: nextSelection.width,
        };
      }
    }

    doc.dirty = true;
    set({
      selection: nextSelection,
      revision: get().revision + 1,
      statusMessage: `${t('status.canvasRotated')}: ${direction}`,
    });
    eventBus.emit('document:changed');
    get().updateTitleBar();
  },

  flipCanvas: (direction): void => {
    const { document: doc, selection } = get();
    if (!doc) return;

    const { width: canvasWidth, height: canvasHeight } = doc.canvas.size;
    let nextSelection = selection;

    for (const layer of flattenLayers(doc.rootGroup)) {
      if (layer.type === 'group') continue;

      const { width: layerWidth, height: layerHeight } = getLayerSize(layer);
      if (direction === 'horizontal') {
        layer.position = {
          x: canvasWidth - (layer.position.x + layerWidth),
          y: layer.position.y,
        };
      } else {
        layer.position = {
          x: layer.position.x,
          y: canvasHeight - (layer.position.y + layerHeight),
        };
      }

      if (layer.type === 'raster') {
        const raster = layer as RasterLayer;
        if (raster.imageData) {
          raster.imageData = direction === 'horizontal'
            ? flipHorizontal(raster.imageData)
            : flipVertical(raster.imageData);
        }
      }
    }

    if (nextSelection) {
      if (direction === 'horizontal') {
        nextSelection = {
          ...nextSelection,
          x: canvasWidth - (nextSelection.x + nextSelection.width),
        };
      } else {
        nextSelection = {
          ...nextSelection,
          y: canvasHeight - (nextSelection.y + nextSelection.height),
        };
      }
    }

    doc.dirty = true;
    set({
      selection: nextSelection,
      revision: get().revision + 1,
      statusMessage: `${t('status.canvasFlipped')}: ${direction}`,
    });
    eventBus.emit('document:changed');
    get().updateTitleBar();
  },

  // Tool settings
  setGradientType: (type): void => {
    set({ gradientType: type });
  },

  setShapeType: (type): void => {
    set({ shapeType: type });
  },

  setFillTolerance: (tolerance): void => {
    set({ fillTolerance: Math.max(0, Math.min(255, tolerance)) });
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


