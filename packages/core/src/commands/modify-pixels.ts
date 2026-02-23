/**
 * @module commands/modify-pixels
 * Command for modifying pixel data on a raster layer.
 * Stores only the changed region for memory efficiency.
 *
 * @see CORE-002: ModifyPixels (save only changed region)
 */

import type { Command, Rect, RasterLayer } from '@photoshop-app/types';

/**
 * Captures a rectangular region of pixel data before and after a modification.
 *
 * Only the bounding region of the change is stored, not the entire layer,
 * to keep memory usage proportional to the edit size.
 */
export class ModifyPixelsCommand implements Command {
  readonly description: string;
  private readonly layer: RasterLayer;
  private readonly region: Rect;
  private readonly oldPixels: Uint8ClampedArray;
  private readonly newPixels: Uint8ClampedArray;

  /**
   * @param layer     - The raster layer being modified.
   * @param region    - The bounding rect of the changed area (document coords).
   * @param oldPixels - Pixel data (RGBA) of the region **before** the change.
   * @param newPixels - Pixel data (RGBA) of the region **after** the change.
   */
  constructor(
    layer: RasterLayer,
    region: Rect,
    oldPixels: Uint8ClampedArray,
    newPixels: Uint8ClampedArray,
  ) {
    const expectedLength = region.width * region.height * 4;
    if (oldPixels.length !== expectedLength) {
      throw new Error(
        `oldPixels length ${oldPixels.length} does not match region ${region.width}x${region.height} (expected ${expectedLength})`,
      );
    }
    if (newPixels.length !== expectedLength) {
      throw new Error(
        `newPixels length ${newPixels.length} does not match region ${region.width}x${region.height} (expected ${expectedLength})`,
      );
    }

    this.layer = layer;
    this.region = region;
    this.oldPixels = oldPixels;
    this.newPixels = newPixels;
    this.description = `Modify pixels on "${layer.name}"`;
  }

  /** Apply the new pixel data to the layer's imageData. */
  execute(): void {
    this.applyPixels(this.newPixels);
  }

  /** Restore the old pixel data on the layer's imageData. */
  undo(): void {
    this.applyPixels(this.oldPixels);
  }

  /**
   * Write a pixel buffer into the layer's imageData at the stored region.
   * Copies row-by-row from the region buffer into the full-layer buffer.
   */
  private applyPixels(pixels: Uint8ClampedArray): void {
    const { imageData } = this.layer;
    if (!imageData) {
      return;
    }

    const layerWidth = imageData.width;
    const { x, y, width, height } = this.region;

    for (let row = 0; row < height; row++) {
      const srcOffset = row * width * 4;
      const dstOffset = ((y + row) * layerWidth + x) * 4;
      imageData.data.set(
        pixels.subarray(srcOffset, srcOffset + width * 4),
        dstOffset,
      );
    }
  }
}
