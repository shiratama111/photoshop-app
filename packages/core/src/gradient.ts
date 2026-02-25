/**
 * @module gradient
 * Gradient rendering engine for the Photoshop-like app.
 *
 * Supports linear, radial, angle (conical), and diamond gradient types.
 * Multi-stop gradients with configurable color stops and interpolation.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A gradient type supported by the engine. */
export type GradientType = 'linear' | 'radial' | 'angle' | 'diamond';

/** A single color stop in a gradient. */
export interface GradientStop {
  /** Position along the gradient in [0, 1]. */
  position: number;
  /** Red channel (0-255). */
  r: number;
  /** Green channel (0-255). */
  g: number;
  /** Blue channel (0-255). */
  b: number;
  /** Alpha channel (0-255). */
  a: number;
}

/** Full definition of a gradient to render. */
export interface GradientDef {
  type: GradientType;
  /** Gradient stops sorted by position ascending. At least two stops required. */
  stops: GradientStop[];
  /** Start point X (0-1 normalized or pixel coordinates depending on context). */
  startX: number;
  /** Start point Y. */
  startY: number;
  /** End point X. */
  endX: number;
  /** End point Y. */
  endY: number;
  /** Whether the gradient should repeat beyond the defined range. */
  repeat?: boolean;
  /** Whether to reverse the gradient direction. */
  reverse?: boolean;
  /** Dither amount 0-1 to reduce banding. Default 0. */
  dither?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Interpolate between gradient stops at a given position t in [0, 1].
 * Stops must be sorted by position.
 */
function interpolateStops(stops: GradientStop[], t: number): [number, number, number, number] {
  const tc = clamp(t, 0, 1);

  // Before first stop
  if (tc <= stops[0].position) {
    const s = stops[0];
    return [s.r, s.g, s.b, s.a];
  }

  // After last stop
  if (tc >= stops[stops.length - 1].position) {
    const s = stops[stops.length - 1];
    return [s.r, s.g, s.b, s.a];
  }

  // Find the two surrounding stops
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (tc >= s0.position && tc <= s1.position) {
      const range = s1.position - s0.position;
      const f = range === 0 ? 0 : (tc - s0.position) / range;
      return [
        Math.round(s0.r + (s1.r - s0.r) * f),
        Math.round(s0.g + (s1.g - s0.g) * f),
        Math.round(s0.b + (s1.b - s0.b) * f),
        Math.round(s0.a + (s1.a - s0.a) * f),
      ];
    }
  }

  // Fallback (should not reach)
  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b, last.a];
}

/**
 * Simple pseudo-random for dithering (deterministic per pixel).
 */
function ditherNoise(x: number, y: number): number {
  // Interleaved gradient noise (Jorge Jimenez, 2014)
  return ((52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1)) % 1) - 0.5;
}

// ---------------------------------------------------------------------------
// Gradient Rendering
// ---------------------------------------------------------------------------

/**
 * Compute the raw gradient factor t for a pixel at (px, py) given the gradient definition.
 * Returns a value in [0, 1] (or beyond if repeat is enabled).
 */
function computeGradientT(def: GradientDef, px: number, py: number): number {
  const dx = def.endX - def.startX;
  const dy = def.endY - def.startY;
  const lenSq = dx * dx + dy * dy;

  let t: number;

  switch (def.type) {
    case 'linear': {
      if (lenSq === 0) return 0;
      t = ((px - def.startX) * dx + (py - def.startY) * dy) / lenSq;
      break;
    }

    case 'radial': {
      const len = Math.sqrt(lenSq);
      if (len === 0) return 0;
      const distX = px - def.startX;
      const distY = py - def.startY;
      t = Math.sqrt(distX * distX + distY * distY) / len;
      break;
    }

    case 'angle': {
      const angle = Math.atan2(py - def.startY, px - def.startX);
      const refAngle = Math.atan2(dy, dx);
      let diff = angle - refAngle;
      // Normalize to [0, 2*PI)
      while (diff < 0) diff += Math.PI * 2;
      while (diff >= Math.PI * 2) diff -= Math.PI * 2;
      t = diff / (Math.PI * 2);
      break;
    }

    case 'diamond': {
      const len = Math.sqrt(lenSq);
      if (len === 0) return 0;
      // Rotate coordinates to align with gradient axis
      const cos = dx / len;
      const sin = dy / len;
      const relX = px - def.startX;
      const relY = py - def.startY;
      const rotX = relX * cos + relY * sin;
      const rotY = -relX * sin + relY * cos;
      t = (Math.abs(rotX) + Math.abs(rotY)) / len;
      break;
    }

    default:
      t = 0;
  }

  if (def.repeat) {
    // Ping-pong repeat
    t = t % 2;
    if (t < 0) t += 2;
    if (t > 1) t = 2 - t;
  } else {
    t = clamp(t, 0, 1);
  }

  if (def.reverse) {
    t = 1 - t;
  }

  return t;
}

/**
 * Render a gradient into an ImageData buffer.
 *
 * @param imageData - Target ImageData to fill with the gradient.
 * @param def - Gradient definition (type, stops, start/end points, etc.).
 * @returns The same ImageData object, modified in place.
 */
export function renderGradient(imageData: ImageData, def: GradientDef): ImageData {
  if (def.stops.length < 2) {
    throw new Error('Gradient requires at least 2 color stops');
  }

  // Sort stops by position
  const sortedStops = [...def.stops].sort((a, b) => a.position - b.position);
  const ditherAmount = def.dither ?? 0;
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t = computeGradientT(def, x, y);

      // Apply dithering to reduce banding
      if (ditherAmount > 0) {
        t = clamp(t + ditherNoise(x, y) * ditherAmount * 0.01, 0, 1);
      }

      const [r, g, b, a] = interpolateStops(sortedStops, t);
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }

  return imageData;
}

/**
 * Render a gradient over existing image data with alpha blending.
 *
 * @param imageData - Target ImageData. Existing pixels are composited with the gradient.
 * @param def - Gradient definition.
 * @returns The same ImageData object, modified in place.
 */
export function renderGradientOverlay(imageData: ImageData, def: GradientDef): ImageData {
  if (def.stops.length < 2) {
    throw new Error('Gradient requires at least 2 color stops');
  }

  const sortedStops = [...def.stops].sort((a, b) => a.position - b.position);
  const ditherAmount = def.dither ?? 0;
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t = computeGradientT(def, x, y);

      if (ditherAmount > 0) {
        t = clamp(t + ditherNoise(x, y) * ditherAmount * 0.01, 0, 1);
      }

      const [gr, gg, gb, ga] = interpolateStops(sortedStops, t);
      const offset = (y * width + x) * 4;

      // Alpha-over compositing
      const srcA = ga / 255;
      const dstA = data[offset + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);

      if (outA > 0) {
        data[offset] = Math.round((gr * srcA + data[offset] * dstA * (1 - srcA)) / outA);
        data[offset + 1] = Math.round((gg * srcA + data[offset + 1] * dstA * (1 - srcA)) / outA);
        data[offset + 2] = Math.round((gb * srcA + data[offset + 2] * dstA * (1 - srcA)) / outA);
        data[offset + 3] = Math.round(outA * 255);
      }
    }
  }

  return imageData;
}

// ---------------------------------------------------------------------------
// Preset Gradient Factories
// ---------------------------------------------------------------------------

/** Create a simple two-color gradient definition. */
export function createTwoColorGradient(
  type: GradientType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color1: { r: number; g: number; b: number; a: number },
  color2: { r: number; g: number; b: number; a: number },
): GradientDef {
  return {
    type,
    startX,
    startY,
    endX,
    endY,
    stops: [
      { position: 0, ...color1 },
      { position: 1, ...color2 },
    ],
  };
}

/** Create a foreground-to-transparent gradient. */
export function createForegroundToTransparent(
  type: GradientType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  fgColor: { r: number; g: number; b: number },
): GradientDef {
  return {
    type,
    startX,
    startY,
    endX,
    endY,
    stops: [
      { position: 0, r: fgColor.r, g: fgColor.g, b: fgColor.b, a: 255 },
      { position: 1, r: fgColor.r, g: fgColor.g, b: fgColor.b, a: 0 },
    ],
  };
}

/** Create a black-to-white gradient. */
export function createBlackWhiteGradient(
  type: GradientType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): GradientDef {
  return createTwoColorGradient(
    type,
    startX, startY, endX, endY,
    { r: 0, g: 0, b: 0, a: 255 },
    { r: 255, g: 255, b: 255, a: 255 },
  );
}

/** Create a rainbow (spectrum) gradient. */
export function createRainbowGradient(
  type: GradientType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): GradientDef {
  return {
    type,
    startX,
    startY,
    endX,
    endY,
    stops: [
      { position: 0, r: 255, g: 0, b: 0, a: 255 },
      { position: 0.17, r: 255, g: 165, b: 0, a: 255 },
      { position: 0.33, r: 255, g: 255, b: 0, a: 255 },
      { position: 0.5, r: 0, g: 128, b: 0, a: 255 },
      { position: 0.67, r: 0, g: 0, b: 255, a: 255 },
      { position: 0.83, r: 75, g: 0, b: 130, a: 255 },
      { position: 1, r: 238, g: 130, b: 238, a: 255 },
    ],
  };
}

/** Photoshop-style preset gradient names. */
export type PresetGradientName =
  | 'foreground-background'
  | 'foreground-transparent'
  | 'black-white'
  | 'rainbow'
  | 'chrome'
  | 'copper';

/** Create a chrome (metallic) preset gradient. */
export function createChromeGradient(
  type: GradientType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): GradientDef {
  return {
    type,
    startX,
    startY,
    endX,
    endY,
    stops: [
      { position: 0, r: 46, g: 46, b: 46, a: 255 },
      { position: 0.25, r: 200, g: 200, b: 200, a: 255 },
      { position: 0.5, r: 90, g: 90, b: 90, a: 255 },
      { position: 0.75, r: 240, g: 240, b: 240, a: 255 },
      { position: 1, r: 46, g: 46, b: 46, a: 255 },
    ],
  };
}

/** Create a copper preset gradient. */
export function createCopperGradient(
  type: GradientType,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): GradientDef {
  return {
    type,
    startX,
    startY,
    endX,
    endY,
    stops: [
      { position: 0, r: 60, g: 20, b: 10, a: 255 },
      { position: 0.3, r: 180, g: 100, b: 50, a: 255 },
      { position: 0.6, r: 220, g: 160, b: 80, a: 255 },
      { position: 0.85, r: 255, g: 200, b: 120, a: 255 },
      { position: 1, r: 60, g: 20, b: 10, a: 255 },
    ],
  };
}
