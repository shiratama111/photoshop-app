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
 * - Escape: Cancel cutout / close context menu
 *
 * @see APP-002: Canvas view + layer panel integration
 * @see APP-006: AI cutout UI
 */

import React, { useCallback, useEffect } from 'react';
import { useAppStore } from './store';
import type { Tool } from './store';
import { CanvasView } from './components/canvas/CanvasView';
import { LayerPanel } from './components/panels/LayerPanel';
import { LayerContextMenu } from './components/panels/LayerContextMenu';
import { CutoutTool } from './components/tools/CutoutTool';
import { useCutoutStore } from './components/tools/cutout-store';

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

/** Toolbar component — top horizontal bar. */
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

/** Status bar — bottom information bar. */
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

/** Root App component with CSS Grid layout. */
export function App(): React.JSX.Element {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const hideContextMenu = useAppStore((s) => s.hideContextMenu);
  const cutout = useCutoutStore((s) => s.cutout);
  const cancelCutout = useCutoutStore((s) => s.cancelCutout);

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
        if (cutout) {
          cancelCutout();
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
    [undo, redo, removeLayer, selectedLayerId, setActiveTool, hideContextMenu, cutout, cancelCutout],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-layout">
      <Toolbar />
      <LayerPanel />
      <CanvasView />
      <StatusBar />
      <LayerContextMenu />
      {activeTool === 'segment' && cutout && <CutoutTool />}
    </div>
  );
}
