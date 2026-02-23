/**
 * @module style
 * Layer style preset types for ASL import.
 */

import type { LayerEffect } from './effects';

/** A layer style preset imported from an ASL file or created by the user. */
export interface LayerStylePreset {
  /** Unique identifier. */
  id: string;
  /** Display name of the style. */
  name: string;
  /** Effects that make up this style. */
  effects: LayerEffect[];
  /** Source ASL file name, or null if user-created. */
  source: string | null;
}

/** Result of parsing an ASL file. */
export interface AslParseResult {
  /** Parsed layer style presets. */
  styles: LayerStylePreset[];
  /** Effects that were skipped due to being unsupported. */
  skippedEffects: string[];
  /** Warnings encountered during parsing. */
  warnings: string[];
}
