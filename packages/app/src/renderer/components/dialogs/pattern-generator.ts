/**
 * @module pattern-generator
 * Procedural pattern tile generators for background overlays.
 *
 * Each function generates a tileable pattern as ImageData suitable for use as
 * a background overlay layer. Patterns are generated at the full target size
 * (not tiled from a small tile) so they can be directly applied via
 * `addProceduralLayer()`.
 *
 * Supported patterns: dots, stripes, checkerboard, hatching.
 *
 * @see BG-001: Pattern overlay & background expansion
 * @see PatternDialog.tsx — UI for configuring and applying these patterns
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** RGBA color with channels 0-255. */
export interface PatternColor {
  /** Red channel (0-255). */
  r: number;
  /** Green channel (0-255). */
  g: number;
  /** Blue channel (0-255). */
  b: number;
  /** Alpha channel (0-255). */
  a: number;
}

/** Configuration for dot grid pattern generation. */
export interface DotPatternConfig {
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Dot diameter in pixels. */
  dotSize: number;
  /** Distance between dot centers in pixels. */
  spacing: number;
  /** Dot color (RGBA 0-255). */
  color: PatternColor;
  /** Overall opacity (0-1). */
  opacity: number;
}

/** Configuration for stripe pattern generation. */
export interface StripePatternConfig {
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Stripe width in pixels. */
  stripeWidth: number;
  /** Gap between stripes in pixels. */
  gap: number;
  /** Stripe color (RGBA 0-255). */
  color: PatternColor;
  /** Stripe angle in degrees (0 = horizontal, 90 = vertical). */
  angle: number;
  /** Overall opacity (0-1). */
  opacity: number;
}

/** Configuration for checkerboard pattern generation. */
export interface CheckerboardPatternConfig {
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Cell size in pixels (each square). */
  cellSize: number;
  /** First color (RGBA 0-255). */
  color1: PatternColor;
  /** Second color (RGBA 0-255). */
  color2: PatternColor;
  /** Overall opacity (0-1). */
  opacity: number;
}

/** Configuration for hatching pattern generation. */
export interface HatchPatternConfig {
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Line width in pixels. */
  lineWidth: number;
  /** Distance between line centers in pixels. */
  spacing: number;
  /** Hatch angle in degrees (45 = standard diagonal hatching). */
  angle: number;
  /** Line color (RGBA 0-255). */
  color: PatternColor;
  /** Overall opacity (0-1). */
  opacity: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a number to the [min, max] range.
 *
 * @param value - The number to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Set a pixel's RGBA values in an ImageData buffer.
 *
 * Performs bounds-checking on coordinates and clamps alpha to [0, 255].
 *
 * @param data - Uint8ClampedArray backing the ImageData
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param x - Pixel x coordinate
 * @param y - Pixel y coordinate
 * @param color - RGBA color
 * @param alpha - Overridden alpha value (0-255)
 */
function setPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: PatternColor,
  alpha: number,
): void {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = (y * width + x) * 4;
  data[idx] = color.r;
  data[idx + 1] = color.g;
  data[idx + 2] = color.b;
  data[idx + 3] = clamp(Math.round(alpha), 0, 255);
}

// ---------------------------------------------------------------------------
// Pattern Generators
// ---------------------------------------------------------------------------

/**
 * Generate a dot grid pattern as ImageData.
 *
 * Produces evenly-spaced filled circles on a transparent background.
 * The pattern is tileable — dots at the edges wrap correctly when tiled.
 *
 * @param config - Dot pattern configuration
 * @returns ImageData containing the generated dot pattern
 */
export function generateDotPattern(config: DotPatternConfig): ImageData {
  const { width, height, dotSize, spacing, color, opacity } = config;
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const imageData = new ImageData(safeWidth, safeHeight);
  const data = imageData.data;

  const radius = Math.max(0.5, dotSize / 2);
  const radiusSq = radius * radius;
  const step = Math.max(1, spacing);
  const alpha = clamp(Math.round(color.a * opacity), 0, 255);

  for (let cy = Math.floor(radius); cy < safeHeight; cy += step) {
    for (let cx = Math.floor(radius); cx < safeWidth; cx += step) {
      const minY = Math.max(0, Math.floor(cy - radius));
      const maxY = Math.min(safeHeight - 1, Math.ceil(cy + radius));
      const minX = Math.max(0, Math.floor(cx - radius));
      const maxX = Math.min(safeWidth - 1, Math.ceil(cx + radius));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= radiusSq) {
            setPixel(data, safeWidth, safeHeight, x, y, color, alpha);
          }
        }
      }
    }
  }

  return imageData;
}

/**
 * Generate a stripe pattern as ImageData.
 *
 * Produces parallel stripes at the specified angle. The stripes are rendered
 * by rotating coordinates around the image center.
 *
 * @param config - Stripe pattern configuration
 * @returns ImageData containing the generated stripe pattern
 */
export function generateStripePattern(config: StripePatternConfig): ImageData {
  const { width, height, stripeWidth, gap, color, angle, opacity } = config;
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const imageData = new ImageData(safeWidth, safeHeight);
  const data = imageData.data;

  const period = Math.max(1, stripeWidth + gap);
  const alpha = clamp(Math.round(color.a * opacity), 0, 255);
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;

  for (let y = 0; y < safeHeight; y++) {
    for (let x = 0; x < safeWidth; x++) {
      // Rotate point around center to determine stripe membership
      const dx = x - cx;
      const dy = y - cy;
      const rotated = dx * cosA + dy * sinA;

      // Determine if in stripe band (use modulo on the rotated coordinate)
      const pos = ((rotated % period) + period) % period;
      if (pos < stripeWidth) {
        setPixel(data, safeWidth, safeHeight, x, y, color, alpha);
      }
    }
  }

  return imageData;
}

/**
 * Generate a two-color checkerboard pattern as ImageData.
 *
 * Produces alternating colored squares. Both colors are rendered (no
 * transparent background).
 *
 * @param config - Checkerboard pattern configuration
 * @returns ImageData containing the generated checkerboard pattern
 */
export function generateCheckerboardPattern(config: CheckerboardPatternConfig): ImageData {
  const { width, height, cellSize, color1, color2, opacity } = config;
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const imageData = new ImageData(safeWidth, safeHeight);
  const data = imageData.data;

  const safeCellSize = Math.max(1, cellSize);
  const alpha1 = clamp(Math.round(color1.a * opacity), 0, 255);
  const alpha2 = clamp(Math.round(color2.a * opacity), 0, 255);

  for (let y = 0; y < safeHeight; y++) {
    const row = Math.floor(y / safeCellSize);
    for (let x = 0; x < safeWidth; x++) {
      const col = Math.floor(x / safeCellSize);
      if ((row + col) % 2 === 0) {
        setPixel(data, safeWidth, safeHeight, x, y, color1, alpha1);
      } else {
        setPixel(data, safeWidth, safeHeight, x, y, color2, alpha2);
      }
    }
  }

  return imageData;
}

/**
 * Generate a diagonal hatching pattern as ImageData.
 *
 * Produces parallel diagonal lines at the specified angle. The lines are
 * rendered by rotating coordinates, similar to stripes but typically used
 * with thinner lines and diagonal angles.
 *
 * @param config - Hatch pattern configuration
 * @returns ImageData containing the generated hatching pattern
 */
export function generateHatchPattern(config: HatchPatternConfig): ImageData {
  const { width, height, lineWidth, spacing, angle, color, opacity } = config;
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const imageData = new ImageData(safeWidth, safeHeight);
  const data = imageData.data;

  const period = Math.max(1, spacing);
  const halfLine = Math.max(0.5, lineWidth / 2);
  const alpha = clamp(Math.round(color.a * opacity), 0, 255);
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;

  for (let y = 0; y < safeHeight; y++) {
    for (let x = 0; x < safeWidth; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Project onto the perpendicular direction of the hatch lines
      const projected = dx * cosA + dy * sinA;

      // Distance to the nearest line center
      const distToLine = Math.abs(((projected % period) + period) % period - period / 2);
      const distFromCenter = period / 2 - distToLine;

      if (distFromCenter <= halfLine) {
        setPixel(data, safeWidth, safeHeight, x, y, color, alpha);
      }
    }
  }

  return imageData;
}
