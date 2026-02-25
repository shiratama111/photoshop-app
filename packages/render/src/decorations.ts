/**
 * @module decorations
 * Decoration rendering utilities for manga-style effects on canvas.
 *
 * Provides high-level rendering functions that draw procedural effects
 * (such as concentration lines) onto a Canvas2D context with support
 * for blend modes and opacity.
 *
 * @see @photoshop-app/core/procedural - Core generation functions
 * @see DECO-001 - Concentration lines ticket
 */

import {
  generateConcentrationLines,
} from '@photoshop-app/core';
import type { ConcentrationLinesConfig } from '@photoshop-app/core';

export type { ConcentrationLinesConfig };

/** Options for controlling how concentration lines are composited onto the canvas. */
export interface ConcentrationLinesRenderOptions {
  /**
   * Canvas composite operation (blend mode).
   * @default 'source-over'
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
   */
  blendMode?: GlobalCompositeOperation;
  /**
   * Opacity of the rendered effect (0-1).
   * @default 1
   */
  opacity?: number;
}

/**
 * Render concentration lines (manga-style radial speed lines) onto a canvas context.
 *
 * Generates the concentration lines image using the core procedural generator,
 * then composites it onto the provided canvas context with optional blend mode
 * and opacity settings.
 *
 * Note: Because `putImageData` bypasses compositing, this function draws onto
 * a temporary offscreen canvas first, then uses `drawImage` to composite with
 * the specified blend mode and opacity.
 *
 * The caller's context state (globalAlpha, globalCompositeOperation) is saved
 * and restored after rendering.
 *
 * @param ctx - The 2D rendering context to draw onto
 * @param config - Concentration lines configuration (center, line count, widths, etc.)
 * @param options - Optional blend mode and opacity overrides
 */
export function renderConcentrationLines(
  ctx: CanvasRenderingContext2D,
  config: ConcentrationLinesConfig,
  options?: ConcentrationLinesRenderOptions,
): void {
  const blendMode = options?.blendMode ?? 'source-over';
  const opacity = options?.opacity ?? 1;

  // Generate the concentration lines pixel data
  const imageData = generateConcentrationLines(config);

  // Save context state to avoid side effects on the caller
  ctx.save();

  // putImageData ignores globalAlpha and globalCompositeOperation, so we must
  // render to a temporary offscreen canvas and then drawImage with compositing.
  const offscreen = ctx.canvas.ownerDocument.createElement('canvas');
  offscreen.width = config.canvasWidth;
  offscreen.height = config.canvasHeight;
  const offCtx = offscreen.getContext('2d');
  if (offCtx) {
    offCtx.putImageData(imageData, 0, 0);
  }

  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = opacity;
  ctx.drawImage(offscreen, 0, 0);

  // Restore original context state
  ctx.restore();
}
