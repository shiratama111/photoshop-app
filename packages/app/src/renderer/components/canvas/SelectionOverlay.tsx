/**
 * @module components/canvas/SelectionOverlay
 * Marching ants selection overlay for the canvas.
 *
 * Supports rect selection, ellipse selection, and magic wand.
 * Uses CSS animation for the marching ants effect.
 *
 * Event priority (PS-PAN-002):
 *   1. Space + left-click → pan (event propagates to CanvasView)
 *   2. Left-click on interactive overlay → selection drag / magic wand
 *   3. All other events → pass through (pointer-events: none)
 *
 * @see APP-015: Selection tools
 * @see docs/agent-briefs/PS-PAN-002.md
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useAppStore, getViewport } from '../../store';
import type { RasterLayer } from '@photoshop-app/types';
import { flattenLayers, magicWandSelect, selectionBounds } from '@photoshop-app/core';
import { spacePanState } from './spacePanState';

/** SelectionOverlay renders marching ants around the current selection. */
export function SelectionOverlay(): React.JSX.Element | null {
  const selection = useAppStore((s) => s.selection);
  const document = useAppStore((s) => s.document);
  const activeTool = useAppStore((s) => s.activeTool);
  const selectionSubTool = useAppStore((s) => s.selectionSubTool);
  const setSelection = useAppStore((s) => s.setSelection);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const moveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const upHandlerRef = useRef<(() => void) | null>(null);

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
      cleanupWindowListeners();
    };
  }, [cleanupWindowListeners]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      const tool = useAppStore.getState().activeTool;
      if (tool !== 'select' && tool !== 'crop') return;
      if (e.button !== 0) return;

      // PS-PAN-002: When Space is held, let the event propagate to
      // CanvasView so that Space+drag pan takes priority over selection.
      if (spacePanState.isSpacePressed) return;

      const subTool = useAppStore.getState().selectionSubTool;

      e.preventDefault();
      e.stopPropagation();
      cleanupWindowListeners();

      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const vp = getViewport();
      const docPoint = vp.screenToDocument({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });

      // Magic wand — single click
      if (subTool === 'wand') {
        const state = useAppStore.getState();
        const doc = state.document;
        if (!doc) return;
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(doc.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        const lx = Math.round(docPoint.x - raster.position.x);
        const ly = Math.round(docPoint.y - raster.position.y);
        const mask = magicWandSelect(raster.imageData, lx, ly, state.fillTolerance);
        const bounds = selectionBounds(mask);
        if (bounds) {
          setSelection({
            x: bounds.x + raster.position.x,
            y: bounds.y + raster.position.y,
            width: bounds.width,
            height: bounds.height,
          });
        }
        return;
      }

      // Rect or ellipse drag selection
      isDragging.current = true;
      dragStart.current = { x: docPoint.x, y: docPoint.y };
      setSelection(null);

      const handleMove = (moveEvent: MouseEvent): void => {
        if (!isDragging.current) return;

        const moveRect = target.getBoundingClientRect();
        const moveDocPoint = vp.screenToDocument({
          x: moveEvent.clientX - moveRect.left,
          y: moveEvent.clientY - moveRect.top,
        });

        const x = Math.min(dragStart.current.x, moveDocPoint.x);
        const y = Math.min(dragStart.current.y, moveDocPoint.y);
        const width = Math.abs(moveDocPoint.x - dragStart.current.x);
        const height = Math.abs(moveDocPoint.y - dragStart.current.y);

        if (width > 1 && height > 1) {
          setSelection({ x, y, width, height });
        }
      };

      const handleUp = (): void => {
        isDragging.current = false;
        cleanupWindowListeners();
      };

      moveHandlerRef.current = handleMove;
      upHandlerRef.current = handleUp;
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [cleanupWindowListeners, setSelection],
  );

  if (!document) return null;

  let selectionVis: React.JSX.Element | null = null;
  if (selection) {
    // Convert selection to screen coordinates
    const vp = getViewport();
    const topLeft = vp.documentToScreen({ x: selection.x, y: selection.y });
    const bottomRight = vp.documentToScreen({
      x: selection.x + selection.width,
      y: selection.y + selection.height,
    });

    const sx = topLeft.x;
    const sy = topLeft.y;
    const sw = bottomRight.x - topLeft.x;
    const sh = bottomRight.y - topLeft.y;

    if (selectionSubTool === 'ellipse') {
      selectionVis = (
        <div
          className="selection-marching-ants selection-marching-ants--ellipse"
          data-testid="selection-ellipse"
          style={{
            left: `${sx}px`,
            top: `${sy}px`,
            width: `${sw}px`,
            height: `${sh}px`,
            borderRadius: '50%',
          }}
        />
      );
    } else {
      selectionVis = (
        <div
          className="selection-marching-ants"
          data-testid="selection-rect"
          style={{
            left: `${sx}px`,
            top: `${sy}px`,
            width: `${sw}px`,
            height: `${sh}px`,
          }}
        />
      );
    }
  }

  return (
    <div
      className={`selection-overlay ${(activeTool === 'select' || activeTool === 'crop') ? 'selection-overlay--interactive' : ''}`}
      onMouseDown={handleMouseDown}
      data-testid="selection-overlay"
    >
      {selectionVis}
    </div>
  );
}
