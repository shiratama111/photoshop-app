/**
 * @module App
 * Root React component with CSS Grid layout.
 *
 * Layout (4 zones):
 * ┌──────────────────────────┐
 * │        Toolbar           │
 * ├──────┬───────────────────┤
 * │ Side │                   │
 * │ bar  │   Canvas Area     │
 * │      │                   │
 * ├──────┴───────────────────┤
 * │       Status Bar         │
 * └──────────────────────────┘
 */

import React from 'react';
import { useAppStore } from './store';
import type { Tool } from './store';

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

/** Sidebar component — layer panel placeholder. */
function Sidebar(): React.JSX.Element {
  const document = useAppStore((s) => s.document);

  return (
    <div className="sidebar">
      <div className="sidebar-header">Layers</div>
      {document ? (
        <div className="layer-list">
          {document.rootGroup.children.map((layer) => (
            <div key={layer.id} className="layer-item">
              {layer.visible ? '👁' : '  '} {layer.name}
            </div>
          ))}
          {document.rootGroup.children.length === 0 && (
            <div className="layer-empty">No layers</div>
          )}
        </div>
      ) : (
        <div className="layer-empty">No document open</div>
      )}
    </div>
  );
}

/** Canvas area — the main editing viewport. */
function CanvasArea(): React.JSX.Element {
  const document = useAppStore((s) => s.document);

  return (
    <div className="canvas-area">
      {document ? (
        <canvas
          id="editor-canvas"
          width={document.canvas.size.width}
          height={document.canvas.size.height}
        />
      ) : (
        <div className="canvas-empty">
          <p>No document open</p>
          <p>File &gt; New to create a document</p>
        </div>
      )}
    </div>
  );
}

/** Status bar — bottom information bar. */
function StatusBar(): React.JSX.Element {
  const { document, zoom, statusMessage } = useAppStore();

  return (
    <div className="statusbar">
      <span className="status-message">{statusMessage}</span>
      <span className="status-right">
        {document && (
          <>
            <span>{document.canvas.size.width} x {document.canvas.size.height}</span>
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
  return (
    <div className="app-layout">
      <Toolbar />
      <Sidebar />
      <CanvasArea />
      <StatusBar />
    </div>
  );
}
