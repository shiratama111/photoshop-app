/**
 * @module App
 * Root React component with CSS Grid layout.
 *
 * Layout (4 zones):
 * +----------------------------+
 * |        Toolbar             |
 * +------+---------------------+
 * | Side |                     |
 * | bar  |   Canvas Area       |
 * |      |                     |
 * +------+---------------------+
 * |       Status Bar           |
 * +----------------------------+
 *
 * Keyboard shortcuts:
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Delete/Backspace: Remove selected layer
 * - V/M/B/E/T/C/W: Tool shortcuts
 *
 * @see APP-002: Canvas view + layer panel integration
 * @see APP-008: Drag-drop file open, close confirmation, recovery dialog
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore, getViewport } from './store';
import type { Tool } from './store';
import type { EditorAction } from './editor-actions/types';
import { t } from './i18n';
import {
  invert as invertFilter,
  desaturate as desaturateFilter,
  grayscale as grayscaleFilter,
  sepia as sepiaFilter,
  sharpen as sharpenFilter,
  gaussianBlur as gaussianBlurFilter,
  motionBlur as motionBlurFilter,
  addNoise as addNoiseFilter,
  reduceNoise as reduceNoiseFilter,
  posterize as posterizeFilter,
  threshold as thresholdFilter,
} from '@photoshop-app/core';
import { CanvasView } from './components/canvas/CanvasView';
import { LayerPanel } from './components/panels/LayerPanel';
import { LayerContextMenu } from './components/panels/LayerContextMenu';
import { PsdDialog } from './components/dialogs/PsdDialog';
import { LayerStyleDialog } from './components/dialogs/LayerStyleDialog';
import { RecoveryDialog } from './components/dialogs/RecoveryDialog';
import { CloseConfirmDialog } from './components/dialogs/CloseConfirmDialog';
import { AboutDialog } from './components/dialogs/AboutDialog';
import { NewDocumentDialog } from './components/dialogs/NewDocumentDialog';
import { AssetBrowser } from './components/panels/AssetBrowser';
import { BrushOptionsPanel } from './components/panels/BrushOptionsPanel';
import { ColorPalette } from './components/panels/ColorPalette';
import { HistoryPanel } from './components/panels/HistoryPanel';
import { AdjustmentsDialog } from './components/dialogs/AdjustmentsDialog';
import { ImageSizeDialog } from './components/dialogs/ImageSizeDialog';
import { CanvasSizeDialog } from './components/dialogs/CanvasSizeDialog';
import { TextPropertiesPanel, InlineTextEditor } from './components/text-editor';
import { TemplateDialog } from './components/dialogs/TemplateDialog';
import { BackgroundDialog } from './components/dialogs/BackgroundDialog';
import { PatternDialog } from './components/dialogs/PatternDialog';
import { BorderDialog } from './components/dialogs/BorderDialog';
import { GradientMaskDialog } from './components/dialogs/GradientMaskDialog';
import { useCutoutStore } from './components/tools/cutout-store';

type Unsubscribe = () => void;

interface ElectronMenuAPI {
  onMenuNew?: (callback: () => void) => Unsubscribe | void;
  onMenuOpen?: (callback: () => void) => Unsubscribe | void;
  onMenuSave?: (callback: () => void) => Unsubscribe | void;
  onMenuSaveAs?: (callback: () => void) => Unsubscribe | void;
  onMenuExport?: (callback: () => void) => Unsubscribe | void;
  onMenuUndo?: (callback: () => void) => Unsubscribe | void;
  onMenuRedo?: (callback: () => void) => Unsubscribe | void;
  onMenuZoomIn?: (callback: () => void) => Unsubscribe | void;
  onMenuZoomOut?: (callback: () => void) => Unsubscribe | void;
  onMenuFitToWindow?: (callback: () => void) => Unsubscribe | void;
  onMenuActualSize?: (callback: () => void) => Unsubscribe | void;
  onMenuAbout?: (callback: () => void) => Unsubscribe | void;
  onBeforeClose?: (callback: () => void) => Unsubscribe | void;
  confirmClose?: (action: 'save' | 'discard' | 'cancel') => void;
  // Image/Filter menu events
  onMenuAdjustment?: (callback: (type: string) => void) => Unsubscribe | void;
  onMenuFilter?: (callback: (type: string) => void) => Unsubscribe | void;
  onMenuImageSize?: (callback: () => void) => Unsubscribe | void;
  onMenuCanvasSize?: (callback: () => void) => Unsubscribe | void;
  onMenuRotateCanvas?: (callback: (direction: string) => void) => Unsubscribe | void;
  onMenuFlipCanvas?: (callback: (direction: string) => void) => Unsubscribe | void;
  onMenuFill?: (callback: () => void) => Unsubscribe | void;
  onMenuSelectAll?: (callback: () => void) => Unsubscribe | void;
  onMenuDeselect?: (callback: () => void) => Unsubscribe | void;
  onMenuCrop?: (callback: () => void) => Unsubscribe | void;
  // Phase 1
  onMenuPlaceImage?: (callback: () => void) => Unsubscribe | void;
  onMenuSaveTemplate?: (callback: () => void) => Unsubscribe | void;
  onMenuLoadTemplate?: (callback: () => void) => Unsubscribe | void;
  openPlaceImageDialog?: () => Promise<{ filePath: string; data: ArrayBuffer } | null>;
  // Phase 1-3/1-4
  onMenuInsertBackground?: (callback: () => void) => Unsubscribe | void;
  onMenuInsertPattern?: (callback: () => void) => Unsubscribe | void;
  onMenuInsertBorder?: (callback: () => void) => Unsubscribe | void;
  onMenuGradientMask?: (callback: () => void) => Unsubscribe | void;
}

let startupChecksInitialized = false;

/** Available tools with display labels. */
const TOOLS: Array<{ id: Tool; labelKey: string; shortcut: string }> = [
  { id: 'select', labelKey: 'toolbar.select', shortcut: 'V' },
  { id: 'move', labelKey: 'toolbar.move', shortcut: 'M' },
  { id: 'brush', labelKey: 'toolbar.brush', shortcut: 'B' },
  { id: 'eraser', labelKey: 'toolbar.eraser', shortcut: 'E' },
  { id: 'gradient', labelKey: 'toolbar.gradient', shortcut: 'G' },
  { id: 'fill', labelKey: 'toolbar.fill', shortcut: 'K' },
  { id: 'eyedropper', labelKey: 'toolbar.eyedropper', shortcut: 'I' },
  { id: 'clone', labelKey: 'toolbar.clone', shortcut: 'S' },
  { id: 'dodge', labelKey: 'toolbar.dodge', shortcut: 'O' },
  { id: 'shape', labelKey: 'toolbar.shape', shortcut: 'U' },
  { id: 'text', labelKey: 'toolbar.text', shortcut: 'T' },
  { id: 'crop', labelKey: 'toolbar.crop', shortcut: 'C' },
  { id: 'segment', labelKey: 'toolbar.segment', shortcut: 'W' },
];

/** Tool shortcut key map. */
const TOOL_SHORTCUTS: Record<string, Tool> = {};
for (const tool of TOOLS) {
  TOOL_SHORTCUTS[tool.shortcut.toLowerCase()] = tool.id;
}

/** Supported file extensions for drag-drop. */
const SUPPORTED_EXTENSIONS = new Set(['psd', 'png', 'jpg', 'jpeg', 'webp']);

/** Check if a file path has a supported extension. */
function isSupportedFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return false;
  return SUPPORTED_EXTENSIONS.has(filePath.slice(dot + 1).toLowerCase());
}

/** Toolbar component \u2014 top horizontal bar. */
function Toolbar(): React.JSX.Element {
  const { activeTool, setActiveTool } = useAppStore();

  return (
    <div className="toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`toolbar-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={(): void => setActiveTool(tool.id)}
          title={`${t(tool.labelKey)} (${tool.shortcut})`}
        >
          {t(tool.labelKey)}
        </button>
      ))}
    </div>
  );
}

/** Status bar \u2014 bottom information bar. */
function StatusBar(): React.JSX.Element {
  const { document, zoom, statusMessage, canUndo, canRedo, setZoom, setPanOffset, fitToWindow } = useAppStore();

  const handleZoomIn = useCallback((): void => {
    const viewport = getViewport();
    const el = window.document.querySelector('.canvas-area');
    const cx = el ? el.clientWidth / 2 : 0;
    const cy = el ? el.clientHeight / 2 : 0;
    viewport.setZoom(zoom * 1.2, { x: cx, y: cy });
    setZoom(viewport.zoom);
    setPanOffset(viewport.offset);
  }, [zoom, setZoom, setPanOffset]);

  const handleZoomOut = useCallback((): void => {
    const viewport = getViewport();
    const el = window.document.querySelector('.canvas-area');
    const cx = el ? el.clientWidth / 2 : 0;
    const cy = el ? el.clientHeight / 2 : 0;
    viewport.setZoom(zoom / 1.2, { x: cx, y: cy });
    setZoom(viewport.zoom);
    setPanOffset(viewport.offset);
  }, [zoom, setZoom, setPanOffset]);

  const handleFitToWindow = useCallback((): void => {
    const el = window.document.querySelector('.canvas-area');
    if (!el) return;
    fitToWindow(el.clientWidth, el.clientHeight);
  }, [fitToWindow]);

  const handleZoomToActual = useCallback((): void => {
    const viewport = getViewport();
    const el = window.document.querySelector('.canvas-area');
    if (!el || !document) return;
    viewport.zoomToActual(
      { width: el.clientWidth, height: el.clientHeight },
      document.canvas.size,
    );
    setZoom(viewport.zoom);
    setPanOffset(viewport.offset);
  }, [document, setZoom, setPanOffset]);

  return (
    <div className="statusbar">
      <span className="status-message">{statusMessage}</span>
      <span className="status-right">
        {canUndo && <span className="status-hint">{t('statusbar.undoHint')}</span>}
        {canRedo && <span className="status-hint">{t('statusbar.redoHint')}</span>}
        {document && (
          <>
            <span className="status-sep">|</span>
            <span>
              {document.canvas.size.width} x {document.canvas.size.height}
            </span>
          </>
        )}
        <span className="status-sep">|</span>
        <span className="zoom-controls">
          <button onClick={handleFitToWindow} disabled={!document} title={t('statusbar.fitTitle')}>{t('statusbar.fit')}</button>
          <button onClick={handleZoomToActual} disabled={!document} title={t('statusbar.actualSizeTitle')}>100%</button>
          <button onClick={handleZoomOut} disabled={!document} title={t('statusbar.zoomOutTitle')}>&minus;</button>
          <span className="zoom-percentage">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} disabled={!document} title={t('statusbar.zoomInTitle')}>+</button>
        </span>
      </span>
    </div>
  );
}

/** Active sidebar panel \u2014 APP-007. */
type SidebarPanel = 'layers' | 'assets';

/** Sidebar wrapper with Layers / Assets tabs \u2014 APP-007. */
function SidebarWrapper(): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<SidebarPanel>('layers');

  return (
    <div className="sidebar-wrapper">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activePanel === 'layers' ? 'sidebar-tab--active' : ''}`}
          onClick={(): void => setActivePanel('layers')}
        >
          {t('sidebar.layers')}
        </button>
        <button
          className={`sidebar-tab ${activePanel === 'assets' ? 'sidebar-tab--active' : ''}`}
          onClick={(): void => setActivePanel('assets')}
        >
          {t('sidebar.assets')}
        </button>
      </div>
      <div className="sidebar-content">
        {activePanel === 'layers' ? (
          <>
            <LayerPanel />
            <TextPropertiesPanel />
            <HistoryPanel />
          </>
        ) : (
          <AssetBrowser />
        )}
        <ColorPalette />
      </div>
    </div>
  );
}

/** Root App component with CSS Grid layout. */
export function App(): React.JSX.Element {
  const document = useAppStore((s) => s.document);
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const hideContextMenu = useAppStore((s) => s.hideContextMenu);
  const showAbout = useAppStore((s) => s.showAbout);
  const toggleAbout = useAppStore((s) => s.toggleAbout);
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);
  const layerStyleDialog = useAppStore((s) => s.layerStyleDialog);
  const stopEditingText = useAppStore((s) => s.stopEditingText);
  const dragOverActive = useAppStore((s) => s.dragOverActive);
  const setDragOverActive = useAppStore((s) => s.setDragOverActive);
  const openFileByPath = useAppStore((s) => s.openFileByPath);
  const cutout = useCutoutStore((s) => s.cutout);
  const startCutout = useCutoutStore((s) => s.startCutout);

  /** Global keyboard shortcut handler. */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      const editingLayerId = useAppStore.getState().editingTextLayerId;
      if (editingLayerId) {
        // While inline text editing is active, never run global shortcuts.
        if (e.key === 'Escape') {
          e.preventDefault();
          stopEditingText(editingLayerId);
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+N 窶・New Document dialog
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        useAppStore.getState().openNewDocumentDialog();
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        e.preventDefault();
        removeLayer(selectedLayerId);
        return;
      }

      if (e.key === 'Escape') {
        if (useCutoutStore.getState().cutout) {
          useCutoutStore.getState().cancelCutout();
          return;
        }
        if (showAbout) {
          toggleAbout();
          return;
        }
        if (useAppStore.getState().editingTextLayerId) {
          stopEditingText();
        } else {
          hideContextMenu();
        }
        return;
      }

      // Ctrl+A 窶・Select all (APP-015)
      if (e.ctrlKey && !e.shiftKey && e.key === 'a') {
        e.preventDefault();
        useAppStore.getState().selectAll();
        return;
      }

      // Ctrl+D 窶・Deselect (APP-015)
      if (e.ctrlKey && !e.shiftKey && e.key === 'd') {
        e.preventDefault();
        useAppStore.getState().clearSelection();
        return;
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          setActiveTool(tool);
        }

        // [ / ] 窶・Brush size adjustment (APP-014)
        if (e.key === '[') {
          e.preventDefault();
          const s = useAppStore.getState();
          s.setBrushSize(Math.max(1, s.brushSize - (s.brushSize > 20 ? 10 : 2)));
        }
        if (e.key === ']') {
          e.preventDefault();
          const s = useAppStore.getState();
          s.setBrushSize(Math.min(500, s.brushSize + (s.brushSize >= 20 ? 10 : 2)));
        }

        // X 窶・Swap foreground/background colors (APP-016)
        if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          useAppStore.getState().swapColors();
        }

        // D 窶・Reset foreground/background to default (APP-016)
        if (e.key === 'd') {
          e.preventDefault();
          useAppStore.getState().resetColors();
        }
      }
    },
    [
      undo,
      redo,
      removeLayer,
      selectedLayerId,
      setActiveTool,
      hideContextMenu,
      showAbout,
      toggleAbout,
      stopEditingText,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-start cutout session when the segment tool is selected.
  useEffect(() => {
    if (activeTool !== 'segment' || cutout) return;
    startCutout();
  }, [activeTool, cutout, selectedLayerId, document?.id, startCutout]);

  // Wire Electron menu events to store actions \u2014 APP-004
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronMenuAPI }).electronAPI;
    if (!api) return;

    const getCanvasArea = (): HTMLElement | null => {
      const el = window.document.querySelector('.canvas-area');
      return el instanceof HTMLElement ? el : null;
    };

    const unsubs: Unsubscribe[] = [];
    const register = (
      subscribe: ((callback: () => void) => Unsubscribe | void) | undefined,
      callback: () => void,
    ): void => {
      const unsub = subscribe?.(callback);
      if (typeof unsub === 'function') {
        unsubs.push(unsub);
      }
    };

    register(api.onMenuNew, () => useAppStore.getState().openNewDocumentDialog());
    register(api.onMenuOpen, () => void useAppStore.getState().openFile());
    register(api.onMenuSave, () => void useAppStore.getState().saveFile());
    register(api.onMenuSaveAs, () => void useAppStore.getState().saveAsFile());
    register(api.onMenuExport, () => void useAppStore.getState().exportAsImage());
    register(api.onMenuUndo, () => useAppStore.getState().undo());
    register(api.onMenuRedo, () => useAppStore.getState().redo());
    register(api.onMenuZoomIn, () => {
      const state = useAppStore.getState();
      if (!state.document) return;
      const area = getCanvasArea();
      const anchor = {
        x: area ? area.clientWidth / 2 : 0,
        y: area ? area.clientHeight / 2 : 0,
      };
      const vp = getViewport();
      vp.setZoom(vp.zoom * 1.2, anchor);
      state.setZoom(vp.zoom);
      state.setPanOffset(vp.offset);
    });
    register(api.onMenuZoomOut, () => {
      const state = useAppStore.getState();
      if (!state.document) return;
      const area = getCanvasArea();
      const anchor = {
        x: area ? area.clientWidth / 2 : 0,
        y: area ? area.clientHeight / 2 : 0,
      };
      const vp = getViewport();
      vp.setZoom(vp.zoom / 1.2, anchor);
      state.setZoom(vp.zoom);
      state.setPanOffset(vp.offset);
    });
    register(api.onMenuFitToWindow, () => {
      const state = useAppStore.getState();
      const area = getCanvasArea();
      if (!state.document || !area) return;
      state.fitToWindow(area.clientWidth, area.clientHeight);
    });
    register(api.onMenuActualSize, () => {
      const state = useAppStore.getState();
      const area = getCanvasArea();
      if (!state.document || !area) return;
      const vp = getViewport();
      vp.zoomToActual(
        { width: area.clientWidth, height: area.clientHeight },
        state.document.canvas.size,
      );
      state.setZoom(vp.zoom);
      state.setPanOffset(vp.offset);
    });
    register(api.onMenuAbout, () => useAppStore.getState().toggleAbout());

    // Image/Filter menu events
    const registerWithArg = (
      subscribe: ((callback: (arg: string) => void) => Unsubscribe | void) | undefined,
      callback: (arg: string) => void,
    ): void => {
      const unsub = subscribe?.(callback);
      if (typeof unsub === 'function') {
        unsubs.push(unsub);
      }
    };

    registerWithArg(api.onMenuAdjustment, (type) => {
      const s = useAppStore.getState();
      const validTypes = ['brightness-contrast', 'hue-saturation', 'levels', 'curves', 'color-balance'] as const;
      if (validTypes.includes(type as typeof validTypes[number])) {
        s.openAdjustmentDialog(type as typeof validTypes[number]);
      }
    });

    registerWithArg(api.onMenuFilter, (type) => {
      const s = useAppStore.getState();
      // Direct-apply filters (no dialog needed)
      const directFilters: Record<string, () => void> = {
        invert: () => s.applyFilter((img: ImageData) => invertFilter(img)),
        desaturate: () => s.applyFilter((img: ImageData) => desaturateFilter(img)),
        grayscale: () => s.applyFilter((img: ImageData) => grayscaleFilter(img)),
        sepia: () => s.applyFilter((img: ImageData) => sepiaFilter(img)),
        sharpen: () => s.applyFilter((img: ImageData) => sharpenFilter(img, 100)),
        gaussianBlur: () => s.applyFilter((img: ImageData) => gaussianBlurFilter(img, 4)),
        motionBlur: () => s.applyFilter((img: ImageData) => motionBlurFilter(img, 0, 12)),
        addNoise: () => s.applyFilter((img: ImageData) => addNoiseFilter(img, 20, false)),
        reduceNoise: () => s.applyFilter((img: ImageData) => reduceNoiseFilter(img, 2)),
        posterize: () => s.applyFilter((img: ImageData) => posterizeFilter(img, 6)),
        threshold: () => s.applyFilter((img: ImageData) => thresholdFilter(img, 128)),
      };
      if (directFilters[type]) {
        directFilters[type]();
      } else {
        s.setStatusMessage(`${t('status.unsupportedFilter')}: ${type}`);
      }
    });

    register(api.onMenuFill, () => {
      const s = useAppStore.getState();
      s.setActiveTool('fill');
      s.setStatusMessage(t('status.fillToolSelected'));
    });
    register(api.onMenuImageSize, () => useAppStore.getState().openImageSizeDialog());
    register(api.onMenuCanvasSize, () => useAppStore.getState().openCanvasSizeDialog());
    registerWithArg(api.onMenuRotateCanvas, (direction) => {
      useAppStore.getState().rotateCanvas(direction as '90cw' | '90ccw' | '180');
    });
    registerWithArg(api.onMenuFlipCanvas, (direction) => {
      useAppStore.getState().flipCanvas(direction as 'horizontal' | 'vertical');
    });

    register(api.onMenuSelectAll, () => {
      useAppStore.getState().selectAll();
    });
    register(api.onMenuDeselect, () => {
      useAppStore.getState().clearSelection();
    });
    register(api.onMenuCrop, () => {
      useAppStore.getState().cropToSelection();
    });

    // Phase 1: Place Image
    register(api.onMenuPlaceImage, () => {
      const s = useAppStore.getState();
      if (!s.document) return;
      void (async () => {
        const result = await api.openPlaceImageDialog?.();
        if (!result) return;
        const name = result.filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Image';
        void s.addImageAsLayer(result.data, name);
      })();
    });

    // Phase 1: Template menu
    register(api.onMenuSaveTemplate, () => {
      useAppStore.getState().openTemplateSaveDialog();
    });
    register(api.onMenuLoadTemplate, () => {
      useAppStore.getState().openTemplateLoadDialog();
    });

    // Phase 1-3/1-4: Insert menu
    register(api.onMenuInsertBackground, () => {
      useAppStore.getState().openBackgroundDialog();
    });
    register(api.onMenuInsertPattern, () => {
      useAppStore.getState().openPatternDialog();
    });
    register(api.onMenuInsertBorder, () => {
      useAppStore.getState().openBorderDialog();
    });
    register(api.onMenuGradientMask, () => {
      useAppStore.getState().openGradientMaskDialog();
    });

    return (): void => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, []);

  // Check for recovery files on startup \u2014 APP-008
  useEffect(() => {
    if (startupChecksInitialized) return;
    startupChecksInitialized = true;
    void useAppStore.getState().checkRecovery();
    void useAppStore.getState().loadRecentFiles();
  }, []);

  // Listen for close confirmation from main process \u2014 APP-008
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronMenuAPI }).electronAPI;
    if (!api) return;
    const unsubscribe = api.onBeforeClose?.(() => {
      const state = useAppStore.getState();
      if (state.document?.dirty) {
        state.setPendingClose(true);
      } else {
        // No unsaved changes, close immediately
        api.confirmClose?.('discard');
      }
    });

    return (): void => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Phase 2-1/2-2: Register global dispatcher for IPC from main process and DevTools.
  // Uses async dispatch to support getCanvasSnapshot and other async actions.
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    win.__EDITOR_DISPATCH_ACTIONS__ = async (actions: unknown[]): Promise<unknown[]> => {
      const store = useAppStore.getState();
      return store.dispatchEditorActionsAsync(actions as EditorAction[]);
    };
    // Expose store accessor for DevTools console (always returns fresh state+actions)
    Object.defineProperty(window, '__APP_STORE__', {
      get: () => useAppStore.getState(),
      configurable: true,
    });

    return (): void => {
      delete win.__EDITOR_DISPATCH_ACTIONS__;
      delete win.__APP_STORE__;
    };
  }, []);

  // Drag-drop file open \u2014 APP-008
  const handleDragOver = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy';
        if (!dragOverActive) setDragOverActive(true);
      }
    },
    [dragOverActive, setDragOverActive],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      // Only deactivate when leaving the app-layout element itself
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const { clientX, clientY } = e;
      if (
        clientX <= rect.left ||
        clientX >= rect.right ||
        clientY <= rect.top ||
        clientY >= rect.bottom
      ) {
        setDragOverActive(false);
      }
    },
    [setDragOverActive],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverActive(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

      // Open the first supported file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Electron provides the path property on dropped files
        const filePath = (file as unknown as { path: string }).path;
        if (filePath && isSupportedFile(filePath)) {
          const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
          // If document is open and it's an image file, add as layer instead of opening new doc
          if (document && IMAGE_EXTENSIONS.has(ext)) {
            const reader = new FileReader();
            reader.onload = (): void => {
              const buffer = reader.result as ArrayBuffer;
              const name = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Image';
              void useAppStore.getState().addImageAsLayer(buffer, name);
            };
            reader.readAsArrayBuffer(file);
          } else {
            void openFileByPath(filePath);
          }
          return;
        }
      }

      useAppStore.getState().setStatusMessage(t('status.dropUnsupportedFormat'));
    },
    [document, openFileByPath, setDragOverActive],
  );

  return (
    <div
      className="app-layout"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toolbar />
      <BrushOptionsPanel />
      <SidebarWrapper />
      <CanvasView />
      <StatusBar />
      <LayerContextMenu />
      <PsdDialog />
      <RecoveryDialog />
      <CloseConfirmDialog />
      <AboutDialog />
      <NewDocumentDialog />
      <TemplateDialog />
      <AdjustmentsDialog />
      <ImageSizeDialog />
      <CanvasSizeDialog />
      <BackgroundDialog />
      <PatternDialog />
      <BorderDialog />
      <GradientMaskDialog />
      {editingTextLayerId && <InlineTextEditor />}
      {layerStyleDialog && <LayerStyleDialog />}
      {dragOverActive && (
        <div className="drag-overlay">
          <div className="drag-overlay__content">
            <p className="drag-overlay__text">{t('app.dragDropToOpen')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

