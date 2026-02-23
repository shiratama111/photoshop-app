/**
 * @module components/canvas/SelectionOverlay
 * Marching ants selection overlay for the canvas.
 *
 * Renders a dashed animated border around the current selection rectangle.
 * Uses CSS animation for the marching ants effect.
 *
 * @see APP-015: Selection tools
 */

import React, { useCallback, useRef } from 'react';
import { useAppStore, getViewport } from '../../store';

/** SelectionOverlay renders marching ants around the current selection. */
export function SelectionOverlay(): React.JSX.Element | null {
  const selection = useAppStore((s) => s.selection);
  const document = useAppStore((s) => s.document);
  const setSelection = useAppStore((s) => s.setSelection);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      const tool = useAppStore.getState().activeTool;
      if (tool !== 'select') return;
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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

        const moveRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [setSelection],
  );

  if (!document || !selection) return null;

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

  return (
    <div
      className="selection-overlay"
      onMouseDown={handleMouseDown}
      data-testid="selection-overlay"
    >
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
    </div>
  );
}
