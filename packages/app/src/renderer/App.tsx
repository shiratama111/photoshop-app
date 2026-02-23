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
import { useAppStore } from './store';
import type { Tool } from './store';
import { CanvasView } from './components/canvas/CanvasView';
import { LayerPanel } from './components/panels/LayerPanel';
import { LayerContextMenu } from './components/panels/LayerContextMenu';
import { PsdDialog } from './components/dialogs/PsdDialog';
import { LayerStyleDialog } from './components/dialogs/LayerStyleDialog';
import { RecoveryDialog } from './components/dialogs/RecoveryDialog';
import { CloseConfirmDialog } from './components/dialogs/CloseConfirmDialog';
import { AssetBrowser } from './components/panels/AssetBrowser';
import { TextPropertiesPanel, InlineTextEditor } from './components/text-editor';

/** Available tools with display labels. */
const TOOLS: Array<{ id: Tool; label: string; shortcut: string }> = [
  { id: 'select', label: 'Select', shortcut: 'V' },
  { id: 'move', label: 'Move', shortcut: 'M' },
  { id: 'brush', label: 'Brush', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'text', label: 'Text', shortcut: 'T' },
  { id: 'crop', label: 'Crop', shortcut: 'C' },
  { id: 'segment', label: 'AI Cutout', shortcut: 'W' },
];

/** Tool shortcut key map. */
const TOOL_SHORTCUTS: Record<string, Tool> = {};
for (const tool of TOOLS) {
  TOOL_SHORTCUTS[tool.shortcut.toLowerCase()] = tool.id;
}

/** Supported file extensions for drag-drop. */
const SUPPORTED_EXTENSIONS = new Set(['psd']);

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
          title={`${tool.label} (${tool.shortcut})`}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

/** Status bar \u2014 bottom information bar. */
function StatusBar(): React.JSX.Element {
  const { document, zoom, statusMessage, canUndo, canRedo } = useAppStore();

  return (
    <div className="statusbar">
      <span className="status-message">{statusMessage}</span>
      <span className="status-right">
        {canUndo && <span className="status-hint">Ctrl+Z undo</span>}
        {canRedo && <span className="status-hint">Ctrl+Y redo</span>}
        {document && (
          <>
            <span className="status-sep">|</span>
            <span>
              {document.canvas.size.width} x {document.canvas.size.height}
            </span>
            <span className="status-sep">|</span>
          </>
        )}
        <span>{Math.round(zoom * 100)}%</span>
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
          Layers
        </button>
        <button
          className={`sidebar-tab ${activePanel === 'assets' ? 'sidebar-tab--active' : ''}`}
          onClick={(): void => setActivePanel('assets')}
        >
          Assets
        </button>
      </div>
      <div className="sidebar-content">
        {activePanel === 'layers' ? (
          <>
            <LayerPanel />
            <TextPropertiesPanel />
          </>
        ) : (
          <AssetBrowser />
        )}
      </div>
    </div>
  );
}

/** Root App component with CSS Grid layout. */
export function App(): React.JSX.Element {
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const hideContextMenu = useAppStore((s) => s.hideContextMenu);
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);
  const layerStyleDialog = useAppStore((s) => s.layerStyleDialog);
  const stopEditingText = useAppStore((s) => s.stopEditingText);
  const dragOverActive = useAppStore((s) => s.dragOverActive);
  const setDragOverActive = useAppStore((s) => s.setDragOverActive);
  const openFileByPath = useAppStore((s) => s.openFileByPath);

  /** Global keyboard shortcut handler. */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
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
        if (useAppStore.getState().editingTextLayerId) {
          stopEditingText();
        } else {
          hideContextMenu();
        }
        return;
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          setActiveTool(tool);
        }
      }
    },
    [undo, redo, removeLayer, selectedLayerId, setActiveTool, hideContextMenu, stopEditingText],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Wire Electron menu events to store actions \u2014 APP-004
  useEffect(() => {
    const api = (window as unknown as { electronAPI: Record<string, (cb: () => void) => void> }).electronAPI;
    if (!api) return;
    api.onMenuNew?.(() => useAppStore.getState().newDocument('Untitled', 1920, 1080));
    api.onMenuOpen?.(() => void useAppStore.getState().openFile());
    api.onMenuSave?.(() => void useAppStore.getState().saveFile());
    api.onMenuSaveAs?.(() => void useAppStore.getState().saveAsFile());
    api.onMenuUndo?.(() => useAppStore.getState().undo());
    api.onMenuRedo?.(() => useAppStore.getState().redo());
  }, []);

  // Check for recovery files on startup \u2014 APP-008
  useEffect(() => {
    void useAppStore.getState().checkRecovery();
    void useAppStore.getState().loadRecentFiles();
  }, []);

  // Listen for close confirmation from main process \u2014 APP-008
  useEffect(() => {
    const api = (window as unknown as { electronAPI: { onBeforeClose: (cb: () => void) => void } }).electronAPI;
    if (!api) return;
    api.onBeforeClose?.(() => {
      const state = useAppStore.getState();
      if (state.document?.dirty) {
        state.setPendingClose(true);
      } else {
        // No unsaved changes, close immediately
        (window as unknown as { electronAPI: { confirmClose: (a: string) => void } })
          .electronAPI.confirmClose('discard');
      }
    });
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

      // Open the first supported file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Electron provides the path property on dropped files
        const filePath = (file as unknown as { path: string }).path;
        if (filePath && isSupportedFile(filePath)) {
          void openFileByPath(filePath);
          return;
        }
      }

      useAppStore.getState().setStatusMessage('Unsupported file format. Drop a .psd file.');
    },
    [openFileByPath, setDragOverActive],
  );

  return (
    <div
      className="app-layout"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toolbar />
      <SidebarWrapper />
      <CanvasView />
      <StatusBar />
      <LayerContextMenu />
      <PsdDialog />
      <RecoveryDialog />
      <CloseConfirmDialog />
      {editingTextLayerId && <InlineTextEditor />}
      {layerStyleDialog && <LayerStyleDialog />}
      {dragOverActive && (
        <div className="drag-overlay">
          <div className="drag-overlay__content">
            <p className="drag-overlay__text">Drop file to open</p>
          </div>
        </div>
      )}
    </div>
  );
}
