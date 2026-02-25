/**
 * @module smart-object
 * Simplified Smart Object layer implementation for non-destructive resizing.
 * Preserves original pixel data (sourceData) and resamples on demand,
 * so scale-down → scale-up sequences do not degrade quality.
 *
 * @see SMART-001 ticket for requirements
 * @see {@link @photoshop-app/types#RasterLayer} for the raster layer contract
 * @see {@link ./transform#bilinearSample} for the resampling primitive
 *
 * Note: `packages/types` is locked, so smart-object types are defined locally.
 * When the types package is unlocked, migrate these to `@photoshop-app/types`.
 */

import type { RasterLayer } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import { generateId } from './uuid';

// ---------------------------------------------------------------------------
// Local types (types package is locked — see SMART-001)
// ---------------------------------------------------------------------------

/** Transform parameters applied to a smart object. */
export interface SmartObjectTransform {
  /** Horizontal scale factor (1 = 100 %). */
  scaleX: number;
  /** Vertical scale factor (1 = 100 %). */
  scaleY: number;
  /** Rotation in degrees (currently unused in resampling but stored for future use). */
  rotation: number;
}

/**
 * A smart object layer that preserves original pixel data for non-destructive
 * resizing. The display output is computed by resampling `sourceData` through
 * the current `transform`.
 */
export interface SmartObjectLayer {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Display name shown in the layer panel. */
  name: string;
  /** Layer type discriminator — always `'smart-object'`. */
  type: 'smart-object';
  /** Whether the layer is visible. */
  visible: boolean;
  /** Opacity from 0 to 1. */
  opacity: number;
  /** Blend mode for compositing. */
  blendMode: typeof BlendMode[keyof typeof BlendMode];
  /** Position offset relative to the canvas origin. */
  position: { x: number; y: number };
  /** Whether the layer is locked. */
  locked: boolean;
  /** Layer effects (kept as unknown[] since we only store, never interpret). */
  effects: unknown[];
  /** ID of the parent group, or null for root-level layers. */
  parentId: string | null;
  /** Original full-resolution RGBA pixel data. */
  sourceData: Uint8Array;
  /** Width of the original source image in pixels. */
  sourceWidth: number;
  /** Height of the original source image in pixels. */
  sourceHeight: number;
  /** Current transform (scale / rotation). */
  transform: SmartObjectTransform;
  /** Cached resampled pixel data at the current transform, or null if stale. */
  displayData: ImageData | null;
}

// ---------------------------------------------------------------------------
// Helper: ImageData construction for Node/test environments
// ---------------------------------------------------------------------------

/**
 * Create an ImageData-compatible object.
 * Uses the global `ImageData` constructor when available (browser),
 * otherwise builds a plain object (Node / Vitest).
 *
 * @param data   - RGBA pixel data.
 * @param width  - Width in pixels.
 * @param height - Height in pixels.
 * @returns An object satisfying the `ImageData` interface.
 */
function makeImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (typeof globalThis.ImageData === 'function') {
    const imageData = new ImageData(width, height);
    imageData.data.set(data);
    return imageData;
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// ---------------------------------------------------------------------------
// Bilinear resampling (self-contained — operates on raw Uint8Array RGBA)
// ---------------------------------------------------------------------------

/**
 * Sample a single pixel from raw RGBA data using bilinear interpolation.
 *
 * @param src    - Source RGBA buffer.
 * @param w      - Source width.
 * @param h      - Source height.
 * @param x      - X coordinate (may be fractional).
 * @param y      - Y coordinate (may be fractional).
 * @returns [r, g, b, a] interpolated values (0-255).
 */
function bilinearSampleRaw(
  src: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const cx0 = Math.max(0, Math.min(x0, w - 1));
  const cy0 = Math.max(0, Math.min(y0, h - 1));

  const i00 = (cy0 * w + cx0) * 4;
  const i10 = (cy0 * w + x1) * 4;
  const i01 = (y1 * w + cx0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const result: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = src[i00 + c];
    const v10 = src[i10 + c];
    const v01 = src[i01 + c];
    const v11 = src[i11 + c];
    const top = v00 + (v10 - v00) * fx;
    const bottom = v01 + (v11 - v01) * fx;
    result[c] = Math.round(top + (bottom - top) * fy);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resample a smart object's `sourceData` at its current transform to produce
 * display-ready `ImageData`.
 *
 * Uses bilinear interpolation for smooth scaling.
 *
 * @param layer - The smart object layer to resample.
 * @returns An `ImageData` at the resampled dimensions.
 */
export function resampleSmartObject(layer: SmartObjectLayer): ImageData {
  const { sourceData, sourceWidth, sourceHeight, transform } = layer;
  const dstWidth = Math.max(1, Math.round(sourceWidth * Math.abs(transform.scaleX)));
  const dstHeight = Math.max(1, Math.round(sourceHeight * Math.abs(transform.scaleY)));

  const dst = new Uint8ClampedArray(dstWidth * dstHeight * 4);

  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      // Map destination pixel back to source coordinates
      const sx = (dx + 0.5) * (sourceWidth / dstWidth) - 0.5;
      const sy = (dy + 0.5) * (sourceHeight / dstHeight) - 0.5;

      const [r, g, b, a] = bilinearSampleRaw(sourceData, sourceWidth, sourceHeight, sx, sy);
      const idx = (dy * dstWidth + dx) * 4;
      dst[idx] = r;
      dst[idx + 1] = g;
      dst[idx + 2] = b;
      dst[idx + 3] = a;
    }
  }

  return makeImageData(dst, dstWidth, dstHeight);
}

/**
 * Convert a raster layer to a smart object layer.
 * The raster layer's pixel data is copied into `sourceData` and the original
 * data is preserved at full resolution.
 *
 * @param rasterLayer - The raster layer to convert. Must have non-null `imageData`.
 * @returns A new `SmartObjectLayer` containing the raster's pixels as source data.
 * @throws {Error} If the raster layer has no imageData.
 */
export function convertToSmartObject(rasterLayer: RasterLayer): SmartObjectLayer {
  if (!rasterLayer.imageData) {
    throw new Error('Cannot convert a raster layer with null imageData to a smart object');
  }

  const { imageData } = rasterLayer;
  const sourceData = new Uint8Array(imageData.data.length);
  sourceData.set(imageData.data);

  return {
    id: generateId(),
    name: rasterLayer.name,
    type: 'smart-object',
    visible: rasterLayer.visible,
    opacity: rasterLayer.opacity,
    blendMode: rasterLayer.blendMode,
    position: { ...rasterLayer.position },
    locked: rasterLayer.locked,
    effects: [...rasterLayer.effects],
    parentId: rasterLayer.parentId,
    sourceData,
    sourceWidth: imageData.width,
    sourceHeight: imageData.height,
    transform: { scaleX: 1, scaleY: 1, rotation: 0 },
    displayData: null,
  };
}

/**
 * Rasterize a smart object layer back to a raster layer.
 * The output raster contains pixels resampled at the current transform
 * (i.e. the display representation is "baked in").
 *
 * @param smartLayer - The smart object layer to rasterize.
 * @returns A new `RasterLayer` with the resampled pixels as `imageData`.
 */
export function rasterizeSmartObject(smartLayer: SmartObjectLayer): RasterLayer {
  const display = resampleSmartObject(smartLayer);

  return {
    id: generateId(),
    name: smartLayer.name,
    type: 'raster',
    visible: smartLayer.visible,
    opacity: smartLayer.opacity,
    blendMode: smartLayer.blendMode as RasterLayer['blendMode'],
    position: { ...smartLayer.position },
    locked: smartLayer.locked,
    effects: [...smartLayer.effects] as RasterLayer['effects'],
    parentId: smartLayer.parentId,
    imageData: display,
    bounds: { x: 0, y: 0, width: display.width, height: display.height },
  };
}
