// Color utility functions for Photoshop-like app
// Provides color space conversions, blending, and eyedropper operations.
// All RGB values are in range 0-255.
// HSL: h 0-360, s 0-100, l 0-100
// HSB: h 0-360, s 0-100, b 0-100
// CMYK: c 0-100, m 0-100, y 0-100, k 0-100

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** RGB color with channels in the 0-255 range. */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** HSL color: h 0-360, s 0-100, l 0-100. */
export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/** HSB/HSV color: h 0-360, s 0-100, b 0-100. */
export interface HsbColor {
  h: number;
  s: number;
  b: number;
}

/** CMYK color with all channels in the 0-100 range. */
export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
}

/** RGBA color: r, g, b in 0-255 and a in 0-1. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round a number to a given number of decimal places. */
function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Color Space Conversion
// ---------------------------------------------------------------------------

/**
 * Convert RGB to HSL.
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns HSL color with h (0-360), s (0-100), l (0-100)
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
    } else if (max === gNorm) {
      h = ((bNorm - rNorm) / delta + 2) * 60;
    } else {
      h = ((rNorm - gNorm) / delta + 4) * 60;
    }
  }

  return {
    h: round(h, 1),
    s: round(s * 100, 1),
    l: round(l * 100, 1),
  };
}

/**
 * Convert HSL to RGB.
 *
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns RGB color with channels in 0-255
 */
export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = lNorm - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hPrime >= 0 && hPrime < 1) {
    r1 = c; g1 = x; b1 = 0;
  } else if (hPrime >= 1 && hPrime < 2) {
    r1 = x; g1 = c; b1 = 0;
  } else if (hPrime >= 2 && hPrime < 3) {
    r1 = 0; g1 = c; b1 = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    r1 = 0; g1 = x; b1 = c;
  } else if (hPrime >= 4 && hPrime < 5) {
    r1 = x; g1 = 0; b1 = c;
  } else if (hPrime >= 5 && hPrime < 6) {
    r1 = c; g1 = 0; b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Convert RGB to HSB (also known as HSV).
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns HSB color with h (0-360), s (0-100), b (0-100)
 */
export function rgbToHsb(r: number, g: number, b: number): HsbColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const brightness = max;

  if (delta !== 0) {
    s = delta / max;

    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
    } else if (max === gNorm) {
      h = ((bNorm - rNorm) / delta + 2) * 60;
    } else {
      h = ((rNorm - gNorm) / delta + 4) * 60;
    }
  }

  return {
    h: round(h, 1),
    s: round(s * 100, 1),
    b: round(brightness * 100, 1),
  };
}

/**
 * Convert HSB (HSV) to RGB.
 *
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param b - Brightness/Value (0-100)
 * @returns RGB color with channels in 0-255
 */
export function hsbToRgb(h: number, s: number, b: number): RgbColor {
  const sNorm = s / 100;
  const bNorm = b / 100;

  const c = bNorm * sNorm;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = bNorm - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hPrime >= 0 && hPrime < 1) {
    r1 = c; g1 = x; b1 = 0;
  } else if (hPrime >= 1 && hPrime < 2) {
    r1 = x; g1 = c; b1 = 0;
  } else if (hPrime >= 2 && hPrime < 3) {
    r1 = 0; g1 = c; b1 = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    r1 = 0; g1 = x; b1 = c;
  } else if (hPrime >= 4 && hPrime < 5) {
    r1 = x; g1 = 0; b1 = c;
  } else if (hPrime >= 5 && hPrime < 6) {
    r1 = c; g1 = 0; b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Convert RGB to CMYK.
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns CMYK color with all channels in 0-100
 */
export function rgbToCmyk(r: number, g: number, b: number): CmykColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const k = 1 - Math.max(rNorm, gNorm, bNorm);

  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);

  return {
    c: round(c * 100, 1),
    m: round(m * 100, 1),
    y: round(y * 100, 1),
    k: round(k * 100, 1),
  };
}

/**
 * Convert CMYK to RGB.
 *
 * @param c - Cyan (0-100)
 * @param m - Magenta (0-100)
 * @param y - Yellow (0-100)
 * @param k - Key/Black (0-100)
 * @returns RGB color with channels in 0-255
 */
export function cmykToRgb(c: number, m: number, y: number, k: number): RgbColor {
  const cNorm = c / 100;
  const mNorm = m / 100;
  const yNorm = y / 100;
  const kNorm = k / 100;

  const r = 255 * (1 - cNorm) * (1 - kNorm);
  const g = 255 * (1 - mNorm) * (1 - kNorm);
  const b = 255 * (1 - yNorm) * (1 - kNorm);

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
  };
}

// ---------------------------------------------------------------------------
// Hex Conversion
// ---------------------------------------------------------------------------

/**
 * Convert RGB to a hex color string.
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns Hex string in the form "#RRGGBB"
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parse a hex color string to RGB.
 * Supports "#RGB", "#RRGGBB", and "#RRGGBBAA" formats (with or without leading #).
 *
 * @param hex - Hex color string
 * @returns RgbColor or null if the string is invalid
 */
export function hexToRgb(hex: string): RgbColor | null {
  const cleaned = hex.replace(/^#/, "");

  let r: number;
  let g: number;
  let b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length === 6 || cleaned.length === 8) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    return null;
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

/**
 * Convert RGBA to a hex color string with alpha.
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @param a - Alpha channel (0-1)
 * @returns Hex string in the form "#RRGGBBAA"
 */
export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const alphaHex = clamp(Math.round(a * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`;
}

// ---------------------------------------------------------------------------
// Color Operations
// ---------------------------------------------------------------------------

/**
 * Alpha-composite the foreground color over the background color.
 *
 * @param bg - Background RGBA color (a in 0-1)
 * @param fg - Foreground RGBA color (a in 0-1)
 * @returns Composited RGBA color
 */
export function blendColors(bg: RgbaColor, fg: RgbaColor): RgbaColor {
  const aFg = fg.a;
  const aBg = bg.a;
  const aOut = aFg + aBg * (1 - aFg);

  if (aOut === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: Math.round((fg.r * aFg + bg.r * aBg * (1 - aFg)) / aOut),
    g: Math.round((fg.g * aFg + bg.g * aBg * (1 - aFg)) / aOut),
    b: Math.round((fg.b * aFg + bg.b * aBg * (1 - aFg)) / aOut),
    a: round(aOut, 4),
  };
}

/**
 * Linearly interpolate between two RGBA colors.
 *
 * @param c1 - Start color
 * @param c2 - End color
 * @param t - Interpolation factor (0 = c1, 1 = c2)
 * @returns Interpolated RGBA color
 */
export function interpolateColors(c1: RgbaColor, c2: RgbaColor, t: number): RgbaColor {
  const tClamped = clamp(t, 0, 1);
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * tClamped),
    g: Math.round(c1.g + (c2.g - c1.g) * tClamped),
    b: Math.round(c1.b + (c2.b - c1.b) * tClamped),
    a: round(c1.a + (c2.a - c1.a) * tClamped, 4),
  };
}

/**
 * Calculate the Euclidean distance between two RGB colors.
 *
 * @param c1 - First color
 * @param c2 - Second color
 * @returns Distance as a non-negative number
 */
export function colorDistance(c1: RgbColor, c2: RgbColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Calculate the relative luminance of an RGB color per WCAG 2.x.
 *
 * Uses the sRGB linearization formula:
 *   if C_srgb <= 0.04045 then C_linear = C_srgb / 12.92
 *   else C_linear = ((C_srgb + 0.055) / 1.055) ^ 2.4
 *
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @returns Relative luminance in the range 0-1
 */
export function luminance(r: number, g: number, b: number): number {
  const linearize = (channel: number): number => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };

  const rLin = linearize(r);
  const gLin = linearize(g);
  const bLin = linearize(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculate the WCAG contrast ratio between two colors.
 *
 * @param c1 - First color
 * @param c2 - Second color
 * @returns Contrast ratio (1 to 21)
 */
export function contrastRatio(c1: RgbColor, c2: RgbColor): number {
  const l1 = luminance(c1.r, c1.g, c1.b);
  const l2 = luminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return round((lighter + 0.05) / (darker + 0.05), 2);
}

/**
 * Darken a color by a percentage.
 *
 * Reduces the lightness in HSL space by the given amount.
 *
 * @param color - RGB color to darken
 * @param amount - Percentage to darken (0-100)
 * @returns Darkened RGB color
 */
export function darken(color: RgbColor, amount: number): RgbColor {
  const hsl = rgbToHsl(color.r, color.g, color.b);
  hsl.l = clamp(hsl.l - amount, 0, 100);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * Lighten a color by a percentage.
 *
 * Increases the lightness in HSL space by the given amount.
 *
 * @param color - RGB color to lighten
 * @param amount - Percentage to lighten (0-100)
 * @returns Lightened RGB color
 */
export function lighten(color: RgbColor, amount: number): RgbColor {
  const hsl = rgbToHsl(color.r, color.g, color.b);
  hsl.l = clamp(hsl.l + amount, 0, 100);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * Increase the saturation of a color by an amount.
 *
 * Increases the saturation in HSL space by the given amount.
 *
 * @param color - RGB color to saturate
 * @param amount - Amount to increase saturation (0-100)
 * @returns Saturated RGB color
 */
export function saturate(color: RgbColor, amount: number): RgbColor {
  const hsl = rgbToHsl(color.r, color.g, color.b);
  hsl.s = clamp(hsl.s + amount, 0, 100);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * Decrease the saturation of a color by an amount.
 *
 * Reduces the saturation in HSL space by the given amount.
 *
 * @param color - RGB color to desaturate
 * @param amount - Amount to decrease saturation (0-100)
 * @returns Desaturated RGB color
 */
export function desaturateColor(color: RgbColor, amount: number): RgbColor {
  const hsl = rgbToHsl(color.r, color.g, color.b);
  hsl.s = clamp(hsl.s - amount, 0, 100);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

/**
 * Invert an RGB color.
 *
 * @param color - RGB color to invert
 * @returns Inverted RGB color
 */
export function invertColor(color: RgbColor): RgbColor {
  return {
    r: 255 - color.r,
    g: 255 - color.g,
    b: 255 - color.b,
  };
}

// ---------------------------------------------------------------------------
// Eyedropper
// ---------------------------------------------------------------------------

/**
 * Pick the color of a single pixel from ImageData.
 *
 * @param imageData - The ImageData to sample from
 * @param x - X coordinate (integer, 0-based)
 * @param y - Y coordinate (integer, 0-based)
 * @returns RGBA color at the specified pixel
 */
export function pickColor(imageData: ImageData, x: number, y: number): RgbaColor {
  const ix = clamp(Math.round(x), 0, imageData.width - 1);
  const iy = clamp(Math.round(y), 0, imageData.height - 1);
  const offset = (iy * imageData.width + ix) * 4;

  return {
    r: imageData.data[offset],
    g: imageData.data[offset + 1],
    b: imageData.data[offset + 2],
    a: round(imageData.data[offset + 3] / 255, 4),
  };
}

/**
 * Pick the average color of a square area centered on (x, y).
 *
 * The area is sampleSize x sampleSize pixels and is clamped to the image bounds.
 *
 * @param imageData - The ImageData to sample from
 * @param x - Center X coordinate
 * @param y - Center Y coordinate
 * @param sampleSize - Width and height of the sampling area in pixels
 * @returns Average RGBA color across the sampled area
 */
export function pickColorAverage(
  imageData: ImageData,
  x: number,
  y: number,
  sampleSize: number,
): RgbaColor {
  const half = Math.floor(sampleSize / 2);
  const xStart = clamp(Math.round(x) - half, 0, imageData.width - 1);
  const yStart = clamp(Math.round(y) - half, 0, imageData.height - 1);
  const xEnd = clamp(Math.round(x) + half, 0, imageData.width - 1);
  const yEnd = clamp(Math.round(y) + half, 0, imageData.height - 1);

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalA = 0;
  let count = 0;

  for (let py = yStart; py <= yEnd; py++) {
    for (let px = xStart; px <= xEnd; px++) {
      const offset = (py * imageData.width + px) * 4;
      totalR += imageData.data[offset];
      totalG += imageData.data[offset + 1];
      totalB += imageData.data[offset + 2];
      totalA += imageData.data[offset + 3];
      count++;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
    a: round(totalA / count / 255, 4),
  };
}
