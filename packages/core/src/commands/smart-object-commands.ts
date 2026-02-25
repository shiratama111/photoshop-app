/**
 * @module commands/smart-object-commands
 * Undo-able commands for smart object operations:
 * - ConvertToSmartObjectCommand  (raster -> smart object)
 * - TransformSmartObjectCommand  (scale / rotate)
 * - RasterizeSmartObjectCommand  (smart object -> raster)
 *
 * All commands operate on a mutable layer array (the parent's children list)
 * by swapping the target layer in-place so that references held by the layer
 * tree remain valid.
 *
 * @see SMART-001 ticket for requirements
 * @see {@link @photoshop-app/types#Command} for the command interface
 */

import type { Command, RasterLayer } from '@photoshop-app/types';
import type { SmartObjectLayer, SmartObjectTransform } from '../smart-object';
import { convertToSmartObject, rasterizeSmartObject, resampleSmartObject } from '../smart-object';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Holder that wraps a mutable reference to either a RasterLayer or SmartObjectLayer.
 * Commands read and write through this holder so callers always see the current layer.
 */
export interface LayerHolder {
  /** The current layer instance. Commands will mutate this property. */
  layer: RasterLayer | SmartObjectLayer;
}

// ---------------------------------------------------------------------------
// ConvertToSmartObjectCommand
// ---------------------------------------------------------------------------

/**
 * Converts a raster layer to a smart object.
 * Undo restores the original raster layer.
 */
export class ConvertToSmartObjectCommand implements Command {
  readonly description: string;

  private readonly holder: LayerHolder;
  private readonly originalRaster: RasterLayer;
  private smartObject: SmartObjectLayer | null = null;

  /**
   * @param holder - A mutable holder whose `.layer` is the raster layer to convert.
   */
  constructor(holder: LayerHolder) {
    const layer = holder.layer;
    if (layer.type !== 'raster') {
      throw new Error('ConvertToSmartObjectCommand requires a raster layer');
    }
    this.holder = holder;
    this.originalRaster = layer as RasterLayer;
    this.description = `Convert "${layer.name}" to smart object`;
  }

  /** Convert the raster layer to a smart object. */
  execute(): void {
    if (!this.smartObject) {
      this.smartObject = convertToSmartObject(this.originalRaster);
    }
    this.holder.layer = this.smartObject;
  }

  /** Restore the original raster layer. */
  undo(): void {
    this.holder.layer = this.originalRaster;
  }
}

// ---------------------------------------------------------------------------
// TransformSmartObjectCommand
// ---------------------------------------------------------------------------

/**
 * Applies a transform (scale / rotation) to a smart object.
 * Undo restores the previous transform and invalidates the display cache.
 */
export class TransformSmartObjectCommand implements Command {
  readonly description: string;

  private readonly holder: LayerHolder;
  private readonly oldTransform: SmartObjectTransform;
  private readonly newTransform: SmartObjectTransform;

  /**
   * @param holder       - A mutable holder whose `.layer` is the smart object to transform.
   * @param newTransform - The new transform to apply.
   */
  constructor(holder: LayerHolder, newTransform: SmartObjectTransform) {
    const layer = holder.layer;
    if (layer.type !== 'smart-object') {
      throw new Error('TransformSmartObjectCommand requires a smart object layer');
    }
    const smartLayer = layer as SmartObjectLayer;
    this.holder = holder;
    this.oldTransform = { ...smartLayer.transform };
    this.newTransform = { ...newTransform };
    this.description = `Transform smart object "${layer.name}"`;
  }

  /** Apply the new transform and refresh the display cache. */
  execute(): void {
    const layer = this.holder.layer as SmartObjectLayer;
    layer.transform = { ...this.newTransform };
    layer.displayData = resampleSmartObject(layer);
  }

  /** Restore the previous transform and refresh the display cache. */
  undo(): void {
    const layer = this.holder.layer as SmartObjectLayer;
    layer.transform = { ...this.oldTransform };
    layer.displayData = resampleSmartObject(layer);
  }
}

// ---------------------------------------------------------------------------
// RasterizeSmartObjectCommand
// ---------------------------------------------------------------------------

/**
 * Rasterizes a smart object back to a raster layer at its current transform.
 * Undo restores the smart object.
 */
export class RasterizeSmartObjectCommand implements Command {
  readonly description: string;

  private readonly holder: LayerHolder;
  private readonly originalSmart: SmartObjectLayer;
  private rasterized: RasterLayer | null = null;

  /**
   * @param holder - A mutable holder whose `.layer` is the smart object to rasterize.
   */
  constructor(holder: LayerHolder) {
    const layer = holder.layer;
    if (layer.type !== 'smart-object') {
      throw new Error('RasterizeSmartObjectCommand requires a smart object layer');
    }
    this.holder = holder;
    this.originalSmart = layer as SmartObjectLayer;
    this.description = `Rasterize smart object "${layer.name}"`;
  }

  /** Rasterize the smart object to a raster layer. */
  execute(): void {
    if (!this.rasterized) {
      this.rasterized = rasterizeSmartObject(this.originalSmart);
    }
    this.holder.layer = this.rasterized;
  }

  /** Restore the original smart object. */
  undo(): void {
    this.holder.layer = this.originalSmart;
  }
}
