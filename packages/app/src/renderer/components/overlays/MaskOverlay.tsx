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

import React, { useRef, useEffect, useCallback } from 'react';
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
  /** Click handler for point prompt mode. */
  onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse down handler for brush mode. */
  onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse drag handler for brush mode. */
  onBrushMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Mouse up handler for brush mode. */
  onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
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
  onClick,
  onMouseDown,
  onBrushMove,
  onMouseUp,
}: MaskOverlayProps): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

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

  /** Track mouse for brush cursor and forward brush move events. */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>): void => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    onBrushMove?.(e);
  }, [onBrushMove]);

  const handleMouseLeave = useCallback((): void => {
    mouseRef.current = null;
  }, []);

  // Size the overlay to match the canvas container
  const containerWidth = canvasSize.width * zoom + panOffset.x * 2;
  const containerHeight = canvasSize.height * zoom + panOffset.y * 2;

  return (
    <canvas
      ref={canvasRef}
      className={`mask-overlay ${brushActive ? 'mask-overlay--brush mask-overlay--interactive' : 'mask-overlay--interactive'}`}
      width={Math.max(1, Math.ceil(containerWidth))}
      height={Math.max(1, Math.ceil(containerHeight))}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
