/**
 * @module brush
 * Brush preset types for painting tools and ABR import.
 */

/** A brush preset imported from an ABR file or created by the user. */
export interface BrushPreset {
  /** Unique identifier. */
  id: string;
  /** Display name of the brush. */
  name: string;
  /** Brush tip image as a grayscale alpha mask. Null for simple round brushes. */
  tipImage: ImageData | null;
  /** Default brush diameter in pixels. */
  diameter: number;
  /** Hardness (0 = soft, 1 = hard). Only applies to round brushes. */
  hardness: number;
  /** Spacing as a fraction of the brush diameter (0.01 - 10). */
  spacing: number;
  /** Rotation angle in degrees. */
  angle: number;
  /** Roundness ratio (0.01 - 1). 1 = circular, less = elliptical. */
  roundness: number;
  /** Source ABR file name, or null if user-created. */
  source: string | null;
}

/** Result of parsing an ABR file. */
export interface AbrParseResult {
  /** ABR format version detected. */
  version: number;
  /** Parsed brush presets. */
  brushes: BrushPreset[];
  /** Warnings encountered during parsing. */
  warnings: string[];
}
