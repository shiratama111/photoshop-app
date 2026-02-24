/**
 * @module components/canvas/SelectionOverlay
 * Marching ants selection overlay for the canvas.
 *
 * Renders a dashed animated border around the current selection rectangle.
 * Uses CSS animation for the marching ants effect.
 *
 * @see APP-015: Selection tools
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useAppStore, getViewport } from '../../store';

/** SelectionOverlay renders marching ants around the current selection. */
export function SelectionOverlay(): React.JSX.Element | null {
  const selection = useAppStore((s) => s.selection);
  const document = useAppStore((s) => s.document);
  const activeTool = useAppStore((s) => s.activeTool);
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
      if (tool !== 'select') return;
      if (e.button !== 0) return;

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

  let selectionRect: React.JSX.Element | null = null;
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

    selectionRect = (
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

  return (
    <div
      className={`selection-overlay ${activeTool === 'select' ? 'selection-overlay--interactive' : ''}`}
      onMouseDown={handleMouseDown}
      data-testid="selection-overlay"
    >
      {selectionRect}
    </div>
  );
}
