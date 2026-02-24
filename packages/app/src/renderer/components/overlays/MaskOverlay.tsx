/**
 * @module MaskOverlay
 * Canvas overlay that renders the AI cutout mask visualization.
 *
 * Features:
 * - Semi-transparent mask overlay (red tint for excluded areas)
 * - Marching ants animation along mask boundary
 * - Point prompt indicators (green +, red -)
 * - Brush cursor when in brush mode
 *
 * @see APP-006: AI cutout UI
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { Mask, PointPrompt, Size } from '@photoshop-app/types';
import { extractContour } from '../tools/mask-refinement';

/** Props for MaskOverlay component. */
interface MaskOverlayProps {
  /** Current segmentation mask, or null. */
  mask: Mask | null;
  /** Point prompts to display. */
  prompts: PointPrompt[];
  /** Canvas/document size. */
  canvasSize: Size;
  /** Current zoom level. */
  zoom: number;
  /** Current pan offset. */
  panOffset: { x: number; y: number };
  /** Whether brush interaction is active. */
  brushActive: boolean;
  /** Current brush size (radius). */
  brushSize: number;
  /** Mouse down handler for cutout interactions. */
  onCanvasMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse move handler for cutout interactions. */
  onCanvasMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse up handler for cutout interactions. */
  onCanvasMouseUp?: () => void;
}

/** Marching ants animation offset. */
let marchingAntsOffset = 0;

/** Draw the semi-transparent mask overlay. */
function drawMaskOverlay(
  ctx: CanvasRenderingContext2D,
  mask: Mask,
  zoom: number,
  panOffset: { x: number; y: number },
): void {
  const { width, height } = mask.size;
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  for (let i = 0; i < mask.data.length; i++) {
    const idx = i * 4;
    if (mask.data[i] === 0) {
      // Background: red tint
      pixels[idx] = 255;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 80;
    } else {
      // Foreground: transparent
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 0;
    }
  }

  // Create temp canvas for the mask
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  // Draw scaled and offset
  ctx.drawImage(
    tempCanvas,
    panOffset.x,
    panOffset.y,
    width * zoom,
    height * zoom,
  );
}

/** Draw marching ants along the mask contour. */
function drawMarchingAnts(
  ctx: CanvasRenderingContext2D,
  mask: Mask,
  zoom: number,
  panOffset: { x: number; y: number },
): void {
  const contour = extractContour(mask.data, mask.size);
  if (contour.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = marchingAntsOffset;

  ctx.beginPath();
  for (const { x, y } of contour) {
    const px = panOffset.x + x * zoom;
    const py = panOffset.y + y * zoom;
    ctx.rect(px, py, zoom, zoom);
  }
  ctx.stroke();

  ctx.strokeStyle = '#fff';
  ctx.lineDashOffset = marchingAntsOffset + 4;
  ctx.beginPath();
  for (const { x, y } of contour) {
    const px = panOffset.x + x * zoom;
    const py = panOffset.y + y * zoom;
    ctx.rect(px, py, zoom, zoom);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw point prompt indicators. */
function drawPrompts(
  ctx: CanvasRenderingContext2D,
  prompts: PointPrompt[],
  zoom: number,
  panOffset: { x: number; y: number },
): void {
  const size = Math.max(6, 4 * zoom);

  for (const prompt of prompts) {
    const px = panOffset.x + prompt.position.x * zoom;
    const py = panOffset.y + prompt.position.y * zoom;
    const isPositive = prompt.label === 'positive';

    ctx.save();
    ctx.fillStyle = isPositive ? '#00ff00' : '#ff0000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;

    // Circle
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cross/X symbol
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (isPositive) {
      // Plus sign
      ctx.moveTo(px - size * 0.6, py);
      ctx.lineTo(px + size * 0.6, py);
      ctx.moveTo(px, py - size * 0.6);
      ctx.lineTo(px, py + size * 0.6);
    } else {
      // Minus sign
      ctx.moveTo(px - size * 0.6, py);
      ctx.lineTo(px + size * 0.6, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** MaskOverlay renders the cutout mask visualization on a canvas. */
export function MaskOverlay({
  mask,
  prompts,
  canvasSize,
  zoom,
  panOffset,
  brushActive,
  brushSize,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
}: MaskOverlayProps): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number }>({
    width: 1,
    height: 1,
  });

  /** Main render loop. */
  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mask) {
      drawMaskOverlay(ctx, mask, zoom, panOffset);
      drawMarchingAnts(ctx, mask, zoom, panOffset);
    }

    if (prompts.length > 0) {
      drawPrompts(ctx, prompts, zoom, panOffset);
    }

    // Brush cursor
    if (brushActive && mouseRef.current) {
      const { x, y } = mouseRef.current;
      const r = brushSize * zoom;
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#000';
      ctx.lineDashOffset = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Advance marching ants
    marchingAntsOffset = (marchingAntsOffset + 0.5) % 16;
    animRef.current = requestAnimationFrame(render);
  }, [mask, prompts, zoom, panOffset, brushActive, brushSize]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return (): void => cancelAnimationFrame(animRef.current);
  }, [render]);

  // Keep the overlay bitmap size in sync with the visible canvas area.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement as HTMLElement | null;
    if (!canvas || !parent) return;

    const updateSize = (): void => {
      const fallbackWidth = Math.max(1, Math.ceil(canvasSize.width * zoom));
      const fallbackHeight = Math.max(1, Math.ceil(canvasSize.height * zoom));
      const width = Math.max(1, Math.floor(parent.clientWidth || fallbackWidth));
      const height = Math.max(1, Math.floor(parent.clientHeight || fallbackHeight));

      setOverlaySize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(parent);
    window.addEventListener('resize', updateSize);
    return (): void => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [canvasSize.width, canvasSize.height, zoom]);

  /** Track mouse for brush cursor. */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      onCanvasMouseMove?.(e);
    },
    [onCanvasMouseMove],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      onCanvasMouseDown?.(e);
    },
    [onCanvasMouseDown],
  );

  const handleMouseUp = useCallback((): void => {
    onCanvasMouseUp?.();
  }, [onCanvasMouseUp]);

  const handleMouseLeave = useCallback((): void => {
    mouseRef.current = null;
    onCanvasMouseUp?.();
  }, [onCanvasMouseUp]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`mask-overlay ${brushActive ? 'mask-overlay--brush mask-overlay--interactive' : 'mask-overlay--interactive'}`}
      width={overlaySize.width}
      height={overlaySize.height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
