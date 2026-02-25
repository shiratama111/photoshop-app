/**
 * @module layer-factory
 * Factory functions for creating layer instances.
 * Each function produces a properly initialized layer with default values.
 *
 * @see CORE-001: Layer creation factories
 * @see SMART-001: Smart object layer factory
 */

import type { RasterLayer, TextLayer, LayerGroup, Color, WritingMode, TextAlignment } from '@photoshop-app/types';
import { BlendMode } from '@photoshop-app/types';
import { generateId } from './uuid';
import type { SmartObjectLayer } from './smart-object';

/**
 * Creates a new raster (pixel) layer.
 *
 * @param name   - Display name for the layer.
 * @param width  - Width of the raster bounds in pixels.
 * @param height - Height of the raster bounds in pixels.
 * @returns A new RasterLayer with null imageData and the specified bounds.
 */
export function createRasterLayer(name: string, width: number, height: number): RasterLayer {
  return {
    id: generateId(),
    name,
    type: 'raster',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    imageData: null,
    bounds: { x: 0, y: 0, width, height },
  };
}

/** Options for creating a text layer. */
export interface CreateTextLayerOptions {
  fontFamily?: string;
  fontSize?: number;
  color?: Color;
  bold?: boolean;
  italic?: boolean;
  alignment?: TextAlignment;
  lineHeight?: number;
  letterSpacing?: number;
  writingMode?: WritingMode;
  underline?: boolean;
  strikethrough?: boolean;
}

/**
 * Creates a new text layer.
 *
 * @param name    - Display name for the layer.
 * @param text    - Initial text content.
 * @param options - Optional text styling properties.
 * @returns A new TextLayer with the specified text and styling.
 */
export function createTextLayer(
  name: string,
  text: string,
  options?: CreateTextLayerOptions,
): TextLayer {
  return {
    id: generateId(),
    name,
    type: 'text',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    text,
    fontFamily: options?.fontFamily ?? 'Arial',
    fontSize: options?.fontSize ?? 16,
    color: options?.color ?? { r: 0, g: 0, b: 0, a: 1 },
    bold: options?.bold ?? false,
    italic: options?.italic ?? false,
    alignment: options?.alignment ?? 'left',
    lineHeight: options?.lineHeight ?? 1.2,
    letterSpacing: options?.letterSpacing ?? 0,
    textBounds: null,
    writingMode: options?.writingMode ?? 'horizontal-tb',
    underline: options?.underline ?? false,
    strikethrough: options?.strikethrough ?? false,
  };
}

/**
 * Creates a new layer group.
 *
 * @param name - Display name for the group.
 * @returns A new empty LayerGroup.
 */
export function createLayerGroup(name: string): LayerGroup {
  return {
    id: generateId(),
    name,
    type: 'group',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    children: [],
    expanded: true,
  };
}

/**
 * Creates a new smart object layer from raw RGBA source data.
 *
 * @param name         - Display name for the layer.
 * @param sourceData   - Original full-resolution RGBA pixel data.
 * @param sourceWidth  - Width of the source image in pixels.
 * @param sourceHeight - Height of the source image in pixels.
 * @returns A new SmartObjectLayer with identity transform and no cached display data.
 *
 * @see SMART-001: Smart object factory
 */
export function createSmartObjectLayer(
  name: string,
  sourceData: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
): SmartObjectLayer {
  const expectedLength = sourceWidth * sourceHeight * 4;
  if (sourceData.length !== expectedLength) {
    throw new Error(
      `sourceData length ${sourceData.length} does not match ${sourceWidth}x${sourceHeight} RGBA (expected ${expectedLength})`,
    );
  }

  return {
    id: generateId(),
    name,
    type: 'smart-object',
    visible: true,
    opacity: 1,
    blendMode: BlendMode.Normal,
    position: { x: 0, y: 0 },
    locked: false,
    effects: [],
    parentId: null,
    sourceData: new Uint8Array(sourceData),
    sourceWidth,
    sourceHeight,
    transform: { scaleX: 1, scaleY: 1, rotation: 0 },
    displayData: null,
  };
}
