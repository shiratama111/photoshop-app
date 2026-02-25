/**
 * @module filters/adjustments
 * Image adjustment filters: brightness, contrast, hue/saturation, levels, curves.
 * All functions create a new ImageData and do NOT modify the input.
 */

/** Convert RGB to HSL. H: 0-360, S: 0-1, L: 0-1. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Convert HSL to RGB. H: 0-360, S: 0-1, L: 0-1 → RGB 0-255. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/** Clamp a value between 0 and 255. */
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Clone ImageData. */
function cloneImageData(src: ImageData): ImageData {
  const data = new Uint8ClampedArray(src.data);
  return new ImageData(data, src.width, src.height);
}

/**
 * Adjust brightness of an image.
 * @param imageData - Source image data.
 * @param amount - Brightness adjustment (-100 to 100).
 * @returns New ImageData with adjusted brightness.
 */
export function brightness(imageData: ImageData, amount: number): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  const factor = (amount / 100) * 255;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] + factor);
    d[i + 1] = clamp255(d[i + 1] + factor);
    d[i + 2] = clamp255(d[i + 2] + factor);
  }
  return result;
}

/**
 * Adjust contrast of an image.
 * @param imageData - Source image data.
 * @param amount - Contrast adjustment (-100 to 100).
 * @returns New ImageData with adjusted contrast.
 */
export function contrast(imageData: ImageData, amount: number): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(factor * (d[i] - 128) + 128);
    d[i + 1] = clamp255(factor * (d[i + 1] - 128) + 128);
    d[i + 2] = clamp255(factor * (d[i + 2] - 128) + 128);
  }
  return result;
}

/**
 * Adjust hue, saturation, and lightness.
 * @param imageData - Source image data.
 * @param hue - Hue shift in degrees (-180 to 180).
 * @param saturation - Saturation adjustment (-100 to 100).
 * @param lightness - Lightness adjustment (-100 to 100).
 * @returns New ImageData with HSL adjustments.
 */
export function hueSaturation(
  imageData: ImageData,
  hue: number,
  saturation: number,
  lightness: number,
): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  const satFactor = 1 + saturation / 100;
  const lightFactor = lightness / 100;
  for (let i = 0; i < d.length; i += 4) {
    let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    h = ((h + hue) % 360 + 360) % 360;
    s = Math.max(0, Math.min(1, s * satFactor));
    l = Math.max(0, Math.min(1, l + lightFactor));
    const [r, g, b] = hslToRgb(h, s, l);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return result;
}

/**
 * Apply Photoshop-style Levels adjustment.
 * @param imageData - Source image data.
 * @param inputMin - Input shadow point (0-255).
 * @param inputMax - Input highlight point (0-255).
 * @param gamma - Midtone gamma (0.1-10, 1.0 = no change).
 * @param outputMin - Output shadow level (0-255).
 * @param outputMax - Output highlight level (0-255).
 * @returns New ImageData with levels applied.
 */
export function levels(
  imageData: ImageData,
  inputMin: number,
  inputMax: number,
  gamma: number,
  outputMin: number,
  outputMax: number,
): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  const lut = new Uint8Array(256);
  const inputRange = Math.max(1, inputMax - inputMin);
  const outputRange = outputMax - outputMin;
  for (let i = 0; i < 256; i++) {
    let val = (i - inputMin) / inputRange;
    val = Math.max(0, Math.min(1, val));
    val = Math.pow(val, 1 / gamma);
    lut[i] = clamp255(val * outputRange + outputMin);
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  return result;
}

/**
 * Build a monotonic cubic spline through control points for curves.
 * @param points - Sorted control points [{x, y}] with x,y in 0-255.
 * @returns Lookup table of 256 entries.
 */
function buildCurveLUT(points: Array<{ x: number; y: number }>): Uint8Array {
  const lut = new Uint8Array(256);
  if (points.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  const sorted = [...points].sort((a, b) => a.x - b.x);
  for (let i = 0; i < 256; i++) {
    if (i <= sorted[0].x) {
      lut[i] = clamp255(sorted[0].y);
    } else if (i >= sorted[sorted.length - 1].x) {
      lut[i] = clamp255(sorted[sorted.length - 1].y);
    } else {
      let seg = 0;
      for (let j = 0; j < sorted.length - 1; j++) {
        if (i >= sorted[j].x && i <= sorted[j + 1].x) { seg = j; break; }
      }
      const p0 = sorted[seg];
      const p1 = sorted[seg + 1];
      const t = (i - p0.x) / Math.max(1, p1.x - p0.x);
      // Hermite interpolation for smooth curves
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      // Compute tangents
      const m0 = seg > 0
        ? (p1.y - sorted[seg - 1].y) / (p1.x - sorted[seg - 1].x) * (p1.x - p0.x)
        : (p1.y - p0.y);
      const m1 = seg < sorted.length - 2
        ? (sorted[seg + 2].y - p0.y) / (sorted[seg + 2].x - p0.x) * (p1.x - p0.x)
        : (p1.y - p0.y);
      lut[i] = clamp255(h00 * p0.y + h10 * m0 + h01 * p1.y + h11 * m1);
    }
  }
  return lut;
}

/**
 * Apply a tone curve using cubic spline interpolation.
 * @param imageData - Source image data.
 * @param controlPoints - Array of {x, y} control points (0-255).
 * @returns New ImageData with curve applied.
 */
export function curves(
  imageData: ImageData,
  controlPoints: Array<{ x: number; y: number }>,
): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  const lut = buildCurveLUT(controlPoints);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  return result;
}

/**
 * Adjust color balance for shadows, midtones, and highlights.
 * @param imageData - Source image data.
 * @param shadows - [cyan-red, magenta-green, yellow-blue] adjustments for shadows (-100 to 100).
 * @param midtones - [cyan-red, magenta-green, yellow-blue] adjustments for midtones.
 * @param highlights - [cyan-red, magenta-green, yellow-blue] adjustments for highlights.
 * @returns New ImageData with color balance applied.
 */
export function colorBalance(
  imageData: ImageData,
  shadows: [number, number, number],
  midtones: [number, number, number],
  highlights: [number, number, number],
): ImageData {
  const result = cloneImageData(imageData);
  const d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Weight shadows (dark), midtones (mid), highlights (bright)
    const shadowW = 1 - Math.min(1, lum * 4);
    const highlightW = Math.max(0, lum * 4 - 3);
    const midW = 1 - shadowW - highlightW;
    const adj = [
      (shadows[0] * shadowW + midtones[0] * midW + highlights[0] * highlightW) / 100,
      (shadows[1] * shadowW + midtones[1] * midW + highlights[1] * highlightW) / 100,
      (shadows[2] * shadowW + midtones[2] * midW + highlights[2] * highlightW) / 100,
    ];
    d[i] = clamp255((r + adj[0]) * 255);
    d[i + 1] = clamp255((g + adj[1]) * 255);
    d[i + 2] = clamp255((b + adj[2]) * 255);
  }
  return result;
}
