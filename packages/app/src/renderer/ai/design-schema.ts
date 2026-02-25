/**
 * @module ai/design-schema
 * Thumbnail design blueprint schema and validation.
 *
 * Defines the `ThumbnailDesign` JSON structure that represents a complete
 * thumbnail layout: canvas size, background, layer stack, and metadata.
 *
 * The validator (`validateThumbnailDesign`) performs runtime type-checking
 * on unknown data (e.g. from AI output or JSON files) and returns a
 * strongly-typed `ThumbnailDesign` on success.
 *
 * @see THUMB-001: Thumbnail Architect
 * @see {@link ./design-patterns.ts} — design pattern database
 * @see {@link ./thumbnail-architect.ts} — design generation and conversion
 * @see {@link ../editor-actions/types.ts} — EditorAction types (target format)
 */

import type { Color } from '@photoshop-app/types';

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/** Canvas dimensions for the thumbnail. */
export interface CanvasSpec {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

/** Solid color background. */
export interface SolidBackground {
  type: 'solid';
  /** Fill color. */
  color: Color;
}

/** Linear or radial gradient background. */
export interface GradientBackground {
  type: 'gradient';
  /** Gradient type. */
  gradientType: 'linear' | 'radial';
  /** Angle in degrees (only meaningful for linear). */
  angle: number;
  /** Gradient color stops (at least 2). */
  stops: ReadonlyArray<{ position: number; color: Color }>;
}

/** Pattern background (dots, stripes, etc.). */
export interface PatternBackground {
  type: 'pattern';
  /** Pattern kind. */
  pattern: 'dots' | 'stripes' | 'checker' | 'diagonal-stripes';
  /** Pattern foreground color. */
  color: Color;
  /** Spacing between pattern elements in pixels. */
  spacing: number;
  /** Size of individual pattern elements in pixels. */
  size: number;
  /** Pattern opacity (0-1). */
  opacity: number;
  /** Optional solid color drawn behind the pattern. */
  backgroundColor?: Color;
}

/** Discriminated union of all background types. */
export type BackgroundDesign = SolidBackground | GradientBackground | PatternBackground;

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

/** Horizontal alignment for text layers. */
export type TextAlignment = 'left' | 'center' | 'right';

/** Text layer definition within the design blueprint. */
export interface TextLayerDesign {
  kind: 'text';
  /** Display name for the layer. */
  name: string;
  /** Text content to render. */
  text: string;
  /** X position in pixels (from left). */
  x: number;
  /** Y position in pixels (from top). */
  y: number;
  /** Font size in pixels. */
  fontSize: number;
  /** Font family name. */
  fontFamily: string;
  /** Text color. */
  color: Color;
  /** Whether to render bold. */
  bold: boolean;
  /** Whether to render italic. */
  italic: boolean;
  /** Horizontal alignment. */
  alignment: TextAlignment;
  /** Layer effects (stroke, shadow, glow, etc.) as plain objects. */
  effects: ReadonlyArray<Record<string, unknown>>;
}

/** Image placeholder layer (e.g. subject cutout area). */
export interface ImageLayerDesign {
  kind: 'image';
  /** Display name for the layer. */
  name: string;
  /** X position in pixels. */
  x: number;
  /** Y position in pixels. */
  y: number;
  /** Placeholder width in pixels. */
  width: number;
  /** Placeholder height in pixels. */
  height: number;
  /** Description of expected content (for AI or user guidance). */
  description: string;
}

/** Shape / decoration layer. */
export interface ShapeLayerDesign {
  kind: 'shape';
  /** Display name for the layer. */
  name: string;
  /** Shape type identifier. */
  shapeType: 'border-frame' | 'concentration-lines';
  /** Shape-specific parameters. */
  params: Record<string, unknown>;
}

/** Discriminated union of all layer types in a design blueprint. */
export type LayerDesign = TextLayerDesign | ImageLayerDesign | ShapeLayerDesign;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/** Metadata describing the design intent. */
export interface DesignMetadata {
  /** Design category (e.g. 'news', 'howto', 'vlog'). */
  category: string;
  /** Mood / emotional tone (e.g. 'urgent', 'calm', 'fun'). */
  mood: string;
  /** Target platform (e.g. 'youtube', 'twitter', 'instagram'). */
  targetPlatform: string;
}

// ---------------------------------------------------------------------------
// ThumbnailDesign (top-level)
// ---------------------------------------------------------------------------

/** Complete thumbnail design blueprint. */
export interface ThumbnailDesign {
  /** Canvas dimensions. */
  canvas: CanvasSpec;
  /** Background specification. */
  background: BackgroundDesign;
  /** Ordered layer stack (bottom to top). */
  layers: LayerDesign[];
  /** Design metadata. */
  metadata: DesignMetadata;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Error thrown when design validation fails. */
export class DesignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignValidationError';
  }
}

/**
 * Validate that an unknown value conforms to the `ThumbnailDesign` schema.
 *
 * Performs structural checks on every required field. Throws
 * `DesignValidationError` with a descriptive message on the first violation.
 *
 * @param data - Unknown data to validate.
 * @returns A valid `ThumbnailDesign` object (same reference if already valid).
 * @throws {DesignValidationError} If validation fails.
 *
 * @example
 * ```ts
 * const design = validateThumbnailDesign(JSON.parse(jsonString));
 * ```
 */
export function validateThumbnailDesign(data: unknown): ThumbnailDesign {
  if (typeof data !== 'object' || data === null) {
    throw new DesignValidationError('Design must be a non-null object');
  }

  const obj = data as Record<string, unknown>;

  // Canvas
  validateCanvas(obj.canvas);

  // Background
  validateBackground(obj.background);

  // Layers
  if (!Array.isArray(obj.layers)) {
    throw new DesignValidationError('Design.layers must be an array');
  }
  for (let i = 0; i < obj.layers.length; i++) {
    validateLayer(obj.layers[i] as unknown, i);
  }

  // Metadata
  validateMetadata(obj.metadata);

  return data as ThumbnailDesign;
}

// ---------------------------------------------------------------------------
// Internal validators
// ---------------------------------------------------------------------------

/**
 * Validate the canvas spec.
 * @param value - Unknown value to check.
 * @throws {DesignValidationError}
 */
function validateCanvas(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    throw new DesignValidationError('Design.canvas must be an object');
  }
  const c = value as Record<string, unknown>;
  if (typeof c.width !== 'number' || c.width <= 0) {
    throw new DesignValidationError('canvas.width must be a positive number');
  }
  if (typeof c.height !== 'number' || c.height <= 0) {
    throw new DesignValidationError('canvas.height must be a positive number');
  }
}

/**
 * Validate a Color object (r, g, b in 0-255, a in 0-1).
 * @param value - Unknown value to check.
 * @param path - Field path for error messages.
 * @throws {DesignValidationError}
 */
function validateColor(value: unknown, path: string): void {
  if (typeof value !== 'object' || value === null) {
    throw new DesignValidationError(`${path} must be a color object`);
  }
  const c = value as Record<string, unknown>;
  for (const ch of ['r', 'g', 'b', 'a'] as const) {
    if (typeof c[ch] !== 'number') {
      throw new DesignValidationError(`${path}.${ch} must be a number`);
    }
  }
}

/**
 * Validate the background spec.
 * @param value - Unknown value to check.
 * @throws {DesignValidationError}
 */
function validateBackground(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    throw new DesignValidationError('Design.background must be an object');
  }
  const bg = value as Record<string, unknown>;
  const bgType = bg.type;

  if (bgType === 'solid') {
    validateColor(bg.color, 'background.color');
  } else if (bgType === 'gradient') {
    if (!Array.isArray(bg.stops) || bg.stops.length < 2) {
      throw new DesignValidationError('Gradient background requires at least 2 stops');
    }
    for (let i = 0; i < bg.stops.length; i++) {
      const stop = bg.stops[i] as Record<string, unknown>;
      if (typeof stop.position !== 'number') {
        throw new DesignValidationError(`background.stops[${i}].position must be a number`);
      }
      validateColor(stop.color, `background.stops[${i}].color`);
    }
  } else if (bgType === 'pattern') {
    validateColor(bg.color, 'background.color');
  } else {
    throw new DesignValidationError(`Unknown background type: '${String(bgType)}'`);
  }
}

/**
 * Validate a single layer entry.
 * @param value - Unknown value to check.
 * @param index - Array index for error messages.
 * @throws {DesignValidationError}
 */
function validateLayer(value: unknown, index: number): void {
  if (typeof value !== 'object' || value === null) {
    throw new DesignValidationError(`layers[${index}] must be an object`);
  }
  const layer = value as Record<string, unknown>;
  const kind = layer.kind;

  if (kind === 'text') {
    if (typeof layer.text !== 'string') {
      throw new DesignValidationError(`layers[${index}].text must be a string`);
    }
    if (typeof layer.fontSize !== 'number' || (layer.fontSize as number) <= 0) {
      throw new DesignValidationError(`layers[${index}].fontSize must be a positive number`);
    }
    validateColor(layer.color, `layers[${index}].color`);
  } else if (kind === 'image') {
    if (typeof layer.width !== 'number' || (layer.width as number) <= 0) {
      throw new DesignValidationError(`layers[${index}].width must be a positive number`);
    }
    if (typeof layer.height !== 'number' || (layer.height as number) <= 0) {
      throw new DesignValidationError(`layers[${index}].height must be a positive number`);
    }
  } else if (kind === 'shape') {
    if (typeof layer.shapeType !== 'string') {
      throw new DesignValidationError(`layers[${index}].shapeType must be a string`);
    }
  } else {
    throw new DesignValidationError(`layers[${index}] has unknown kind: '${String(kind)}'`);
  }
}

/**
 * Validate the metadata spec.
 * @param value - Unknown value to check.
 * @throws {DesignValidationError}
 */
function validateMetadata(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    throw new DesignValidationError('Design.metadata must be an object');
  }
  const m = value as Record<string, unknown>;
  for (const key of ['category', 'mood', 'targetPlatform'] as const) {
    if (typeof m[key] !== 'string') {
      throw new DesignValidationError(`metadata.${key} must be a string`);
    }
  }
}
