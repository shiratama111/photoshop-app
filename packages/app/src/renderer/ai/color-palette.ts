/**
 * @module ai/color-palette
 * Color palette extraction from thumbnail images using median-cut quantization.
 *
 * Extracts 5-8 dominant colors from an image, classifies them by role
 * (background, accent, text), and calculates WCAG contrast ratios.
 *
 * Algorithm:
 * 1. Sample pixels from the ImageData (every Nth pixel for performance)
 * 2. Apply median-cut quantization to reduce to `colorCount` buckets
 * 3. Sort buckets by pixel frequency (descending)
 * 4. Classify roles: background = largest area, accent = most saturated non-bg,
 *    text = highest contrast to background
 * 5. Compute WCAG contrast ratio between text and background colors
 *
 * @see ANALYZE-001: Thumbnail Analysis Engine
 * @see {@link ./thumbnail-analyzer.ts} — main analyzer that calls extractColorPalette
 * @see https://www.w3.org/TR/WCAG20/#contrast-ratiodef — WCAG contrast formula
 */

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Role classification for a color in the palette. */
export type ColorRole = 'background' | 'accent' | 'text';

/** A single color extracted from the image with frequency and role metadata. */
export interface PaletteColor {
  /** Red channel (0-255). */
  r: number;
  /** Green channel (0-255). */
  g: number;
  /** Blue channel (0-255). */
  b: number;
  /** Proportion of pixels assigned to this color (0-1). */
  frequency: number;
  /** Classified role in the design. */
  role: ColorRole;
}

/** Extracted color palette from an image. */
export interface ColorPalette {
  /** The single most dominant color. */
  dominant: PaletteColor;
  /** All extracted colors sorted by frequency (descending). */
  colors: PaletteColor[];
  /** WCAG contrast ratio between the text-role and background-role colors. */
  contrastRatio: number;
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** RGB triplet used internally during quantization. */
interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

/** A bucket of pixels produced by the median-cut algorithm. */
interface ColorBucket {
  /** Pixels assigned to this bucket. */
  pixels: RgbPixel[];
  /** Average color of all pixels in the bucket. */
  average: RgbPixel;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum pixels to sample for performance (stride is computed from this). */
const MAX_SAMPLE_PIXELS = 50_000;

/** Default number of colors to extract. */
const DEFAULT_COLOR_COUNT = 6;

/** Minimum number of colors to extract. */
const MIN_COLOR_COUNT = 2;

/** Maximum number of colors to extract. */
const MAX_COLOR_COUNT = 16;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a color palette from image data using median-cut quantization.
 *
 * @param imageData - The image pixel data (RGBA).
 * @param colorCount - Number of dominant colors to extract (default: 6, range: 2-16).
 * @returns A {@link ColorPalette} with classified colors and contrast ratio.
 *
 * @example
 * ```ts
 * const palette = extractColorPalette(canvasCtx.getImageData(0, 0, w, h));
 * console.log(palette.dominant); // { r: 30, g: 30, b: 30, frequency: 0.45, role: 'background' }
 * console.log(palette.contrastRatio); // 12.4
 * ```
 */
export function extractColorPalette(
  imageData: ImageData,
  colorCount: number = DEFAULT_COLOR_COUNT,
): ColorPalette {
  const clampedCount = Math.max(MIN_COLOR_COUNT, Math.min(MAX_COLOR_COUNT, Math.round(colorCount)));

  // Step 1: Sample pixels
  const pixels = samplePixels(imageData);

  // Edge case: empty or very small image
  if (pixels.length === 0) {
    const black: PaletteColor = { r: 0, g: 0, b: 0, frequency: 1, role: 'background' };
    return { dominant: black, colors: [black], contrastRatio: 1 };
  }

  // Step 2: Median-cut quantization
  const buckets = medianCut(pixels, clampedCount);

  // Step 3: Calculate frequencies and create unclassified colors
  const totalPixels = pixels.length;
  const rawColors: Array<{ r: number; g: number; b: number; frequency: number }> = buckets
    .map((bucket) => ({
      r: Math.round(bucket.average.r),
      g: Math.round(bucket.average.g),
      b: Math.round(bucket.average.b),
      frequency: bucket.pixels.length / totalPixels,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // Step 4: Classify roles
  const classified = classifyRoles(rawColors);

  // Step 5: Compute contrast ratio
  const bgColor = classified.find((c) => c.role === 'background') ?? classified[0];
  const textColor = classified.find((c) => c.role === 'text') ?? classified[classified.length - 1];
  const contrastRatio = calculateContrastRatio(bgColor, textColor);

  return {
    dominant: classified[0],
    colors: classified,
    contrastRatio,
  };
}

/**
 * Calculate the WCAG 2.0 contrast ratio between two colors.
 *
 * The contrast ratio ranges from 1:1 (identical) to 21:1 (black vs white).
 * WCAG AA requires at least 4.5:1 for normal text, 3:1 for large text.
 *
 * @param color1 - First color (needs r, g, b in 0-255).
 * @param color2 - Second color (needs r, g, b in 0-255).
 * @returns Contrast ratio as a number >= 1.
 *
 * @see https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 *
 * @example
 * ```ts
 * calculateContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }); // 21
 * calculateContrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 }); // 1
 * ```
 */
export function calculateContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(color1.r, color1.g, color1.b);
  const l2 = relativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Pixel Sampling
// ---------------------------------------------------------------------------

/**
 * Sample RGB pixels from ImageData, skipping transparent pixels.
 * Uses a stride to keep the sample count under {@link MAX_SAMPLE_PIXELS}.
 *
 * @param imageData - Source image data (RGBA).
 * @returns Array of sampled RGB pixels.
 */
function samplePixels(imageData: ImageData): RgbPixel[] {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const stride = Math.max(1, Math.floor(totalPixels / MAX_SAMPLE_PIXELS));
  const pixels: RgbPixel[] = [];

  for (let i = 0; i < totalPixels; i += stride) {
    const offset = i * 4;
    const a = data[offset + 3];
    // Skip fully transparent pixels
    if (a < 10) continue;
    pixels.push({
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
    });
  }

  return pixels;
}

// ---------------------------------------------------------------------------
// Median-Cut Quantization
// ---------------------------------------------------------------------------

/**
 * Perform median-cut color quantization on a set of pixels.
 *
 * Recursively splits the pixel set along the channel with the widest range
 * until the target number of buckets is reached.
 *
 * @param pixels - Input pixels to quantize.
 * @param targetCount - Target number of color buckets.
 * @returns Array of color buckets with averaged colors.
 */
function medianCut(pixels: RgbPixel[], targetCount: number): ColorBucket[] {
  if (pixels.length === 0) {
    return [];
  }

  // Start with a single bucket containing all pixels
  const buckets: RgbPixel[][] = [pixels];

  // Split until we reach target count or can't split further
  while (buckets.length < targetCount) {
    // Find the bucket with the widest range to split
    let bestIdx = -1;
    let bestRange = -1;
    let bestChannel: 'r' | 'g' | 'b' = 'r';

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.length < 2) continue;

      const range = getWidestChannel(bucket);
      if (range.range > bestRange) {
        bestRange = range.range;
        bestIdx = i;
        bestChannel = range.channel;
      }
    }

    // Can't split any further
    if (bestIdx === -1) break;

    // Sort the chosen bucket by the widest channel and split at median
    const toSplit = buckets[bestIdx];
    toSplit.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(toSplit.length / 2);

    const left = toSplit.slice(0, mid);
    const right = toSplit.slice(mid);

    // Replace the split bucket with the two halves
    buckets.splice(bestIdx, 1, left, right);
  }

  // Convert pixel arrays to color buckets with averages
  return buckets
    .filter((b) => b.length > 0)
    .map((pixels) => ({
      pixels,
      average: averageColor(pixels),
    }));
}

/**
 * Find the color channel with the widest range in a set of pixels.
 *
 * @param pixels - Pixels to analyze.
 * @returns The channel name and its range.
 */
function getWidestChannel(
  pixels: RgbPixel[],
): { channel: 'r' | 'g' | 'b'; range: number } {
  let rMin = 255, rMax = 0;
  let gMin = 255, gMax = 0;
  let bMin = 255, bMax = 0;

  for (const p of pixels) {
    if (p.r < rMin) rMin = p.r;
    if (p.r > rMax) rMax = p.r;
    if (p.g < gMin) gMin = p.g;
    if (p.g > gMax) gMax = p.g;
    if (p.b < bMin) bMin = p.b;
    if (p.b > bMax) bMax = p.b;
  }

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;

  if (rRange >= gRange && rRange >= bRange) return { channel: 'r', range: rRange };
  if (gRange >= bRange) return { channel: 'g', range: gRange };
  return { channel: 'b', range: bRange };
}

/**
 * Compute the average RGB color of a set of pixels.
 *
 * @param pixels - Pixels to average.
 * @returns The averaged color.
 */
function averageColor(pixels: RgbPixel[]): RgbPixel {
  if (pixels.length === 0) return { r: 0, g: 0, b: 0 };

  let rSum = 0, gSum = 0, bSum = 0;
  for (const p of pixels) {
    rSum += p.r;
    gSum += p.g;
    bSum += p.b;
  }
  const n = pixels.length;
  return {
    r: rSum / n,
    g: gSum / n,
    b: bSum / n,
  };
}

// ---------------------------------------------------------------------------
// Role Classification
// ---------------------------------------------------------------------------

/**
 * Classify extracted colors by role (background, accent, text).
 *
 * - Background: the color with the highest frequency (largest area).
 * - Accent: the most saturated non-background color.
 * - Text: the color with the highest contrast to the background.
 * - Remaining colors are left as 'background' role.
 *
 * @param rawColors - Unclassified colors sorted by frequency descending.
 * @returns Classified {@link PaletteColor} array.
 */
function classifyRoles(
  rawColors: Array<{ r: number; g: number; b: number; frequency: number }>,
): PaletteColor[] {
  if (rawColors.length === 0) {
    return [{ r: 0, g: 0, b: 0, frequency: 1, role: 'background' }];
  }

  // Initialize all as 'background' role
  const classified: PaletteColor[] = rawColors.map((c) => ({
    ...c,
    role: 'background' as ColorRole,
  }));

  // First color (highest frequency) is always background
  classified[0].role = 'background';

  if (classified.length < 2) return classified;

  // Find accent: most saturated non-background color
  let bestAccentIdx = -1;
  let bestSaturation = -1;
  for (let i = 1; i < classified.length; i++) {
    const sat = colorSaturation(classified[i]);
    if (sat > bestSaturation) {
      bestSaturation = sat;
      bestAccentIdx = i;
    }
  }
  if (bestAccentIdx >= 0) {
    classified[bestAccentIdx].role = 'accent';
  }

  // Find text: highest contrast to background
  const bg = classified[0];
  let bestTextIdx = -1;
  let bestContrast = -1;
  for (let i = 1; i < classified.length; i++) {
    if (classified[i].role === 'accent') continue;
    const contrast = calculateContrastRatio(bg, classified[i]);
    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestTextIdx = i;
    }
  }
  if (bestTextIdx >= 0) {
    classified[bestTextIdx].role = 'text';
  } else if (classified.length >= 2) {
    // If no text candidate found (all are accent), assign the highest-contrast one
    let fallbackIdx = -1;
    let fallbackContrast = -1;
    for (let i = 1; i < classified.length; i++) {
      const contrast = calculateContrastRatio(bg, classified[i]);
      if (contrast > fallbackContrast) {
        fallbackContrast = contrast;
        fallbackIdx = i;
      }
    }
    if (fallbackIdx >= 0) {
      classified[fallbackIdx].role = 'text';
    }
  }

  return classified;
}

/**
 * Compute the HSL saturation of an RGB color (0-1).
 *
 * @param color - Color to analyze.
 * @returns Saturation value between 0 and 1.
 */
function colorSaturation(color: { r: number; g: number; b: number }): number {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  const l = (max + min) / 2;
  return l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
}

// ---------------------------------------------------------------------------
// WCAG Luminance
// ---------------------------------------------------------------------------

/**
 * Compute relative luminance for WCAG contrast ratio.
 *
 * @param r - Red channel (0-255).
 * @param g - Green channel (0-255).
 * @param b - Blue channel (0-255).
 * @returns Relative luminance (0-1).
 *
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLin = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLin = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLin = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}
