/**
 * @module layer
 * Layer type definitions for the document model.
 * Layers form a tree structure with LayerGroup as branch nodes
 * and RasterLayer/TextLayer as leaf nodes.
 */

import type { BlendMode, Color, Point, Rect } from './common';
import type { LayerEffect } from './effects';

/** Discriminator for layer types. */
export type LayerType = 'raster' | 'text' | 'group';

/** Properties shared by all layer types. */
export interface BaseLayer {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Display name shown in the layer panel. */
  name: string;
  /** Layer type discriminator. */
  type: LayerType;
  /** Whether the layer is visible. */
  visible: boolean;
  /** Opacity from 0 (transparent) to 1 (opaque). */
  opacity: number;
  /** Blend mode for compositing. */
  blendMode: BlendMode;
  /** Position offset relative to the canvas origin. */
  position: Point;
  /** Whether the layer is locked (prevents edits). */
  locked: boolean;
  /** Layer effects (stroke, shadow, glow). */
  effects: LayerEffect[];
  /** Optional layer mask (alpha channel). */
  mask?: LayerMask;
  /** ID of the parent group, or null for root-level layers. */
  parentId: string | null;
}

/** Alpha mask for a layer. */
export interface LayerMask {
  /** Mask pixel data (single-channel, 0-255). Width * height bytes. */
  data: Uint8Array;
  /** Width of the mask in pixels. */
  width: number;
  /** Height of the mask in pixels. */
  height: number;
  /** Offset of the mask relative to the layer. */
  offset: Point;
  /** Whether the mask is enabled. */
  enabled: boolean;
}

/** A raster (pixel) layer containing bitmap image data. */
export interface RasterLayer extends BaseLayer {
  type: 'raster';
  /** RGBA pixel data. Length = width * height * 4. */
  imageData: ImageData | null;
  /** Bounds of the pixel content within the canvas. */
  bounds: Rect;
}

/** Text alignment options. */
export type TextAlignment = 'left' | 'center' | 'right';

/** A text layer with editable text content. */
export interface TextLayer extends BaseLayer {
  type: 'text';
  /** The text content. */
  text: string;
  /** Font family name. */
  fontFamily: string;
  /** Font size in pixels. */
  fontSize: number;
  /** Text color. */
  color: Color;
  /** Whether the text is bold. */
  bold: boolean;
  /** Whether the text is italic. */
  italic: boolean;
  /** Text alignment. */
  alignment: TextAlignment;
  /** Line height multiplier (1.0 = normal). */
  lineHeight: number;
  /** Letter spacing in pixels. */
  letterSpacing: number;
  /** Bounding box for text wrapping. Null = auto-sized. */
  textBounds: Rect | null;
}

/** A group that contains child layers. */
export interface LayerGroup extends BaseLayer {
  type: 'group';
  /** Ordered child layers (bottom to top). */
  children: Layer[];
  /** Whether the group is expanded in the layer panel. */
  expanded: boolean;
}

/** Union type for all layer types. */
export type Layer = RasterLayer | TextLayer | LayerGroup;
