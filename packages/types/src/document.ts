/**
 * @module document
 * Document and Canvas type definitions.
 * A Document is the top-level container representing an open image file.
 */

import type { Size } from './common';
import type { LayerGroup } from './layer';

/** Color mode of the document. Currently only RGB is supported. */
export type ColorMode = 'rgb';

/** Bit depth per channel. Currently only 8-bit is supported. */
export type BitDepth = 8;

/** Canvas properties defining the document dimensions. */
export interface Canvas {
  /** Canvas dimensions in pixels. */
  size: Size;
  /** Resolution in DPI (dots per inch). */
  dpi: number;
  /** Color mode. */
  colorMode: ColorMode;
  /** Bit depth per channel. */
  bitDepth: BitDepth;
}

/** A document representing an open image with layers. */
export interface Document {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Document display name (derived from filename). */
  name: string;
  /** Canvas properties (size, DPI, color mode). */
  canvas: Canvas;
  /** Root layer group containing all layers. */
  rootGroup: LayerGroup;
  /** ID of the currently selected layer, or null. */
  selectedLayerId: string | null;
  /** File path if the document has been saved, or null for new documents. */
  filePath: string | null;
  /** Whether the document has unsaved changes. */
  dirty: boolean;
  /** Creation timestamp (ISO 8601). */
  createdAt: string;
  /** Last modification timestamp (ISO 8601). */
  modifiedAt: string;
}
