/**
 * @module components/canvas/TransformHandles
 * Bounding box overlay with 8 resize handles for the selected layer.
 *
 * Renders a set of absolutely-positioned divs on top of the canvas that shows:
 * - A dashed bounding rectangle around the selected layer
 * - 8 resize handles (4 corners + 4 edges)
 *
 * @see APP-012: Layer resize
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TextLayer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore, getViewport } from '../../store';

/** Handle positions. */
type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'resize' | 'move';

/** Cursor styles for each handle. */
const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

/** Handle size in pixels. */
const HANDLE_SIZE = 8;
/** Hit area thickness for dragging by the dotted border. */
const MOVE_HIT_SIZE = 10;

interface HandleInfo {
  position: HandlePosition;
  x: number;
  y: number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Estimate text layer bounds when textBounds is not set yet.
 * Keep this formula in sync with store.resizeTextLayer fallback sizing.
 */
function estimateTextLayerBounds(textLayer: TextLayer): Bounds {
  const lines = textLayer.text.split('\n');
  const longestLine = Math.max(...lines.map((line) => line.length));
  const estimatedWidth = longestLine * textLayer.fontSize * 0.6;
  const estimatedHeight = lines.length * textLayer.fontSize * textLayer.lineHeight;

  return {
    x: textLayer.position.x,
    y: textLayer.position.y,
    width: Math.max(20, estimatedWidth),
    height: Math.max(20, estimatedHeight),
  };
}

/** Read live inline-editor bounds (screen) and convert to document coordinates. */
function getInlineEditorBoundsFromDom(): Bounds | null {
  const editor = globalThis.document.querySelector('.inline-text-editor');
  const canvasArea = globalThis.document.querySelector('.canvas-area');
  if (!(editor instanceof HTMLElement) || !(canvasArea instanceof HTMLElement)) return null;

  const editorRect = editor.getBoundingClientRect();
  const canvasRect = canvasArea.getBoundingClientRect();
  const vp = getViewport();
  const topLeft = vp.screenToDocument({
    x: editorRect.left - canvasRect.left,
    y: editorRect.top - canvasRect.top,
  });
  const bottomRight = vp.screenToDocument({
    x: editorRect.right - canvasRect.left,
    y: editorRect.bottom - canvasRect.top,
  });

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(1, bottomRight.x - topLeft.x),
    height: Math.max(1, bottomRight.y - topLeft.y),
  };
}

/** TransformHandles renders bounding box + handles for the selected layer. */
export function TransformHandles(): React.JSX.Element | null {
  const document = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const activeTool = useAppStore((s) => s.activeTool);
  const zoom = useAppStore((s) => s.zoom);
  const revision = useAppStore((s) => s.revision);
  const resizeLayer = useAppStore((s) => s.resizeLayer);
  const resizeTextLayer = useAppStore((s) => s.resizeTextLayer);
  const setLayerPosition = useAppStore((s) => s.setLayerPosition);
  const setTransformActive = useAppStore((s) => s.setTransformActive);
  const setTextTransformPreview = useAppStore((s) => s.setTextTransformPreview);
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);

  const isDragging = useRef(false);
  const dragMode = useRef<DragMode | null>(null);
  const dragHandle = useRef<HandlePosition | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const originalBounds = useRef<Bounds>({ x: 0, y: 0, width: 0, height: 0 });
  const previewBoundsRef = useRef<Bounds | null>(null);
  const moveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const upHandlerRef = useRef<(() => void) | null>(null);
  const [previewBounds, setPreviewBounds] = useState<Bounds | null>(null);

  const updatePreviewBounds = (next: Bounds | null): void => {
    previewBoundsRef.current = next;
    setPreviewBounds(next);
  };

  const cleanupWindowListeners = useCallback((): void => {
    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (upHandlerRef.current) {
      window.removeEventListener('mouseup', upHandlerRef.current);
      upHandlerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return (): void => {
      isDragging.current = false;
      dragMode.current = null;
      dragHandle.current = null;
      previewBoundsRef.current = null;
      setTransformActive(false);
      setTextTransformPreview(null);
      cleanupWindowListeners();
    };
  }, [cleanupWindowListeners, setTransformActive, setTextTransformPreview]);

  // Force re-read on revision change
  void revision;

  if (!document || !selectedLayerId) return null;

  const layer = findLayerById(document.rootGroup, selectedLayerId);
  if (!layer || (layer.type !== 'raster' && layer.type !== 'text')) return null;
  const isEditingSelectedTextLayer = layer.type === 'text' && editingTextLayerId === layer.id;
  // When the text tool is active, disable move-hit areas so the canvas cursor
  // stays as I-beam and clicks pass through for text creation/editing (Issue #5).
  // Resize handles remain interactive during text editing for box resizing.
  const isTextToolActive = activeTool === 'text';
  const moveHitsInteractive = !isTextToolActive;
  const resizeHandlesInteractive = !isTextToolActive || isEditingSelectedTextLayer;

  // Get layer bounds in document coordinates.
  let layerBounds: Bounds;
  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    if (isEditingSelectedTextLayer) {
      const liveBounds = getInlineEditorBoundsFromDom();
      if (liveBounds) {
        layerBounds = liveBounds;
      } else if (textLayer.textBounds) {
        layerBounds = {
          x: textLayer.position.x,
          y: textLayer.position.y,
          width: textLayer.textBounds.width,
          height: textLayer.textBounds.height,
        };
      } else {
        layerBounds = estimateTextLayerBounds(textLayer);
      }
    } else if (textLayer.textBounds) {
      const tb = textLayer.textBounds;
      layerBounds = { x: textLayer.position.x, y: textLayer.position.y, width: tb.width, height: tb.height };
    } else {
      // textBounds is not set yet, so estimate from current text metrics.
      layerBounds = estimateTextLayerBounds(textLayer);
    }
  } else {
    // raster (existing logic)
    layerBounds = { x: layer.position.x, y: layer.position.y, width: layer.bounds.width, height: layer.bounds.height };
  }
  const displayBounds = previewBounds ?? layerBounds;

  // Convert to screen coordinates
  const vp = getViewport();
  const screenTopLeft = vp.documentToScreen({ x: displayBounds.x, y: displayBounds.y });
  const screenBottomRight = vp.documentToScreen({
    x: displayBounds.x + displayBounds.width,
    y: displayBounds.y + displayBounds.height,
  });

  const sx = screenTopLeft.x;
  const sy = screenTopLeft.y;
  const sw = screenBottomRight.x - screenTopLeft.x;
  const sh = screenBottomRight.y - screenTopLeft.y;

  // Build handle positions
  const half = HANDLE_SIZE / 2;
  const handles: HandleInfo[] = [
    { position: 'nw', x: sx - half, y: sy - half },
    { position: 'n', x: sx + sw / 2 - half, y: sy - half },
    { position: 'ne', x: sx + sw - half, y: sy - half },
    { position: 'e', x: sx + sw - half, y: sy + sh / 2 - half },
    { position: 'se', x: sx + sw - half, y: sy + sh - half },
    { position: 's', x: sx + sw / 2 - half, y: sy + sh - half },
    { position: 'sw', x: sx - half, y: sy + sh - half },
    { position: 'w', x: sx - half, y: sy + sh / 2 - half },
  ];

  const startDrag = (
    e: React.MouseEvent,
    mode: DragMode,
    position?: HandlePosition,
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragging.current) return;
    cleanupWindowListeners();

    isDragging.current = true;
    dragMode.current = mode;
    dragHandle.current = position ?? null;
    dragStart.current = { x: e.clientX, y: e.clientY };
    originalBounds.current = { ...layerBounds };
    updatePreviewBounds({ ...layerBounds });
    if (isEditingSelectedTextLayer) {
      setTextTransformPreview({
        layerId: selectedLayerId,
        bounds: { ...layerBounds },
      });
    }
    setTransformActive(true);

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!isDragging.current || !dragMode.current) return;

      const dx = (moveEvent.clientX - dragStart.current.x) / zoom;
      const dy = (moveEvent.clientY - dragStart.current.y) / zoom;
      const ob = originalBounds.current;

      if (dragMode.current === 'move') {
        const next = {
          x: Math.round(ob.x + dx),
          y: Math.round(ob.y + dy),
          width: ob.width,
          height: ob.height,
        };
        updatePreviewBounds(next);
        if (isEditingSelectedTextLayer) {
          setTextTransformPreview({
            layerId: selectedLayerId,
            bounds: next,
          });
        }
        return;
      }
      if (!dragHandle.current) return;

      let newX = ob.x;
      let newY = ob.y;
      let newW = ob.width;
      let newH = ob.height;

      const pos = dragHandle.current;
      if (pos.includes('w')) {
        newX = ob.x + dx;
        newW = ob.width - dx;
      }
      if (pos.includes('e')) {
        newW = ob.width + dx;
      }
      if (pos.includes('n')) {
        newY = ob.y + dy;
        newH = ob.height - dy;
      }
      if (pos.includes('s')) {
        newH = ob.height + dy;
      }

      // Enforce minimum size
      if (newW < 1) { newW = 1; newX = ob.x + ob.width - 1; }
      if (newH < 1) { newH = 1; newY = ob.y + ob.height - 1; }

      const next = {
        x: newX,
        y: newY,
        width: Math.round(newW),
        height: Math.round(newH),
      };
      updatePreviewBounds(next);
      if (isEditingSelectedTextLayer) {
        setTextTransformPreview({
          layerId: selectedLayerId,
          bounds: next,
        });
      }
    };

    const handleMouseUp = (): void => {
      if (isDragging.current && selectedLayerId) {
        const ob = originalBounds.current;
        const finalBounds = previewBoundsRef.current ?? ob;

        if (dragMode.current === 'resize' && (finalBounds.width !== ob.width || finalBounds.height !== ob.height)) {
          if (layer.type === 'text') {
            resizeTextLayer(
              selectedLayerId,
              Math.round(finalBounds.width),
              Math.round(finalBounds.height),
            );
          } else {
            resizeLayer(
              selectedLayerId,
              Math.round(finalBounds.width),
              Math.round(finalBounds.height),
            );
          }
        }

        if (finalBounds.x !== ob.x || finalBounds.y !== ob.y) {
          setLayerPosition(
            selectedLayerId,
            Math.round(finalBounds.x),
            Math.round(finalBounds.y),
          );
        }
      }

      updatePreviewBounds(null);
      isDragging.current = false;
      dragMode.current = null;
      dragHandle.current = null;
      setTransformActive(false);
      setTextTransformPreview(null);
      cleanupWindowListeners();
    };

    moveHandlerRef.current = handleMouseMove;
    upHandlerRef.current = handleMouseUp;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="transform-handles-container" data-testid="transform-handles">
      {/* Bounding box */}
      <div
        className="transform-bounding-box"
        style={{
          left: `${sx}px`,
          top: `${sy}px`,
          width: `${sw}px`,
          height: `${sh}px`,
        }}
      />
      {/* Move hit areas: dotted border segments (excluding square handles). */}
      <div
        className="transform-move-hit"
        data-testid="move-hit-top"
        style={{
          left: `${sx + half}px`,
          top: `${sy - MOVE_HIT_SIZE / 2}px`,
          width: `${Math.max(1, sw - HANDLE_SIZE)}px`,
          height: `${MOVE_HIT_SIZE}px`,
          pointerEvents: moveHitsInteractive ? 'all' : 'none',
        }}
        onMouseDown={moveHitsInteractive ? (e): void => startDrag(e, 'move') : undefined}
      />
      <div
        className="transform-move-hit"
        data-testid="move-hit-right"
        style={{
          left: `${sx + sw - MOVE_HIT_SIZE / 2}px`,
          top: `${sy + half}px`,
          width: `${MOVE_HIT_SIZE}px`,
          height: `${Math.max(1, sh - HANDLE_SIZE)}px`,
          pointerEvents: moveHitsInteractive ? 'all' : 'none',
        }}
        onMouseDown={moveHitsInteractive ? (e): void => startDrag(e, 'move') : undefined}
      />
      <div
        className="transform-move-hit"
        data-testid="move-hit-bottom"
        style={{
          left: `${sx + half}px`,
          top: `${sy + sh - MOVE_HIT_SIZE / 2}px`,
          width: `${Math.max(1, sw - HANDLE_SIZE)}px`,
          height: `${MOVE_HIT_SIZE}px`,
          pointerEvents: moveHitsInteractive ? 'all' : 'none',
        }}
        onMouseDown={moveHitsInteractive ? (e): void => startDrag(e, 'move') : undefined}
      />
      <div
        className="transform-move-hit"
        data-testid="move-hit-left"
        style={{
          left: `${sx - MOVE_HIT_SIZE / 2}px`,
          top: `${sy + half}px`,
          width: `${MOVE_HIT_SIZE}px`,
          height: `${Math.max(1, sh - HANDLE_SIZE)}px`,
          pointerEvents: moveHitsInteractive ? 'all' : 'none',
        }}
        onMouseDown={moveHitsInteractive ? (e): void => startDrag(e, 'move') : undefined}
      />
      {/* 8 resize handles */}
      {handles.map((h) => (
        <div
          key={h.position}
          className={`transform-handle${resizeHandlesInteractive ? '' : ' transform-handle--inactive'}`}
          data-testid={`handle-${h.position}`}
          style={{
            left: `${h.x}px`,
            top: `${h.y}px`,
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            cursor: resizeHandlesInteractive ? HANDLE_CURSORS[h.position] : 'inherit',
            pointerEvents: resizeHandlesInteractive ? 'all' : 'none',
          }}
          onMouseDown={resizeHandlesInteractive ? (e): void => startDrag(e, 'resize', h.position) : undefined}
        />
      ))}
    </div>
  );
}
