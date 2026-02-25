/**
 * @module filters/basic
 * Basic image filters: invert, grayscale, sepia, posterize, threshold, desaturate.
 * All functions create a new ImageData and do NOT modify the input.
 */

/** Clamp 0-255. */
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Clone ImageData. */
function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

/**
 * Invert all pixel colors.
 * @param imageData - Source image data.
 * @returns New ImageData with inverted colors.
 */
export function invert(imageData: ImageData): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  return result;
}

/**
 * Convert to grayscale using luminance formula.
 * @param imageData - Source image data.
 * @returns New ImageData in grayscale.
 */
export function grayscale(imageData: ImageData): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
  }
  return result;
}

/**
 * Apply sepia tone filter.
 * @param imageData - Source image data.
 * @returns New ImageData with sepia tone.
 */
export function sepia(imageData: ImageData): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = clamp255(r * 0.393 + g * 0.769 + b * 0.189);
    d[i + 1] = clamp255(r * 0.349 + g * 0.686 + b * 0.168);
    d[i + 2] = clamp255(r * 0.272 + g * 0.534 + b * 0.131);
  }
  return result;
}

/**
 * Posterize: reduce the number of color levels per channel.
 * @param imageData - Source image data.
 * @param numLevels - Number of levels per channel (2-256).
 * @returns New ImageData with posterized colors.
 */
export function posterize(imageData: ImageData, numLevels: number): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  const lvl = Math.max(2, Math.min(256, Math.round(numLevels)));
  const step = 255 / (lvl - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(Math.round(Math.round(d[i] / step) * step));
    d[i + 1] = clamp255(Math.round(Math.round(d[i + 1] / step) * step));
    d[i + 2] = clamp255(Math.round(Math.round(d[i + 2] / step) * step));
  }
  return result;
}

/**
 * Apply black/white threshold.
 * @param imageData - Source image data.
 * @param level - Threshold level (0-255).
 * @returns New ImageData with threshold applied.
 */
export function threshold(imageData: ImageData, level: number): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const val = lum >= level ? 255 : 0;
    d[i] = val; d[i + 1] = val; d[i + 2] = val;
  }
  return result;
}

/**
 * Fully desaturate by averaging RGB channels.
 * @param imageData - Source image data.
 * @returns New ImageData desaturated.
 */
export function desaturate(imageData: ImageData): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    const avg = Math.round((d[i] + d[i + 1] + d[i + 2]) / 3);
    d[i] = avg; d[i + 1] = avg; d[i + 2] = avg;
  }
  return result;
}
