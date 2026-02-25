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

/** TransformHandles renders bounding box + handles for the selected layer. */
export function TransformHandles(): React.JSX.Element | null {
  const document = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const zoom = useAppStore((s) => s.zoom);
  const revision = useAppStore((s) => s.revision);
  const resizeLayer = useAppStore((s) => s.resizeLayer);
  const resizeTextLayer = useAppStore((s) => s.resizeTextLayer);
  const setLayerPosition = useAppStore((s) => s.setLayerPosition);
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);

  const isDragging = useRef(false);
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
      dragHandle.current = null;
      previewBoundsRef.current = null;
      cleanupWindowListeners();
    };
  }, [cleanupWindowListeners]);

  // Force re-read on revision change
  void revision;

  if (!document || !selectedLayerId) return null;

  const layer = findLayerById(document.rootGroup, selectedLayerId);
  if (!layer || (layer.type !== 'raster' && layer.type !== 'text')) return null;

  // Hide handles while inline-editing a text layer
  if (layer.type === 'text' && editingTextLayerId === layer.id) return null;

  // Get layer bounds in document coordinates.
  let layerBounds: Bounds;
  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    const tb = textLayer.textBounds;
    if (tb) {
      layerBounds = { x: textLayer.position.x, y: textLayer.position.y, width: tb.width, height: tb.height };
    } else {
      // textBounds not set — estimate from fontSize
      const lines = textLayer.text.split('\n');
      const estW = Math.max(...lines.map(l => l.length)) * textLayer.fontSize * 0.6;
      const estH = lines.length * textLayer.fontSize * textLayer.lineHeight;
      layerBounds = { x: textLayer.position.x, y: textLayer.position.y, width: Math.max(20, estW), height: Math.max(20, estH) };
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

  const handleMouseDown = (e: React.MouseEvent, position: HandlePosition): void => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragging.current) return;
    cleanupWindowListeners();

    isDragging.current = true;
    dragHandle.current = position;
    dragStart.current = { x: e.clientX, y: e.clientY };
    originalBounds.current = { ...layerBounds };
    updatePreviewBounds({ ...layerBounds });

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!isDragging.current || !dragHandle.current) return;

      const dx = (moveEvent.clientX - dragStart.current.x) / zoom;
      const dy = (moveEvent.clientY - dragStart.current.y) / zoom;
      const ob = originalBounds.current;
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

      updatePreviewBounds({
        x: newX,
        y: newY,
        width: Math.round(newW),
        height: Math.round(newH),
      });
    };

    const handleMouseUp = (): void => {
      if (isDragging.current && dragHandle.current && selectedLayerId) {
        const ob = originalBounds.current;
        const finalBounds = previewBoundsRef.current ?? ob;

        // Only commit if size actually changed
        if (finalBounds.width !== ob.width || finalBounds.height !== ob.height) {
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
      dragHandle.current = null;
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
      {/* 8 resize handles */}
      {handles.map((h) => (
        <div
          key={h.position}
          className="transform-handle"
          data-testid={`handle-${h.position}`}
          style={{
            left: `${h.x}px`,
            top: `${h.y}px`,
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            cursor: HANDLE_CURSORS[h.position],
          }}
          onMouseDown={(e): void => handleMouseDown(e, h.position)}
        />
      ))}
    </div>
  );
}
