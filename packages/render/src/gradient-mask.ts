/**
 * @module gradient-mask
 * Gradient mask generation and application for layer alpha manipulation.
 *
 * Generates linear or radial gradient masks as ImageData, then applies them
 * by multiplying source alpha channels. Used by GradientMaskDialog to create
 * fade-out effects for thumbnail text areas.
 *
 * All functions are pure (no side effects) and suitable for Web Workers.
 *
 * @see GMASK-001 - Gradient mask ticket
 * @see @photoshop-app/core/procedural - Legacy generateGradientMask (5-direction)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Gradient mask type: linear fade along an axis, or radial fade from center. */
export type GradientMaskType = 'linear' | 'radial';

/**
 * Configuration for gradient mask generation.
 *
 * Controls the shape, direction, fade range, and reversal of the mask.
 */
export interface GradientMaskConfig {
  /** Gradient type: linear (directional) or radial (center-outward). */
  type: GradientMaskType;
  /**
   * Direction angle in degrees (used for linear gradients).
   * - 0 = top-to-bottom
   * - 90 = left-to-right
   * - 180 = bottom-to-top
   * - 270 = right-to-left
   * Other values produce diagonal gradients.
   * Ignored for radial gradients.
   */
  direction: number;
  /** Where the fade begins, as a percentage (0-100). Pixels before this are fully opaque (or fully transparent if reversed). */
  startPosition: number;
  /** Where the fade ends, as a percentage (0-100). Pixels after this are fully transparent (or fully opaque if reversed). */
  endPosition: number;
  /** When true, the mask is reversed (transparent becomes opaque and vice versa). */
  reversed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a value between min and max (inclusive).
 *
 * @param value - The value to clamp
 * @param min - Lower bound
 * @param max - Upper bound
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Convert degrees to radians.
 *
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// Mask Generation
// ---------------------------------------------------------------------------

/**
 * Generate a gradient mask as an ImageData with alpha-only gradient values.
 *
 * The returned ImageData has RGB channels set to 0 and the alpha channel
 * containing the gradient values. The mask can then be applied to a source
 * image using {@link applyGradientMask}.
 *
 * For **linear** gradients, the direction angle controls the fade axis:
 * - 0 degrees = top-to-bottom (opaque at top, transparent at bottom)
 * - 90 degrees = left-to-right
 * - 180 degrees = bottom-to-top
 * - 270 degrees = right-to-left
 *
 * For **radial** gradients, the fade goes from center outward (direction is ignored).
 *
 * The startPosition and endPosition (0-100) control where the fade begins and ends.
 * Between start and end, alpha interpolates linearly. Outside this range,
 * pixels are fully opaque (before start) or fully transparent (after end).
 *
 * @param width - Width of the mask in pixels
 * @param height - Height of the mask in pixels
 * @param config - Gradient mask configuration
 * @returns ImageData containing the gradient mask (alpha channel only)
 */
export function generateGradientMask(
  width: number,
  height: number,
  config: GradientMaskConfig,
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  // Normalize positions to 0-1 range
  const startNorm = clamp(config.startPosition, 0, 100) / 100;
  const endNorm = clamp(config.endPosition, 0, 100) / 100;

  if (config.type === 'radial') {
    fillRadialMask(data, width, height, startNorm, endNorm, config.reversed);
  } else {
    fillLinearMask(data, width, height, config.direction, startNorm, endNorm, config.reversed);
  }

  return imageData;
}

/**
 * Fill ImageData buffer with a linear gradient mask.
 *
 * Projects each pixel onto the gradient axis defined by the direction angle,
 * then computes alpha based on the start/end positions.
 *
 * @param data - Uint8ClampedArray to write into (RGBA, length = w*h*4)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param direction - Angle in degrees (0=top-to-bottom, clockwise)
 * @param startNorm - Normalized start position (0-1)
 * @param endNorm - Normalized end position (0-1)
 * @param reversed - Whether to reverse the mask
 */
function fillLinearMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  direction: number,
  startNorm: number,
  endNorm: number,
  reversed: boolean,
): void {
  // Direction angle: 0 = top-to-bottom
  // We compute a unit vector along the gradient direction.
  // 0 degrees => gradient goes top (y=0, opaque) to bottom (y=height, transparent)
  // We use angle convention: 0=down, 90=right, measured clockwise
  const rad = degreesToRadians(direction);
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);

  // Project corners onto the gradient axis to find the range
  // Corner projections (dot product of corner with direction vector)
  const corners = [
    0 * dx + 0 * dy,             // top-left
    (width - 1) * dx + 0 * dy,   // top-right
    0 * dx + (height - 1) * dy,  // bottom-left
    (width - 1) * dx + (height - 1) * dy, // bottom-right
  ];
  const minProj = Math.min(...corners);
  const maxProj = Math.max(...corners);
  const range = maxProj - minProj;

  // Avoid division by zero for degenerate cases
  if (range === 0) {
    // All pixels have the same projection, fill with full opacity
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = reversed ? 0 : 255;
    }
    return;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const proj = x * dx + y * dy;
      // Normalize to 0-1 along the gradient axis
      const t = (proj - minProj) / range;

      const alpha = computeAlpha(t, startNorm, endNorm, reversed);
      const idx = (y * width + x) * 4;
      data[idx + 3] = alpha;
    }
  }
}

/**
 * Fill ImageData buffer with a radial gradient mask.
 *
 * Computes distance from center for each pixel, normalizes by the maximum
 * distance (corner distance), then applies the start/end fade range.
 *
 * @param data - Uint8ClampedArray to write into (RGBA, length = w*h*4)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param startNorm - Normalized start position (0-1)
 * @param endNorm - Normalized end position (0-1)
 * @param reversed - Whether to reverse the mask
 */
function fillRadialMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startNorm: number,
  endNorm: number,
  reversed: boolean,
): void {
  const cx = width / 2;
  const cy = height / 2;
  // Maximum distance from center to any corner
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  // Avoid division by zero for 0x0 or 1x1 images
  if (maxDist === 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = reversed ? 0 : 255;
    }
    return;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const t = dist / maxDist;

      const alpha = computeAlpha(t, startNorm, endNorm, reversed);
      const idx = (y * width + x) * 4;
      data[idx + 3] = alpha;
    }
  }
}

/**
 * Compute alpha value (0-255) based on normalized position and fade range.
 *
 * - t < start => fully opaque (255)
 * - t > end   => fully transparent (0)
 * - between start and end => linear interpolation
 *
 * When reversed, the result is inverted (0 becomes 255 and vice versa).
 *
 * @param t - Normalized position along the gradient (0-1)
 * @param start - Normalized start of fade range (0-1)
 * @param end - Normalized end of fade range (0-1)
 * @param reversed - Whether to reverse the alpha
 * @returns Alpha value (0-255)
 */
function computeAlpha(t: number, start: number, end: number, reversed: boolean): number {
  let alphaMul: number;

  if (start >= end) {
    // Degenerate case: instant transition
    alphaMul = t < start ? 1 : 0;
  } else if (t <= start) {
    alphaMul = 1;
  } else if (t >= end) {
    alphaMul = 0;
  } else {
    alphaMul = 1 - (t - start) / (end - start);
  }

  if (reversed) {
    alphaMul = 1 - alphaMul;
  }

  return Math.round(alphaMul * 255);
}

// ---------------------------------------------------------------------------
// Mask Application
// ---------------------------------------------------------------------------

/**
 * Apply a gradient mask to source image data by multiplying alpha channels.
 *
 * For each pixel, the source alpha is multiplied by the mask alpha (normalized
 * to 0-1). RGB channels are preserved from the source. Returns a new ImageData
 * without modifying the inputs.
 *
 * Both inputs must have the same dimensions; an error is thrown otherwise.
 *
 * @param sourceImageData - The source image (RGBA)
 * @param maskImageData - The gradient mask (alpha channel used)
 * @returns New ImageData with the mask applied to the source's alpha channel
 * @throws Error if source and mask dimensions do not match
 */
export function applyGradientMask(
  sourceImageData: ImageData,
  maskImageData: ImageData,
): ImageData {
  if (
    sourceImageData.width !== maskImageData.width ||
    sourceImageData.height !== maskImageData.height
  ) {
    throw new Error(
      `Dimension mismatch: source is ${sourceImageData.width}x${sourceImageData.height}, ` +
      `mask is ${maskImageData.width}x${maskImageData.height}`,
    );
  }

  const { width, height } = sourceImageData;
  const result = new ImageData(
    new Uint8ClampedArray(sourceImageData.data),
    width,
    height,
  );
  const resultData = result.data;
  const maskData = maskImageData.data;

  for (let i = 0; i < resultData.length; i += 4) {
    // Multiply source alpha by mask alpha (both 0-255, result normalized back)
    const sourceAlpha = resultData[i + 3];
    const maskAlpha = maskData[i + 3];
    resultData[i + 3] = Math.round((sourceAlpha * maskAlpha) / 255);
  }

  return result;
}
