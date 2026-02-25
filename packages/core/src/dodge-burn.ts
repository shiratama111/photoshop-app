/**
 * @module dodge-burn
 * Dodge, Burn, and Sponge tool engines for the Photoshop-like app.
 *
 * - Dodge: Lightens pixels (increases exposure).
 * - Burn: Darkens pixels (decreases exposure).
 * - Sponge: Saturates or desaturates pixels.
 *
 * Each tool works by applying a soft brush dab that modifies pixel values
 * in place using HSL color space transformations.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tonal range to target. */
export type ToneRange = 'shadows' | 'midtones' | 'highlights';

/** Sponge mode. */
export type SpongeMode = 'saturate' | 'desaturate';

/** Brush parameters shared by dodge/burn/sponge. */
export interface DodgeBurnBrush {
  /** Brush diameter in pixels. */
  size: number;
  /** Brush hardness (0 = soft, 1 = hard). */
  hardness: number;
  /** Exposure/strength (0-1). Higher = more effect per dab. */
  exposure: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function brushAlpha(d: number, radius: number, hardness: number): number {
  if (d >= radius) return 0;
  if (hardness >= 1) return 1;
  const hardRadius = radius * hardness;
  if (d <= hardRadius) return 1;
  return 1 - (d - hardRadius) / (radius - hardRadius);
}

/** Convert RGB (0-255) to HSL (h: 0-360, s: 0-1, l: 0-1). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) / 6;
    } else {
      h = ((rn - gn) / delta + 4) / 6;
    }
  }

  return [h * 360, s, l];
}

/** Convert HSL (h: 0-360, s: 0-1, l: 0-1) back to RGB (0-255). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  return [
    Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hNorm) * 255),
    Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  ];
}

/**
 * Compute a weight for how much the dodge/burn effect applies
 * to a pixel based on its luminosity and the target tone range.
 */
function toneWeight(l: number, range: ToneRange): number {
  switch (range) {
    case 'shadows':
      // Strongest in dark pixels, falls off above 0.33
      return l < 0.33 ? 1 : l < 0.67 ? 1 - (l - 0.33) / 0.34 : 0;
    case 'highlights':
      // Strongest in bright pixels, falls off below 0.67
      return l > 0.67 ? 1 : l > 0.33 ? (l - 0.33) / 0.34 : 0;
    case 'midtones':
    default:
      // Strongest around 0.5, falls off toward 0 and 1
      if (l < 0.25) return l / 0.25;
      if (l > 0.75) return (1 - l) / 0.25;
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Dodge Tool
// ---------------------------------------------------------------------------

/**
 * Apply a dodge (lighten) dab at the given position.
 * Modifies the imageData in place.
 *
 * @param imageData - Target image data (modified in place).
 * @param cx - Center X of the dab.
 * @param cy - Center Y of the dab.
 * @param brush - Brush parameters.
 * @param range - Which tonal range to target.
 */
export function dodgeDab(
  imageData: ImageData,
  cx: number,
  cy: number,
  brush: DodgeBurnBrush,
  range: ToneRange = 'midtones',
): void {
  const { width, height, data } = imageData;
  const radius = brush.size / 2;
  const r = Math.ceil(radius);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = brushAlpha(dist, radius, brush.hardness);
      if (alpha <= 0) continue;

      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const idx = (py * width + px) * 4;
      const [h, s, l] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);

      const weight = toneWeight(l, range);
      const amount = brush.exposure * alpha * weight * 0.1; // Scale down for subtlety
      const newL = clamp(l + amount, 0, 1);

      const [nr, ng, nb] = hslToRgb(h, s, newL);
      data[idx] = nr;
      data[idx + 1] = ng;
      data[idx + 2] = nb;
    }
  }
}

// ---------------------------------------------------------------------------
// Burn Tool
// ---------------------------------------------------------------------------

/**
 * Apply a burn (darken) dab at the given position.
 * Modifies the imageData in place.
 *
 * @param imageData - Target image data (modified in place).
 * @param cx - Center X of the dab.
 * @param cy - Center Y of the dab.
 * @param brush - Brush parameters.
 * @param range - Which tonal range to target.
 */
export function burnDab(
  imageData: ImageData,
  cx: number,
  cy: number,
  brush: DodgeBurnBrush,
  range: ToneRange = 'midtones',
): void {
  const { width, height, data } = imageData;
  const radius = brush.size / 2;
  const r = Math.ceil(radius);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = brushAlpha(dist, radius, brush.hardness);
      if (alpha <= 0) continue;

      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const idx = (py * width + px) * 4;
      const [h, s, l] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);

      const weight = toneWeight(l, range);
      const amount = brush.exposure * alpha * weight * 0.1;
      const newL = clamp(l - amount, 0, 1);

      const [nr, ng, nb] = hslToRgb(h, s, newL);
      data[idx] = nr;
      data[idx + 1] = ng;
      data[idx + 2] = nb;
    }
  }
}

// ---------------------------------------------------------------------------
// Sponge Tool
// ---------------------------------------------------------------------------

/**
 * Apply a sponge (saturate/desaturate) dab at the given position.
 * Modifies the imageData in place.
 *
 * @param imageData - Target image data (modified in place).
 * @param cx - Center X of the dab.
 * @param cy - Center Y of the dab.
 * @param brush - Brush parameters.
 * @param mode - 'saturate' to increase color, 'desaturate' to decrease.
 */
export function spongeDab(
  imageData: ImageData,
  cx: number,
  cy: number,
  brush: DodgeBurnBrush,
  mode: SpongeMode = 'desaturate',
): void {
  const { width, height, data } = imageData;
  const radius = brush.size / 2;
  const r = Math.ceil(radius);
  const sign = mode === 'saturate' ? 1 : -1;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = brushAlpha(dist, radius, brush.hardness);
      if (alpha <= 0) continue;

      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const idx = (py * width + px) * 4;
      const [h, s, l] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);

      const amount = brush.exposure * alpha * 0.05 * sign;
      const newS = clamp(s + amount, 0, 1);

      const [nr, ng, nb] = hslToRgb(h, newS, l);
      data[idx] = nr;
      data[idx + 1] = ng;
      data[idx + 2] = nb;
    }
  }
}

// ---------------------------------------------------------------------------
// Stroke helpers
// ---------------------------------------------------------------------------

/**
 * Apply dodge along a stroke path.
 */
export function dodgeStroke(
  imageData: ImageData,
  points: Array<{ x: number; y: number }>,
  brush: DodgeBurnBrush,
  range: ToneRange = 'midtones',
  spacing: number = 0.25,
): void {
  applyStroke(imageData, points, brush, spacing, (cx, cy) => {
    dodgeDab(imageData, cx, cy, brush, range);
  });
}

/**
 * Apply burn along a stroke path.
 */
export function burnStroke(
  imageData: ImageData,
  points: Array<{ x: number; y: number }>,
  brush: DodgeBurnBrush,
  range: ToneRange = 'midtones',
  spacing: number = 0.25,
): void {
  applyStroke(imageData, points, brush, spacing, (cx, cy) => {
    burnDab(imageData, cx, cy, brush, range);
  });
}

/**
 * Apply sponge along a stroke path.
 */
export function spongeStroke(
  imageData: ImageData,
  points: Array<{ x: number; y: number }>,
  brush: DodgeBurnBrush,
  mode: SpongeMode = 'desaturate',
  spacing: number = 0.25,
): void {
  applyStroke(imageData, points, brush, spacing, (cx, cy) => {
    spongeDab(imageData, cx, cy, brush, mode);
  });
}

/** Internal: walk along stroke points with spacing. */
function applyStroke(
  _imageData: ImageData,
  points: Array<{ x: number; y: number }>,
  brush: DodgeBurnBrush,
  spacing: number,
  dabFn: (cx: number, cy: number) => void,
): void {
  if (points.length === 0) return;
  const step = Math.max(1, brush.size * spacing);

  dabFn(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < step) {
      dabFn(curr.x, curr.y);
      continue;
    }

    const steps = Math.ceil(dist / step);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      dabFn(prev.x + dx * t, prev.y + dy * t);
    }
  }
}
