/**
 * @module components/canvas/CanvasView
 * Main canvas viewport component.
 *
 * Renders the active document to an HTML canvas using Canvas2DRenderer.
 * Handles:
 * - Viewport zoom (mouse wheel)
 * - Viewport pan (middle-click drag or Space + left-click drag)
 * - Resize observer for responsive canvas sizing
 * - Automatic re-render on document changes (via revision counter)
 *
 * @see APP-002: Canvas view integration
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useAppStore, getViewport } from '../../store';

/** CanvasView renders the document to a canvas with zoom/pan controls. */
export function CanvasView(): React.JSX.Element {
  const document = useAppStore((s) => s.document);
  const revision = useAppStore((s) => s.revision);
  const zoom = useAppStore((s) => s.zoom);
  const renderToCanvas = useAppStore((s) => s.renderToCanvas);
  const setPanOffset = useAppStore((s) => s.setPanOffset);
  const fitToWindow = useAppStore((s) => s.fitToWindow);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  /** Render the document to the canvas. */
  const doRender = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas || !document) return;

    const container = containerRef.current;
    if (!container) return;

    // Match canvas size to container
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    renderToCanvas(canvas);
  }, [document, renderToCanvas]);

  // Re-render when document or revision changes
  useEffect(() => {
    doRender();
  }, [doRender, revision, zoom]);

  // Fit to window on first mount and when document changes
  useEffect(() => {
    if (!document || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    fitToWindow(rect.width, rect.height);
  }, [document, fitToWindow]);

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((): void => {
      if (!useAppStore.getState().document) return;
      const rect = container.getBoundingClientRect();
      fitToWindow(rect.width, rect.height);
      doRender();
    });

    observer.observe(container);
    return (): void => observer.disconnect();
  }, [doRender, fitToWindow]);

  /** Handle mouse wheel for zoom. */
  const handleWheel = useCallback(
    (e: React.WheelEvent): void => {
      e.preventDefault();
      if (!document) return;

      const vp = getViewport();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = vp.zoom * zoomFactor;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const anchor = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      vp.setZoom(newZoom, anchor);
      const store = useAppStore.getState();
      store.setZoom(vp.zoom);
      store.setPanOffset(vp.offset);
    },
    [document],
  );

  /** Handle mouse down for pan start. */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      // Middle button (button 1) or Space + left button
      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
      }
    },
    [],
  );

  /** Handle mouse move for pan. */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      if (!isPanning.current) return;

      const vp = getViewport();
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };

      const offset = vp.offset;
      vp.setOffset({ x: offset.x + dx, y: offset.y + dy });
      setPanOffset(vp.offset);
    },
    [setPanOffset],
  );

  /** Handle mouse up for pan end. */
  const handleMouseUp = useCallback((): void => {
    isPanning.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="canvas-area"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {document ? (
        <canvas
          ref={canvasRef}
          className="editor-canvas"
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
