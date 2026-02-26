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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RasterLayer, TextLayer } from '@photoshop-app/types';
import {
  flattenLayers,
  floodFill,
  renderGradient,
  createTwoColorGradient,
  pickColor,
  drawRectangle,
  drawEllipse,
  drawLine,
  createCloneSession,
  cloneStamp,
  dodgeDab,
  burnDab,
} from '@photoshop-app/core';
import type { CloneSession, GradientType } from '@photoshop-app/core';
import { BrushEngine, BRUSH_VARIANTS } from '../../brush-engine';
import { useAppStore, getViewport } from '../../store';
import { t } from '../../i18n';
import { TransformHandles } from './TransformHandles';
import { SelectionOverlay } from './SelectionOverlay';
import { CutoutTool } from '../tools/CutoutTool';
import { spacePanState } from './spacePanState';
import { getTextLayerHitBounds, isPointInBounds } from './text-hit-test';

/** Module-level brush engine instance (APP-014). */
const brushEngine = new BrushEngine();

/** Module-level clone stamp session. */
let cloneSession: CloneSession | null = null;
/** Clone source point (set via Alt+click). */
let cloneSourcePoint: { x: number; y: number; imageData: ImageData } | null = null;

/** CanvasView renders the document to a canvas with zoom/pan controls. */
export function CanvasView(): React.JSX.Element {
  const document = useAppStore((s) => s.document);
  const revision = useAppStore((s) => s.revision);
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);
  const activeTool = useAppStore((s) => s.activeTool);
  const brushSize = useAppStore((s) => s.brushSize);
  const editingTextLayerId = useAppStore((s) => s.editingTextLayerId);
  const renderToCanvas = useAppStore((s) => s.renderToCanvas);
  const setPanOffset = useAppStore((s) => s.setPanOffset);
  const fitToWindow = useAppStore((s) => s.fitToWindow);
  const startEditingText = useAppStore((s) => s.startEditingText);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const fittedDocumentIdRef = useRef<string | null>(null);
  const renderRequestRef = useRef<number | null>(null);
  const observedSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Space-key pan state — shared via spacePanState module (PS-PAN-001, PS-PAN-002)
  const [panCursor, setPanCursor] = useState<'grab' | 'grabbing' | null>(null);

  // Tool-specific drag state
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const cloneSourceSet = useRef(false);
  const dodgeBurnActive = useRef(false);
  const dodgeBurnSnapshot = useRef<Uint8ClampedArray | null>(null);

  /** Render the document to the canvas. */
  const doRender = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas || !document) return;

    const container = containerRef.current;
    if (!container) return;

    // Match canvas size to container
    const width = Math.max(1, Math.floor(container.clientWidth));
    const height = Math.max(1, Math.floor(container.clientHeight));
    getViewport().setViewportSize({ width, height });

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const cssWidth = `${width}px`;
    const cssHeight = `${height}px`;
    if (canvas.style.width !== cssWidth) {
      canvas.style.width = cssWidth;
    }
    if (canvas.style.height !== cssHeight) {
      canvas.style.height = cssHeight;
    }

    renderToCanvas(canvas);
  }, [document, renderToCanvas]);

  /** Queue rendering to one paint per animation frame. */
  const scheduleRender = useCallback((): void => {
    if (renderRequestRef.current !== null) return;
    renderRequestRef.current = window.requestAnimationFrame(() => {
      renderRequestRef.current = null;
      doRender();
    });
  }, [doRender]);

  useEffect(() => {
    return (): void => {
      if (renderRequestRef.current !== null) {
        window.cancelAnimationFrame(renderRequestRef.current);
        renderRequestRef.current = null;
      }
    };
  }, []);

  // Re-render when document or revision changes
  useEffect(() => {
    scheduleRender();
  }, [scheduleRender, revision, zoom, panOffset.x, panOffset.y, editingTextLayerId]);

  // Force an immediate repaint when text edit mode toggles.
  // Electron can throttle rAF around window deactivation, which may leave
  // stale pixels after the inline editor unmounts.
  useEffect(() => {
    doRender();
  }, [doRender, editingTextLayerId]);

  // Fit to window on first mount and when document changes
  useEffect(() => {
    if (!document || !containerRef.current) return;
    const width = Math.floor(containerRef.current.clientWidth);
    const height = Math.floor(containerRef.current.clientHeight);
    if (width <= 1 || height <= 1) return;
    fitToWindow(width, height);
    fittedDocumentIdRef.current = document.id;
    observedSizeRef.current = { width, height };
    scheduleRender();
  }, [document, fitToWindow, scheduleRender]);

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((): void => {
      const doc = useAppStore.getState().document;
      if (!doc) return;
      const width = Math.floor(container.clientWidth);
      const height = Math.floor(container.clientHeight);
      if (width <= 1 || height <= 1) return;
      const prev = observedSizeRef.current;
      if (prev && prev.width === width && prev.height === height && fittedDocumentIdRef.current === doc.id) {
        return;
      }
      observedSizeRef.current = { width, height };

      // If initial fit was skipped due a transient zero-sized mount,
      // perform it once when real dimensions become available.
      if (fittedDocumentIdRef.current !== doc.id) {
        fitToWindow(width, height);
        fittedDocumentIdRef.current = doc.id;
        scheduleRender();
        return;
      }

      scheduleRender();
    });

    observer.observe(container);
    return (): void => observer.disconnect();
  }, [fitToWindow, scheduleRender]);

  // Ensure canvas is repainted after app/window focus changes.
  useEffect(() => {
    const handleFocus = (): void => {
      doRender();
    };
    const handleVisibility = (): void => {
      if (globalThis.document.visibilityState === 'visible') {
        doRender();
      }
    };

    window.addEventListener('focus', handleFocus);
    globalThis.document.addEventListener('visibilitychange', handleVisibility);
    return (): void => {
      window.removeEventListener('focus', handleFocus);
      globalThis.document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [doRender]);

  // Space-key listener for temporary pan mode (PS-PAN-001)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat) return;
      // Skip if an input element is focused (text editing, etc.)
      const active = globalThis.document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (active?.isContentEditable) return;
      e.preventDefault();
      spacePanState.isSpacePressed = true;
      setPanCursor(isPanning.current ? 'grabbing' : 'grab');
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return;
      spacePanState.isSpacePressed = false;
      if (isPanning.current) {
        // Still dragging — will clear on mouseup
        return;
      }
      setPanCursor(null);
    };

    const handleWindowBlur = (): void => {
      // Prevent sticky Space-pan state if keyup is missed on focus loss.
      spacePanState.isSpacePressed = false;
      if (!isPanning.current) {
        setPanCursor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

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

  /** Handle mouse down for pan start or brush stroke (APP-014). */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent): void => {
      // Middle button (button 1) — pan
      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
        setPanCursor('grabbing');
        return;
      }

      // Space + left button — temporary pan (PS-PAN-001)
      if (e.button === 0 && spacePanState.isSpacePressed) {
        e.preventDefault();
        isPanning.current = true;
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
        setPanCursor('grabbing');
        return;
      }

      // Left button + text tool — click to create or edit text (PS-TEXT-003)
      const tool = useAppStore.getState().activeTool;
      if (e.button === 0 && tool === 'text' && document) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });

        // Check if clicking on an existing text layer
        const textLayers = flattenLayers(document.rootGroup);
        for (let i = textLayers.length - 1; i >= 0; i--) {
          const layer = textLayers[i];
          if (layer.type !== 'text' || !layer.visible) continue;
          const tl = layer as TextLayer;
          const hitBounds = getTextLayerHitBounds(tl, vp.zoom);
          if (isPointInBounds(docPt, hitBounds)) {
            startEditingText(tl.id);
            return;
          }
        }

        // No existing text hit — create new text layer at click position
        useAppStore.getState().addTextLayerAt(docPt.x, docPt.y);
        return;
      }

      // Left button + brush/eraser tool — start stroke (APP-014)
      if (
        e.button === 0 &&
        (tool === 'brush' || tool === 'eraser') &&
        document
      ) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        const lx = docPt.x - raster.position.x;
        const ly = docPt.y - raster.position.y;

        brushEngine.startStroke(
          raster.imageData,
          { x: lx, y: ly },
          {
            size: state.brushSize,
            hardness: state.brushHardness,
            opacity: state.brushOpacity,
            color: state.brushColor,
            eraser: tool === 'eraser',
            variant: BRUSH_VARIANTS[state.brushVariant],
          },
        );
        scheduleRender();
      }

      // Eyedropper tool — pick color on click
      if (e.button === 0 && tool === 'eyedropper' && document) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        const lx = Math.round(docPt.x - raster.position.x);
        const ly = Math.round(docPt.y - raster.position.y);
        const color = pickColor(raster.imageData, lx, ly);
        if (color) {
          state.setBrushColor({ r: color.r, g: color.g, b: color.b, a: color.a / 255 });
          state.setActiveTool('brush');
        }
      }

      // Fill tool — flood fill on click
      if (e.button === 0 && tool === 'fill' && document) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        const lx = Math.round(docPt.x - raster.position.x);
        const ly = Math.round(docPt.y - raster.position.y);
        const c = state.brushColor;
        const filled = floodFill(raster.imageData, lx, ly, {
          r: c.r, g: c.g, b: c.b, a: Math.round(c.a * 255),
        }, state.fillTolerance);
        state.applyFilter(() => filled);
        scheduleRender();
      }

      // Gradient tool — start drag
      if (e.button === 0 && tool === 'gradient' && document) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        dragStart.current = docPt;
        isDragging.current = true;
      }

      // Shape tool — start drag
      if (e.button === 0 && tool === 'shape' && document) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        dragStart.current = docPt;
        isDragging.current = true;
      }

      // Clone stamp tool — Alt+click sets source, normal click paints
      if (e.button === 0 && tool === 'clone' && document) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        const lx = Math.round(docPt.x - raster.position.x);
        const ly = Math.round(docPt.y - raster.position.y);

        if (e.altKey) {
          cloneSourcePoint = { x: lx, y: ly, imageData: raster.imageData };
          cloneSession = null;
          cloneSourceSet.current = true;
        } else if (cloneSourcePoint) {
          if (!cloneSession) {
            cloneSession = createCloneSession(
              cloneSourcePoint.imageData,
              cloneSourcePoint.x,
              cloneSourcePoint.y,
              lx,
              ly,
            );
          }
          const oldData = new Uint8ClampedArray(raster.imageData.data);
          cloneStamp(raster.imageData, cloneSession, lx, ly, {
            size: state.brushSize,
            hardness: state.brushHardness,
            opacity: state.brushOpacity,
          });
          const newData = new Uint8ClampedArray(raster.imageData.data);
          state.commitBrushStroke(activeId, {
            x: 0, y: 0, width: raster.bounds.width, height: raster.bounds.height,
          }, oldData, newData);
          scheduleRender();
        }
      }

      // Dodge/Burn tools — start painting
      if (e.button === 0 && (tool === 'dodge' || tool === 'burn') && document) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        dodgeBurnActive.current = true;
        dodgeBurnSnapshot.current = new Uint8ClampedArray(raster.imageData.data);

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        const lx = Math.round(docPt.x - raster.position.x);
        const ly = Math.round(docPt.y - raster.position.y);
        const dabFn = tool === 'dodge' ? dodgeDab : burnDab;
        dabFn(raster.imageData, lx, ly, {
          size: state.brushSize,
          hardness: state.brushHardness,
          exposure: state.brushOpacity,
        }, 'midtones');
        scheduleRender();
      }
    },
    [document, scheduleRender],
  );

  /** Handle mouse move for pan or brush continuation (APP-014). */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      // Update brush cursor position
      if (cursorRef.current) {
        cursorRef.current.style.left = `${localX}px`;
        cursorRef.current.style.top = `${localY}px`;
      }

      // Pan path
      if (isPanning.current) {
        const vp = getViewport();
        const dx = e.clientX - lastPanPoint.current.x;
        const dy = e.clientY - lastPanPoint.current.y;
        lastPanPoint.current = { x: e.clientX, y: e.clientY };

        const offset = vp.offset;
        vp.setOffset({ x: offset.x + dx, y: offset.y + dy });
        setPanOffset(vp.offset);
        return;
      }

      // Brush continuation (APP-014)
      if (brushEngine.isActive && document) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;

        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: localX,
          y: localY,
        });
        brushEngine.continueStroke({
          x: docPt.x - raster.position.x,
          y: docPt.y - raster.position.y,
        });
        scheduleRender();
      }

      // Dodge/Burn continuation
      if (dodgeBurnActive.current && document) {
        const state = useAppStore.getState();
        const tool = state.activeTool;
        const activeId = state.selectedLayerId;
        if (!activeId) return;
        const allLayers = flattenLayers(document.rootGroup);
        const layer = allLayers.find((l) => l.id === activeId);
        if (!layer || layer.type !== 'raster') return;
        const raster = layer as RasterLayer;
        if (!raster.imageData) return;

        const vp = getViewport();
        const docPt = vp.screenToDocument({
          x: localX,
          y: localY,
        });
        const lx = Math.round(docPt.x - raster.position.x);
        const ly = Math.round(docPt.y - raster.position.y);
        const dabFn = tool === 'dodge' ? dodgeDab : burnDab;
        dabFn(raster.imageData, lx, ly, {
          size: state.brushSize,
          hardness: state.brushHardness,
          exposure: state.brushOpacity,
        }, 'midtones');
        scheduleRender();
      }
    },
    [document, setPanOffset, scheduleRender],
  );

  /** Handle mouse up for pan end, brush commit, or drag-tool finalize. */
  const handleMouseUp = useCallback(
    (e: React.MouseEvent): void => {
      if (isPanning.current) {
        isPanning.current = false;
        // Restore cursor: grab if Space still held, else clear
        setPanCursor(spacePanState.isSpacePressed ? 'grab' : null);
      }

      // Brush commit (APP-014)
      if (brushEngine.isActive) {
        const result = brushEngine.endStroke();
        if (result) {
          const { selectedLayerId, commitBrushStroke } = useAppStore.getState();
          if (selectedLayerId) {
            commitBrushStroke(selectedLayerId, result.region, result.oldPixels, result.newPixels);
          }
        }
      }

      // Gradient tool — finalize drag
      if (isDragging.current && dragStart.current && document) {
        const state = useAppStore.getState();
        const tool = state.activeTool;

        if (tool === 'gradient') {
          const activeId = state.selectedLayerId;
          if (activeId) {
            const allLayers = flattenLayers(document.rootGroup);
            const layer = allLayers.find((l) => l.id === activeId);
            if (layer && layer.type === 'raster') {
              const raster = layer as RasterLayer;
              if (raster.imageData) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const vp = getViewport();
                const endPt = vp.screenToDocument({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
                const startPt = dragStart.current;
                const c = state.brushColor;
                const bg = state.backgroundColor;
                const gsx = Math.round(startPt.x - raster.position.x);
                const gsy = Math.round(startPt.y - raster.position.y);
                const gex = Math.round(endPt.x - raster.position.x);
                const gey = Math.round(endPt.y - raster.position.y);
                const gradDef = createTwoColorGradient(
                  state.gradientType as GradientType,
                  gsx, gsy, gex, gey,
                  { r: c.r, g: c.g, b: c.b, a: Math.round(c.a * 255) },
                  { r: bg.r, g: bg.g, b: bg.b, a: Math.round(bg.a * 255) },
                );
                state.applyFilter((img) => renderGradient(img, gradDef));
                scheduleRender();
              }
            }
          }
        }

        // Shape tool — finalize drag
        if (tool === 'shape') {
          const activeId = state.selectedLayerId;
          if (activeId) {
            const allLayers = flattenLayers(document.rootGroup);
            const layer = allLayers.find((l) => l.id === activeId);
            if (layer && layer.type === 'raster') {
              const raster = layer as RasterLayer;
              if (raster.imageData) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const vp = getViewport();
                const endPt = vp.screenToDocument({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
                const startPt = dragStart.current;
                const c = state.brushColor;
                const color = { r: c.r, g: c.g, b: c.b, a: Math.round(c.a * 255) };
                const sx = Math.round(startPt.x - raster.position.x);
                const sy = Math.round(startPt.y - raster.position.y);
                const ex = Math.round(endPt.x - raster.position.x);
                const ey = Math.round(endPt.y - raster.position.y);
                const shapeType = state.shapeType;

                state.applyFilter((img) => {
                  const x = Math.min(sx, ex);
                  const y = Math.min(sy, ey);
                  const w = Math.abs(ex - sx);
                  const h = Math.abs(ey - sy);
                  if (shapeType === 'rectangle') {
                    return drawRectangle(img, x, y, w, h, color, {
                      lineWidth: state.brushSize,
                    });
                  } else if (shapeType === 'ellipse') {
                    const cx = (sx + ex) / 2;
                    const cy2 = (sy + ey) / 2;
                    const rx = w / 2;
                    const ry = h / 2;
                    return drawEllipse(img, cx, cy2, rx, ry, color, {
                      lineWidth: state.brushSize,
                    });
                  } else if (shapeType === 'line') {
                    return drawLine(img, sx, sy, ex, ey, color, state.brushSize);
                  }
                  return img;
                });
                scheduleRender();
              }
            }
          }
        }
      }

      // Dodge/Burn commit
      if (dodgeBurnActive.current && dodgeBurnSnapshot.current && document) {
        const state = useAppStore.getState();
        const activeId = state.selectedLayerId;
        if (activeId) {
          const allLayers = flattenLayers(document.rootGroup);
          const layer = allLayers.find((l) => l.id === activeId);
          if (layer && layer.type === 'raster') {
            const raster = layer as RasterLayer;
            if (raster.imageData) {
              state.commitBrushStroke(activeId, {
                x: 0, y: 0, width: raster.bounds.width, height: raster.bounds.height,
              }, dodgeBurnSnapshot.current, new Uint8ClampedArray(raster.imageData.data));
            }
          }
        }
        dodgeBurnActive.current = false;
        dodgeBurnSnapshot.current = null;
      }

      dragStart.current = null;
      isDragging.current = false;
    },
    [document, scheduleRender],
  );

  const isBrushTool = activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'clone';
  const cursorDiameter = brushSize * zoom;
  const isEyedropper = activeTool === 'eyedropper';
  const isSelectionTool = activeTool === 'select' || activeTool === 'crop';
  const isCrosshair = activeTool === 'gradient' || activeTool === 'shape' || activeTool === 'fill' || isSelectionTool;
  const isTextTool = activeTool === 'text';

  // Pan cursor class takes priority over tool cursor (PS-PAN-001)
  const panClass = panCursor === 'grabbing' ? 'canvas-area--panning' : panCursor === 'grab' ? 'canvas-area--space-held' : '';
  const textClass = isTextTool && !panCursor ? 'canvas-area--text-tool' : '';
  const className = ['canvas-area', panClass, textClass].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      className={className}
      style={panCursor ? undefined : isBrushTool ? { cursor: 'none' } : isTextTool ? { cursor: 'text' } : isCrosshair ? { cursor: 'crosshair' } : isEyedropper ? { cursor: 'crosshair' } : undefined}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {document ? (
        <>
          <canvas
            ref={canvasRef}
            className="editor-canvas"
          />
          <TransformHandles />
          <SelectionOverlay />
          <CutoutTool />
          {isBrushTool && (
            <div
              ref={cursorRef}
              className="brush-cursor"
              style={{
                width: `${cursorDiameter}px`,
                height: `${cursorDiameter}px`,
              }}
            />
          )}
        </>
      ) : (
        <div className="canvas-empty">
          <p>{t('canvas.noDocumentOpen')}</p>
          <button
            className="canvas-empty__new-btn"
            onClick={(): void => useAppStore.getState().openNewDocumentDialog()}
          >
            {t('canvas.newDocument')}
          </button>
        </div>
      )}
    </div>
  );
}
