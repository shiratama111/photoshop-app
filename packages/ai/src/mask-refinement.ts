/**
 * @module mask-refinement
 * Pure pixel operations for mask refinement: brush editing, feathering, and boundary adjustment.
 *
 * All functions operate on single-channel Uint8Array masks (0-255)
 * and return new arrays (no mutation of inputs).
 *
 * @see AI-002: Mask Refinement Tool
 * @see {@link @photoshop-app/types!MaskRefinementOptions}
 * @see {@link @photoshop-app/types!Mask}
 */

import type { Point, Size } from '@photoshop-app/types';

/** Brush mode: add paints foreground, remove paints background. */
export type BrushMode = 'add' | 'remove';

/** Configuration for a mask brush stroke. */
export interface BrushConfig {
  /** Brush radius in pixels. Must be >= 1. */
  radius: number;
  /** Edge hardness from 0 (soft/Gaussian falloff) to 1 (hard edge). */
  hardness: number;
  /** Whether the brush adds to or removes from the mask. */
  mode: BrushMode;
}

/**
 * Apply a brush stroke to a mask along a series of points.
 * Each point stamps a circular brush onto the mask.
 *
 * @param mask - Source mask data (single-channel, 0-255).
 * @param size - Mask dimensions.
 * @param points - Stroke path in mask coordinates.
 * @param config - Brush configuration.
 * @returns New mask data with the stroke applied.
 */
export function applyBrushStroke(
  mask: Uint8Array,
  size: Size,
  points: Point[],
  config: BrushConfig,
): Uint8Array {
  if (points.length === 0) {
    return new Uint8Array(mask);
  }

  const result = new Uint8Array(mask);
  const { radius, hardness, mode } = config;
  const r = Math.max(1, Math.round(radius));
  const targetValue = mode === 'add' ? 255 : 0;

  // Pre-compute brush kernel (radial falloff)
  const kernelSize = r * 2 + 1;
  const kernel = new Float32Array(kernelSize * kernelSize);
  for (let ky = 0; ky < kernelSize; ky++) {
    for (let kx = 0; kx < kernelSize; kx++) {
      const dx = kx - r;
      const dy = ky - r;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) {
        kernel[ky * kernelSize + kx] = 0;
      } else {
        // Hardness controls falloff: 1 = hard edge, 0 = linear falloff
        const normalizedDist = dist / r;
        const falloff = hardness < 1
          ? 1 - Math.pow(normalizedDist, 1 / (1 - hardness + 0.01))
          : normalizedDist <= 1 ? 1 : 0;
        kernel[ky * kernelSize + kx] = Math.max(0, Math.min(1, falloff));
      }
    }
  }

  for (const point of points) {
    const cx = Math.round(point.x);
    const cy = Math.round(point.y);

    for (let ky = 0; ky < kernelSize; ky++) {
      const py = cy - r + ky;
      if (py < 0 || py >= size.height) continue;

      for (let kx = 0; kx < kernelSize; kx++) {
        const px = cx - r + kx;
        if (px < 0 || px >= size.width) continue;

        const strength = kernel[ky * kernelSize + kx];
        if (strength <= 0) continue;

        const idx = py * size.width + px;
        const current = result[idx];
        // Blend toward target value based on brush strength
        result[idx] = Math.round(current + (targetValue - current) * strength);
      }
    }
  }

  return result;
}

/**
 * Apply Gaussian feathering (blur) to a mask.
 * Uses a two-pass separable Gaussian for efficiency.
 *
 * @param mask - Source mask data (single-channel, 0-255).
 * @param size - Mask dimensions.
 * @param radius - Blur radius in pixels (sigma = radius / 3). Must be >= 1.
 * @returns New mask data with feathered edges.
 */
export function featherMask(
  mask: Uint8Array,
  size: Size,
  radius: number,
): Uint8Array {
  if (radius < 1) {
    return new Uint8Array(mask);
  }

  const r = Math.round(radius);
  const sigma = r / 3;

  // Build 1D Gaussian kernel
  const kernelSize = r * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - r;
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = value;
    sum += value;
  }
  // Normalize
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  const { width, height } = size;

  // Horizontal pass
  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = 0; k < kernelSize; k++) {
        const sx = x - r + k;
        const clampedX = Math.max(0, Math.min(width - 1, sx));
        acc += mask[y * width + clampedX] * kernel[k];
      }
      temp[y * width + x] = acc;
    }
  }

  // Vertical pass
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = 0; k < kernelSize; k++) {
        const sy = y - r + k;
        const clampedY = Math.max(0, Math.min(height - 1, sy));
        acc += temp[clampedY * width + x] * kernel[k];
      }
      result[y * width + x] = Math.max(0, Math.min(255, Math.round(acc)));
    }
  }

  return result;
}

/**
 * Expand or contract the mask boundary using morphological operations.
 * Positive amount = dilate (expand), negative amount = erode (contract).
 * Uses a circular structuring element.
 *
 * @param mask - Source mask data (single-channel, 0-255).
 * @param size - Mask dimensions.
 * @param amount - Pixels to expand (positive) or contract (negative).
 * @returns New mask data with adjusted boundary.
 */
export function adjustBoundary(
  mask: Uint8Array,
  size: Size,
  amount: number,
): Uint8Array {
  if (amount === 0) {
    return new Uint8Array(mask);
  }

  const absAmount = Math.round(Math.abs(amount));
  const isDilate = amount > 0;
  const { width, height } = size;

  // Build circular structuring element offsets
  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -absAmount; dy <= absAmount; dy++) {
    for (let dx = -absAmount; dx <= absAmount; dx++) {
      if (dx * dx + dy * dy <= absAmount * absAmount) {
        offsets.push({ dx, dy });
      }
    }
  }

  // Binarize input: threshold at 128
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    binary[i] = mask[i] >= 128 ? 255 : 0;
  }

  const result = new Uint8Array(width * height);

  if (isDilate) {
    // Dilate: output pixel is 255 if ANY pixel in the structuring element is 255
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let found = false;
        for (const { dx, dy } of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (binary[ny * width + nx] === 255) {
              found = true;
              break;
            }
          }
        }
        result[y * width + x] = found ? 255 : 0;
      }
    }
  } else {
    // Erode: output pixel is 255 only if ALL pixels in the structuring element are 255
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let allForeground = true;
        for (const { dx, dy } of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            allForeground = false;
            break;
          }
          if (binary[ny * width + nx] === 0) {
            allForeground = false;
            break;
          }
        }
        result[y * width + x] = allForeground ? 255 : 0;
      }
    }
  }

  return result;
}
