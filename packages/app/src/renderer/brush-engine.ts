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

/** Brush variant identifier (APP-016). */
export type BrushVariantId = 'soft' | 'pencil' | 'airbrush' | 'marker';

/** Configuration for a brush variant (APP-016). */
export interface BrushVariantConfig {
  id: BrushVariantId;
  label: string;
  /** false = pixel-boundary only (no anti-alias falloff). */
  antiAlias: boolean;
  pressureAffectsSize: boolean;
  pressureAffectsOpacity: boolean;
  /** true = keeps painting while the cursor is stationary. */
  accumulates: boolean;
  accumulationIntervalMs: number;
  /** null = use user setting; number = override. */
  hardnessOverride: number | null;
  minSize: number;
}

/** Predefined brush variant configs (APP-016). */
export const BRUSH_VARIANTS: Record<BrushVariantId, BrushVariantConfig> = {
  soft: {
    id: 'soft',
    label: 'Soft',
    antiAlias: true,
    pressureAffectsSize: true,
    pressureAffectsOpacity: false,
    accumulates: false,
    accumulationIntervalMs: 0,
    hardnessOverride: null,
    minSize: 1,
  },
  pencil: {
    id: 'pencil',
    label: 'Pencil',
    antiAlias: false,
    pressureAffectsSize: false,
    pressureAffectsOpacity: false,
    accumulates: false,
    accumulationIntervalMs: 0,
    hardnessOverride: 1.0,
    minSize: 1,
  },
  airbrush: {
    id: 'airbrush',
    label: 'Airbrush',
    antiAlias: true,
    pressureAffectsSize: true,
    pressureAffectsOpacity: true,
    accumulates: true,
    accumulationIntervalMs: 50,
    hardnessOverride: null,
    minSize: 1,
  },
  marker: {
    id: 'marker',
    label: 'Marker',
    antiAlias: true,
    pressureAffectsSize: false,
    pressureAffectsOpacity: false,
    accumulates: false,
    accumulationIntervalMs: 0,
    hardnessOverride: 0.85,
    minSize: 1,
  },
};

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
  /** Brush variant config (APP-016). */
  variant?: BrushVariantConfig;
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
  /** Last dab point for accumulation repeats (APP-016). */
  private lastDabPoint: BrushPoint | null = null;
  /** Accumulation interval timer (APP-016). */
  private accumulationTimer: ReturnType<typeof setInterval> | null = null;

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
    this.lastDabPoint = point;

    // Snapshot the full image for undo
    this.originalSnapshot = new Uint8ClampedArray(imageData.data);

    // Reset dirty bounds
    this.dirtyBounds = null;

    // Place the first dab
    this.placeDab(point);

    // Start accumulation timer for airbrush-style variants (APP-016)
    this.stopAccumulation();
    const variant = options.variant;
    if (variant?.accumulates && variant.accumulationIntervalMs > 0) {
      this.accumulationTimer = setInterval(() => {
        if (this.active && this.lastDabPoint) {
          this.placeDab(this.lastDabPoint);
        }
      }, variant.accumulationIntervalMs);
    }
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

      const dabPt = { x: interpX, y: interpY, pressure: interpPressure };
      this.placeDab(dabPt);
      this.lastDabPoint = dabPt;
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

  /** Stop the accumulation timer (APP-016). */
  private stopAccumulation(): void {
    if (this.accumulationTimer !== null) {
      clearInterval(this.accumulationTimer);
      this.accumulationTimer = null;
    }
  }

  /** Reset internal state. */
  private reset(): void {
    this.stopAccumulation();
    this.imageData = null;
    this.options = null;
    this.lastPoint = null;
    this.distanceSinceLastDab = 0;
    this.dirtyBounds = null;
    this.originalSnapshot = null;
    this.active = false;
    this.lastDabPoint = null;
  }

  /**
   * Place a single circular brush dab at the given point.
   * Variant-aware: respects antiAlias, pressure mapping, and hardness overrides (APP-016).
   */
  private placeDab(point: BrushPoint): void {
    if (!this.imageData || !this.options) return;

    const { size, hardness, opacity, color, eraser, variant } = this.options;
    const pressure = point.pressure ?? 1;

    // Determine effective hardness (variant may override)
    const effectiveHardness = variant?.hardnessOverride ?? hardness;

    // Determine effective size — variant controls whether pressure affects size
    const pressureSize = variant ? (variant.pressureAffectsSize ? pressure : 1) : pressure;
    const radius = (size * pressureSize) / 2;
    if (radius < 0.5) return;

    // Determine effective opacity — variant controls whether pressure affects opacity
    const pressureOpacity = variant?.pressureAffectsOpacity ? pressure : 1;

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

    // antiAlias=false (pencil): skip falloff, use binary in/out
    const useAntiAlias = variant ? variant.antiAlias : true;

    for (let py = startY; py <= endY; py++) {
      for (let px = startX; px <= endX; px++) {
        const dx = px - point.x;
        const dy = py - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) continue;

        let alpha: number;
        if (!useAntiAlias) {
          // Hard binary brush (pencil): full opacity inside radius
          alpha = opacity * pressureOpacity;
        } else {
          // Calculate falloff based on hardness
          alpha = opacity * pressureOpacity;
          if (effectiveHardness < 1 && radius > 0) {
            const normalizedDist = dist / radius;
            const softStart = effectiveHardness;
            if (normalizedDist > softStart) {
              alpha *= 1 - (normalizedDist - softStart) / (1 - softStart);
            }
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
