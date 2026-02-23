/**
 * @module brush-engine
 * Self-contained brush painting engine for raster layers.
 *
 * Provides stroke-based painting with:
 * - Bresenham line interpolation between sample points
 * - Circular brush tips with configurable hardness falloff
 * - Configurable spacing (fraction of brush diameter)
 * - Eraser mode (destination-out blending)
 * - Undo-friendly output: returns old/new pixel snapshots per stroke
 *
 * @see APP-013: Brush drawing engine
 * @see https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
 */

import type { Rect } from '@photoshop-app/types';

/** 2D point for brush input. */
export interface BrushPoint {
  x: number;
  y: number;
  /** Pressure (0-1). Defaults to 1 if not provided. */
  pressure?: number;
}

/** Options for a brush stroke. */
export interface BrushStrokeOptions {
  /** Brush diameter in pixels. */
  size: number;
  /** Hardness (0 = soft, 1 = hard). Controls falloff from center to edge. */
  hardness: number;
  /** Opacity (0-1). */
  opacity: number;
  /** Brush color RGBA. */
  color: { r: number; g: number; b: number; a: number };
  /** Spacing as a fraction of diameter (0.05 - 1). Default 0.25. */
  spacing?: number;
  /** Whether this is an eraser stroke. */
  eraser?: boolean;
}

/** Result of completing a brush stroke. */
export interface BrushStrokeResult {
  /** Bounding rectangle of the affected area. */
  region: Rect;
  /** Original pixel data before the stroke (RGBA, region-sized). */
  oldPixels: Uint8ClampedArray;
  /** New pixel data after the stroke (RGBA, region-sized). */
  newPixels: Uint8ClampedArray;
}
/**
 * BrushEngine -- manages a single brush stroke on an ImageData buffer.
 *
 * Usage:
 * ```ts
 * const engine = new BrushEngine();
 * engine.startStroke(imageData, point, options);
 * engine.continueStroke(point);
 * // ... more points
 * const result = engine.endStroke();
 * // result contains old/new pixel data for undo
 * ```
 */
export class BrushEngine {
  private imageData: ImageData | null = null;
  private options: BrushStrokeOptions | null = null;
  private lastPoint: BrushPoint | null = null;
  private distanceSinceLastDab = 0;
  private dirtyBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private originalSnapshot: Uint8ClampedArray | null = null;
  private active = false;

  /** Whether a stroke is currently active. */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Begin a new brush stroke.
   * @param imageData - The target ImageData to paint on (modified in place).
   * @param point - Starting point of the stroke.
   * @param options - Brush settings for this stroke.
   */
  startStroke(imageData: ImageData, point: BrushPoint, options: BrushStrokeOptions): void {
    this.imageData = imageData;
    this.options = options;
    this.lastPoint = point;
    this.distanceSinceLastDab = 0;
    this.active = true;

    // Snapshot the full image for undo
    this.originalSnapshot = new Uint8ClampedArray(imageData.data);

    // Reset dirty bounds
    this.dirtyBounds = null;

    // Place the first dab
    this.placeDab(point);
  }

  /**
   * Continue the stroke to a new point.
   * Interpolates between the last point and the new point,
   * placing dabs at spacing intervals.
   */
  continueStroke(point: BrushPoint): void {
    if (!this.active || !this.lastPoint || !this.options || !this.imageData) return;

    const spacing = (this.options.spacing ?? 0.25) * this.options.size;
    const minSpacing = Math.max(1, spacing);

    // Interpolate between lastPoint and current point
    const dx = point.x - this.lastPoint.x;
    const dy = point.y - this.lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.5) {
      this.lastPoint = point;
      return;
    }

    let t = this.distanceSinceLastDab > 0 ? (minSpacing - this.distanceSinceLastDab) / dist : 0;

    if (t < 0) t = 0;

    while (t <= 1) {
      const interpX = this.lastPoint.x + dx * t;
      const interpY = this.lastPoint.y + dy * t;
      const interpPressure =
        (this.lastPoint.pressure ?? 1) * (1 - t) + (point.pressure ?? 1) * t;

      this.placeDab({ x: interpX, y: interpY, pressure: interpPressure });
      t += minSpacing / dist;
    }

    this.distanceSinceLastDab = dist - (t - minSpacing / dist) * dist;
    if (this.distanceSinceLastDab < 0) this.distanceSinceLastDab = 0;

    this.lastPoint = point;
  }

  /**
   * End the current stroke and return the result for undo.
   * Returns null if no pixels were modified.
   */
  endStroke(): BrushStrokeResult | null {
    if (!this.active || !this.imageData || !this.originalSnapshot || !this.dirtyBounds) {
      this.reset();
      return null;
    }

    const { minX, minY, maxX, maxY } = this.dirtyBounds;
    const w = this.imageData.width;

    // Clamp to image bounds
    const x0 = Math.max(0, minX);
    const y0 = Math.max(0, minY);
    const x1 = Math.min(w - 1, maxX);
    const y1 = Math.min(this.imageData.height - 1, maxY);

    const regionW = x1 - x0 + 1;
    const regionH = y1 - y0 + 1;

    if (regionW <= 0 || regionH <= 0) {
      this.reset();
      return null;
    }

    // Extract old and new pixels for the dirty region
    const oldPixels = new Uint8ClampedArray(regionW * regionH * 4);
    const newPixels = new Uint8ClampedArray(regionW * regionH * 4);

    for (let row = 0; row < regionH; row++) {
      const srcOffset = ((y0 + row) * w + x0) * 4;
      const dstOffset = row * regionW * 4;
      oldPixels.set(this.originalSnapshot.subarray(srcOffset, srcOffset + regionW * 4), dstOffset);
      newPixels.set(this.imageData.data.subarray(srcOffset, srcOffset + regionW * 4), dstOffset);
    }

    const result: BrushStrokeResult = {
      region: { x: x0, y: y0, width: regionW, height: regionH },
      oldPixels,
      newPixels,
    };

    this.reset();
    return result;
  }

  /** Reset internal state. */
  private reset(): void {
    this.imageData = null;
    this.options = null;
    this.lastPoint = null;
    this.distanceSinceLastDab = 0;
    this.dirtyBounds = null;
    this.originalSnapshot = null;
    this.active = false;
  }

  /**
   * Place a single circular brush dab at the given point.
   */
  private placeDab(point: BrushPoint): void {
    if (!this.imageData || !this.options) return;

    const { size, hardness, opacity, color, eraser } = this.options;
    const pressure = point.pressure ?? 1;
    const radius = (size * pressure) / 2;
    if (radius < 0.5) return;

    const w = this.imageData.width;
    const h = this.imageData.height;
    const data = this.imageData.data;

    const cx = Math.round(point.x);
    const cy = Math.round(point.y);
    const r = Math.ceil(radius);

    const startX = Math.max(0, cx - r);
    const startY = Math.max(0, cy - r);
    const endX = Math.min(w - 1, cx + r);
    const endY = Math.min(h - 1, cy + r);

    // Update dirty bounds
    this.expandDirtyBounds(startX, startY, endX, endY);

    for (let py = startY; py <= endY; py++) {
      for (let px = startX; px <= endX; px++) {
        const dx = px - point.x;
        const dy = py - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) continue;

        // Calculate falloff based on hardness
        let alpha = opacity * pressure;
        if (hardness < 1 && radius > 0) {
          const normalizedDist = dist / radius;
          const softStart = hardness;
          if (normalizedDist > softStart) {
            alpha *= 1 - (normalizedDist - softStart) / (1 - softStart);
          }
        }

        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha < 0.004) continue; // Skip nearly invisible pixels (< 1/255)

        const idx = (py * w + px) * 4;

        if (eraser) {
          // Eraser: reduce alpha
          const currentA = data[idx + 3] / 255;
          const newA = Math.max(0, currentA - alpha);
          data[idx + 3] = Math.round(newA * 255);
        } else {
          // Normal brush: alpha composite
          const srcR = color.r;
          const srcG = color.g;
          const srcB = color.b;
          const srcA = alpha * color.a;

          const dstR = data[idx];
          const dstG = data[idx + 1];
          const dstB = data[idx + 2];
          const dstA = data[idx + 3] / 255;

          const outA = srcA + dstA * (1 - srcA);
          if (outA > 0) {
            data[idx] = Math.round((srcR * srcA + dstR * dstA * (1 - srcA)) / outA);
            data[idx + 1] = Math.round((srcG * srcA + dstG * dstA * (1 - srcA)) / outA);
            data[idx + 2] = Math.round((srcB * srcA + dstB * dstA * (1 - srcA)) / outA);
            data[idx + 3] = Math.round(outA * 255);
          }
        }
      }
    }
  }

  /** Expand dirty bounds to include the given rectangle. */
  private expandDirtyBounds(x0: number, y0: number, x1: number, y1: number): void {
    if (!this.dirtyBounds) {
      this.dirtyBounds = { minX: x0, minY: y0, maxX: x1, maxY: y1 };
    } else {
      this.dirtyBounds.minX = Math.min(this.dirtyBounds.minX, x0);
      this.dirtyBounds.minY = Math.min(this.dirtyBounds.minY, y0);
      this.dirtyBounds.maxX = Math.max(this.dirtyBounds.maxX, x1);
      this.dirtyBounds.maxY = Math.max(this.dirtyBounds.maxY, y1);
    }
  }
}
