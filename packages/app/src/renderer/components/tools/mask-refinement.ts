/**
 * @module mask-refinement
 * Pure pixel-level operations for mask refinement.
 *
 * Provides brush painting, morphological operations (dilate/erode),
 * feathering (Gaussian blur), and contour extraction — all operating
 * on Uint8Array binary masks (0 = background, 255 = foreground).
 *
 * @see APP-006: AI cutout UI
 * @see AI-002: Mask refinement tools
 */

import type { Size } from '@photoshop-app/types';

/**
 * Paint a filled circle onto the mask at the given center.
 * Mutates the mask in-place.
 *
 * @param mask - Binary mask (0/255).
 * @param size - Mask dimensions.
 * @param cx - Circle center X.
 * @param cy - Circle center Y.
 * @param radius - Circle radius in pixels.
 * @param value - 255 (foreground) or 0 (background).
 * @returns The same mask reference (for chaining).
 */
export function paintBrush(
  mask: Uint8Array,
  size: Size,
  cx: number,
  cy: number,
  radius: number,
  value: 0 | 255,
): Uint8Array {
  const r2 = radius * radius;
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size.height - 1, Math.ceil(cy + radius));
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size.width - 1, Math.ceil(cx + radius));

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) {
        mask[y * size.width + x] = value;
      }
    }
  }
  return mask;
}

/**
 * Paint along a line between two points using Bresenham's algorithm.
 * Calls paintBrush at each step for smooth strokes.
 *
 * @param mask - Binary mask (0/255).
 * @param size - Mask dimensions.
 * @param x0 - Start X.
 * @param y0 - Start Y.
 * @param x1 - End X.
 * @param y1 - End Y.
 * @param radius - Brush radius.
 * @param value - 255 or 0.
 * @returns The same mask reference.
 */
export function paintBrushLine(
  mask: Uint8Array,
  size: Size,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  value: 0 | 255,
): Uint8Array {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0;
  let cy = y0;

  for (;;) {
    paintBrush(mask, size, cx, cy, radius, value);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return mask;
}

/**
 * Dilate the mask by the given radius (expand foreground).
 * Returns a new mask; the original is not modified.
 */
export function dilateMask(mask: Uint8Array, size: Size, radius: number): Uint8Array {
  const result = new Uint8Array(mask);
  if (radius <= 0) return result;

  const r = Math.round(radius);
  const r2 = r * r;
  const { width, height } = size;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 255) continue; // already foreground
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (dx * dx + dy * dy > r2) continue;
          if (mask[ny * width + nx] === 255) {
            result[y * width + x] = 255;
            found = true;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Erode the mask by the given radius (contract foreground).
 * Returns a new mask; the original is not modified.
 */
export function erodeMask(mask: Uint8Array, size: Size, radius: number): Uint8Array {
  const result = new Uint8Array(mask);
  if (radius <= 0) return result;

  const r = Math.round(radius);
  const r2 = r * r;
  const { width, height } = size;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 0) continue; // already background
      let allForeground = true;
      for (let dy = -r; dy <= r && allForeground; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) { allForeground = false; continue; }
        for (let dx = -r; dx <= r && allForeground; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) { allForeground = false; continue; }
          if (dx * dx + dy * dy > r2) continue;
          if (mask[ny * width + nx] === 0) {
            allForeground = false;
          }
        }
      }
      if (!allForeground) {
        result[y * width + x] = 0;
      }
    }
  }
  return result;
}

/**
 * Adjust the mask boundary.
 * Positive values dilate (expand), negative values erode (contract).
 * Returns a new mask.
 */
export function adjustBoundary(mask: Uint8Array, size: Size, pixels: number): Uint8Array {
  if (pixels > 0) return dilateMask(mask, size, pixels);
  if (pixels < 0) return erodeMask(mask, size, -pixels);
  return new Uint8Array(mask);
}

/**
 * Apply Gaussian-like feathering to the mask edges.
 * Uses box blur approximation. Returns a new mask (values 0..255).
 * The original is not modified.
 */
export function featherMask(mask: Uint8Array, size: Size, radius: number): Uint8Array {
  const result = new Uint8Array(mask);
  if (radius <= 0) return result;

  const r = Math.round(radius);
  const { width, height } = size;
  const temp = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += mask[y * width + nx];
          count++;
        }
      }
      temp[y * width + x] = sum / count;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += temp[ny * width + x];
          count++;
        }
      }
      result[y * width + x] = Math.round(sum / count);
    }
  }

  return result;
}

/**
 * Extract the contour (boundary) pixels of the foreground region.
 * A pixel is on the contour if it is foreground and has at least one
 * background neighbor (4-connected) or is on the mask edge.
 */
export function extractContour(
  mask: Uint8Array,
  size: Size,
): Array<{ x: number; y: number }> {
  const { width, height } = size;
  const contour: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 255) continue;

      // Check if on mask edge
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        contour.push({ x, y });
        continue;
      }

      // Check 4-connected neighbors
      if (
        mask[(y - 1) * width + x] === 0 ||
        mask[(y + 1) * width + x] === 0 ||
        mask[y * width + (x - 1)] === 0 ||
        mask[y * width + (x + 1)] === 0
      ) {
        contour.push({ x, y });
      }
    }
  }

  return contour;
}
