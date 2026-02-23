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

import React, { useCallback, useRef } from 'react';
import type { RasterLayer } from '@photoshop-app/types';
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

/** TransformHandles renders bounding box + handles for the selected layer. */
export function TransformHandles(): React.JSX.Element | null {
  const document = useAppStore((s) => s.document);
  const selectedLayerId = useAppStore((s) => s.selectedLayerId);
  const zoom = useAppStore((s) => s.zoom);
  const revision = useAppStore((s) => s.revision);
  const resizeLayer = useAppStore((s) => s.resizeLayer);

  const isDragging = useRef(false);
  const dragHandle = useRef<HandlePosition | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const originalBounds = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Force re-read on revision change
  void revision;

  if (!document || !selectedLayerId) return null;

  const layer = findLayerById(document.rootGroup, selectedLayerId);
  if (!layer || layer.type === 'group') return null;

  // Get layer bounds in document coordinates
  let layerBounds: { x: number; y: number; width: number; height: number };
  if (layer.type === 'raster') {
    layerBounds = {
      x: layer.position.x,
      y: layer.position.y,
      width: layer.bounds.width,
      height: layer.bounds.height,
    };
  } else {
    const tl = layer;
    const w = tl.textBounds?.width ?? Math.max(100, tl.fontSize * 10);
    const h = tl.textBounds?.height ?? tl.fontSize * tl.lineHeight * 3;
    layerBounds = {
      x: tl.position.x,
      y: tl.position.y,
      width: w,
      height: h,
    };
  }

  // Convert to screen coordinates
  const vp = getViewport();
  const screenTopLeft = vp.documentToScreen({ x: layerBounds.x, y: layerBounds.y });
  const screenBottomRight = vp.documentToScreen({
    x: layerBounds.x + layerBounds.width,
    y: layerBounds.y + layerBounds.height,
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, position: HandlePosition): void => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragHandle.current = position;
      dragStart.current = { x: e.clientX, y: e.clientY };
      originalBounds.current = { ...layerBounds };

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

        // Live preview: update layer position and bounds directly
        if (layer.type === 'raster') {
          layer.position.x = newX;
          layer.position.y = newY;
          (layer as RasterLayer).bounds = { x: 0, y: 0, width: Math.round(newW), height: Math.round(newH) };
        }

        // Trigger re-render
        useAppStore.setState({ revision: useAppStore.getState().revision + 1 });
      };

      const handleMouseUp = (): void => {
        if (isDragging.current && dragHandle.current && selectedLayerId) {
          const ob = originalBounds.current;
          const newBounds = layer.type === 'raster'
            ? (layer as RasterLayer).bounds
            : { x: 0, y: 0, width: ob.width, height: ob.height };

          // Only commit if size actually changed
          if (newBounds.width !== ob.width || newBounds.height !== ob.height) {
            resizeLayer(
              selectedLayerId,
              Math.round(newBounds.width),
              Math.round(newBounds.height),
            );
          }
        }

        isDragging.current = false;
        dragHandle.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [layer, layerBounds, zoom, selectedLayerId, resizeLayer],
  );

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
