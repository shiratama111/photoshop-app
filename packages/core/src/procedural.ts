/**
 * @module procedural
 * Procedural image generation functions for backgrounds, patterns, borders, etc.
 *
 * All functions return ImageData objects that can be used as raster layer content.
 * Pure functions with no side effects — suitable for use in Web Workers.
 *
 * @see Phase 1-3: Background & atmosphere tools
 * @see Phase 1-4: Border & decoration effects
 */

import { renderGradient } from './gradient';
import type { GradientStop, GradientType, GradientDef } from './gradient';

export type { GradientStop, GradientType };

/** RGBA color with channels 0-255. */
export interface ProceduralColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Pattern types for overlay generation. */
export type PatternType = 'dots' | 'stripes' | 'checker' | 'diagonal-stripes';

/** Border style types. */
export type BorderStyle = 'solid' | 'double' | 'dashed';

/** Gradient mask direction. */
export type MaskDirection = 'top' | 'bottom' | 'left' | 'right' | 'radial';

// ---------------------------------------------------------------------------
// Gradient Background
// ---------------------------------------------------------------------------

/**
 * Generate a gradient background as ImageData.
 *
 * Uses the existing renderGradient engine for pixel-perfect gradients.
 *
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param stops - Gradient color stops (position 0-1, RGBA 0-255)
 * @param type - Gradient type (linear, radial, angle, diamond)
 * @param angle - Angle in degrees for linear gradients (0-360)
 */
export function generateGradientBackground(
  width: number,
  height: number,
  stops: GradientStop[],
  type: GradientType,
  angle: number = 180,
): ImageData {
  const imageData = new ImageData(width, height);

  // Convert angle (degrees) to start/end points
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.sqrt(width * width + height * height) / 2;

  let def: GradientDef;

  if (type === 'radial') {
    def = {
      type: 'radial',
      stops,
      startX: cx,
      startY: cy,
      endX: cx + diag,
      endY: cy,
      dither: 0.5,
    };
  } else {
    const dx = Math.cos(rad) * diag;
    const dy = Math.sin(rad) * diag;
    def = {
      type,
      stops,
      startX: cx - dx,
      startY: cy - dy,
      endX: cx + dx,
      endY: cy + dy,
      dither: 0.5,
    };
  }

  return renderGradient(imageData, def);
}

// ---------------------------------------------------------------------------
// Pattern Overlay
// ---------------------------------------------------------------------------

/**
 * Generate a repeating pattern overlay as ImageData.
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param pattern - Pattern type
 * @param color - Pattern color (RGBA 0-255)
 * @param spacing - Distance between pattern elements in pixels
 * @param size - Size of each pattern element in pixels
 * @param opacity - Overall opacity 0-1
 */
export function generatePattern(
  width: number,
  height: number,
  pattern: PatternType,
  color: ProceduralColor,
  spacing: number,
  size: number,
  opacity: number,
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  const alpha = Math.round(color.a * opacity);

  switch (pattern) {
    case 'dots': {
      const step = spacing + size;
      for (let cy = Math.floor(size / 2); cy < height; cy += step) {
        for (let cx = Math.floor(size / 2); cx < width; cx += step) {
          const r = size / 2;
          const rSq = r * r;
          const minY = Math.max(0, Math.floor(cy - r));
          const maxY = Math.min(height - 1, Math.ceil(cy + r));
          const minX = Math.max(0, Math.floor(cx - r));
          const maxX = Math.min(width - 1, Math.ceil(cx + r));
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const dx = x - cx;
              const dy = y - cy;
              if (dx * dx + dy * dy <= rSq) {
                const idx = (y * width + x) * 4;
                data[idx] = color.r;
                data[idx + 1] = color.g;
                data[idx + 2] = color.b;
                data[idx + 3] = alpha;
              }
            }
          }
        }
      }
      break;
    }

    case 'stripes': {
      const step = spacing + size;
      for (let y = 0; y < height; y++) {
        const inStripe = (y % step) < size;
        if (!inStripe) continue;
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
          data[idx + 3] = alpha;
        }
      }
      break;
    }

    case 'checker': {
      const cellSize = spacing + size;
      for (let y = 0; y < height; y++) {
        const row = Math.floor(y / cellSize);
        for (let x = 0; x < width; x++) {
          const col = Math.floor(x / cellSize);
          if ((row + col) % 2 === 0) {
            const idx = (y * width + x) * 4;
            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = alpha;
          }
        }
      }
      break;
    }

    case 'diagonal-stripes': {
      const step = spacing + size;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const diag = ((x + y) % step + step) % step;
          if (diag < size) {
            const idx = (y * width + x) * 4;
            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = alpha;
          }
        }
      }
      break;
    }
  }

  return imageData;
}

// ---------------------------------------------------------------------------
// Concentration Lines (Speed Lines)
// ---------------------------------------------------------------------------

/**
 * Configuration for manga-style radial concentration lines.
 *
 * @see generateConcentrationLines
 */
export interface ConcentrationLinesConfig {
  /** Center X position in pixels. */
  centerX: number;
  /** Center Y position in pixels. */
  centerY: number;
  /** Canvas width in pixels. */
  canvasWidth: number;
  /** Canvas height in pixels. */
  canvasHeight: number;
  /** Number of radial lines (typically 20-100). */
  lineCount: number;
  /** Minimum line width in pixels at the outer edge. */
  lineWidthMin: number;
  /** Maximum line width in pixels at the outer edge. */
  lineWidthMax: number;
  /** Clear center radius as a ratio (0-1) of half the canvas diagonal. */
  innerRadius: number;
  /** Line color (RGBA, channels 0-255). */
  color: ProceduralColor;
  /** Optional seed for reproducible pseudo-random line width variation. */
  randomSeed?: number;
}

/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Produces deterministic sequences given the same seed, ensuring reproducible
 * concentration line patterns across renders.
 *
 * @param seed - Integer seed value
 * @returns A function that returns the next pseudo-random number in [0, 1)
 */
function createSeededRandom(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate radial concentration lines (manga-style speed lines) as ImageData.
 *
 * Draws triangular wedges radiating outward from the center point. Each wedge
 * has a randomly varied width between `lineWidthMin` and `lineWidthMax` (controlled
 * by `randomSeed` for reproducibility). An inner radius creates a clear circular
 * area around the center. Lines fade in smoothly from the inner radius boundary.
 *
 * @param config - Concentration lines configuration
 * @returns ImageData with the rendered concentration lines (transparent background)
 */
export function generateConcentrationLines(
  config: ConcentrationLinesConfig,
): ImageData {
  const {
    centerX,
    centerY,
    canvasWidth,
    canvasHeight,
    lineCount,
    lineWidthMin,
    lineWidthMax,
    innerRadius,
    color,
    randomSeed,
  } = config;

  const imageData = new ImageData(canvasWidth, canvasHeight);

  // Handle edge case: no lines to draw
  if (lineCount <= 0) return imageData;

  const data = imageData.data;
  const diagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  // innerRadius is a 0-1 ratio of half the diagonal
  const innerRadiusPx = innerRadius * (diagonal / 2);
  const outerRadius = diagonal;

  // Create seeded PRNG for reproducible width variation
  const random = createSeededRandom(randomSeed ?? 42);

  // Pre-compute each line's angle and half-angle width
  const angleStep = (2 * Math.PI) / lineCount;
  const lineAngles: number[] = [];
  const lineHalfAngles: number[] = [];

  for (let i = 0; i < lineCount; i++) {
    lineAngles.push(i * angleStep);

    // Randomize line width between min and max
    const widthPx = lineWidthMin + random() * (lineWidthMax - lineWidthMin);
    // Convert pixel width at outer radius to angular half-width
    // At distance outerRadius, arc length = angle * radius, so angle = width / radius
    const halfAngle = Math.max(0.001, widthPx / (2 * outerRadius));
    lineHalfAngles.push(halfAngle);
  }

  // Fade zone: lines fade in over this distance from the inner radius boundary
  const fadeZone = innerRadiusPx * 0.5 + 1;

  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distSq = dx * dx + dy * dy;

      // Skip center area (using squared comparison for performance)
      if (distSq < innerRadiusPx * innerRadiusPx) continue;

      const dist = Math.sqrt(distSq);
      if (dist > outerRadius) continue;

      const angle = Math.atan2(dy, dx);

      // Check if this pixel falls within any line wedge
      let inLine = false;
      for (let i = 0; i < lineCount; i++) {
        let diff = angle - lineAngles[i];
        // Normalize to [-PI, PI]
        if (diff > Math.PI) diff -= 2 * Math.PI;
        else if (diff < -Math.PI) diff += 2 * Math.PI;

        // Wedge width grows with distance (triangular shape)
        // Scale the half-angle by (dist / outerRadius) so lines are thinner near center
        const scaledHalfAngle = lineHalfAngles[i] * (dist / outerRadius);

        if (Math.abs(diff) < scaledHalfAngle) {
          inLine = true;
          break;
        }
      }

      if (inLine) {
        // Smooth fade-in from inner radius boundary
        const fadeIn = Math.min(1, (dist - innerRadiusPx) / fadeZone);
        const idx = (y * canvasWidth + x) * 4;
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = Math.round(color.a * fadeIn);
      }
    }
  }

  return imageData;
}

// ---------------------------------------------------------------------------
// Border Frame
// ---------------------------------------------------------------------------

/**
 * Generate a rectangular border frame as ImageData.
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param borderWidth - Border thickness in pixels
 * @param color - Border color (RGBA 0-255)
 * @param cornerRadius - Corner radius in pixels (0 for sharp corners)
 * @param style - Border style: solid, double, or dashed
 */
export function generateBorderFrame(
  width: number,
  height: number,
  borderWidth: number,
  color: ProceduralColor,
  cornerRadius: number,
  style: BorderStyle,
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  const setPixel = (x: number, y: number, a: number = color.a): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
    data[idx + 3] = a;
  };

  const isInsideRoundedRect = (
    x: number, y: number,
    rx: number, ry: number, rw: number, rh: number, radius: number,
  ): boolean => {
    // Check if point is within the rounded rectangle
    if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;

    const r = Math.min(radius, Math.min(rw, rh) / 2);
    if (r <= 0) return true;

    // Check corners
    const corners = [
      { cx: rx + r, cy: ry + r },             // top-left
      { cx: rx + rw - r, cy: ry + r },         // top-right
      { cx: rx + r, cy: ry + rh - r },         // bottom-left
      { cx: rx + rw - r, cy: ry + rh - r },    // bottom-right
    ];

    for (const corner of corners) {
      const inCornerRegion =
        (x < rx + r && y < ry + r) ||              // top-left
        (x >= rx + rw - r && y < ry + r) ||         // top-right
        (x < rx + r && y >= ry + rh - r) ||         // bottom-left
        (x >= rx + rw - r && y >= ry + rh - r);     // bottom-right

      if (inCornerRegion) {
        const dx = x - corner.cx;
        const dy = y - corner.cy;
        if (dx * dx + dy * dy > r * r) return false;
      }
    }

    return true;
  };

  if (style === 'solid') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outer = isInsideRoundedRect(x, y, 0, 0, width, height, cornerRadius);
        const inner = isInsideRoundedRect(
          x, y,
          borderWidth, borderWidth,
          width - 2 * borderWidth, height - 2 * borderWidth,
          Math.max(0, cornerRadius - borderWidth),
        );
        if (outer && !inner) {
          setPixel(x, y);
        }
      }
    }
  } else if (style === 'double') {
    const outerW = Math.max(1, Math.floor(borderWidth / 3));
    const innerW = Math.max(1, Math.floor(borderWidth / 3));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Outer line
        const outer1 = isInsideRoundedRect(x, y, 0, 0, width, height, cornerRadius);
        const inner1 = isInsideRoundedRect(
          x, y,
          outerW, outerW,
          width - 2 * outerW, height - 2 * outerW,
          Math.max(0, cornerRadius - outerW),
        );
        // Inner line
        const outer2 = isInsideRoundedRect(
          x, y,
          borderWidth - innerW, borderWidth - innerW,
          width - 2 * (borderWidth - innerW), height - 2 * (borderWidth - innerW),
          Math.max(0, cornerRadius - borderWidth + innerW),
        );
        const inner2 = isInsideRoundedRect(
          x, y,
          borderWidth, borderWidth,
          width - 2 * borderWidth, height - 2 * borderWidth,
          Math.max(0, cornerRadius - borderWidth),
        );
        if ((outer1 && !inner1) || (outer2 && !inner2)) {
          setPixel(x, y);
        }
      }
    }
  } else if (style === 'dashed') {
    const dashLength = borderWidth * 3;
    const gapLength = borderWidth * 2;
    const period = dashLength + gapLength;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outer = isInsideRoundedRect(x, y, 0, 0, width, height, cornerRadius);
        const inner = isInsideRoundedRect(
          x, y,
          borderWidth, borderWidth,
          width - 2 * borderWidth, height - 2 * borderWidth,
          Math.max(0, cornerRadius - borderWidth),
        );
        if (outer && !inner) {
          // Use perimeter-based dash pattern (vary by position along each edge)
          const onTop = y < borderWidth;
          const onBottom = y >= height - borderWidth;
          const onLeft = x < borderWidth;
          const onRight = x >= width - borderWidth;
          let perimPos: number;
          if (onTop && !onLeft && !onRight) {
            perimPos = x;                                    // top edge: vary by x
          } else if (onRight && !onTop && !onBottom) {
            perimPos = width + y;                            // right edge: vary by y
          } else if (onBottom && !onLeft && !onRight) {
            perimPos = width + height + (width - x);         // bottom edge: vary by reversed x
          } else if (onLeft && !onTop && !onBottom) {
            perimPos = 2 * width + height + (height - y);    // left edge: vary by reversed y
          } else {
            // Corner: use diagonal distance
            perimPos = x + y;
          }
          if ((perimPos % period) < dashLength) {
            setPixel(x, y);
          }
        }
      }
    }
  }

  return imageData;
}

// ---------------------------------------------------------------------------
// Gradient Mask
// ---------------------------------------------------------------------------

/**
 * Apply a gradient fade mask to existing ImageData.
 *
 * Multiplies the alpha channel by a directional gradient, creating a fade-out effect.
 * Returns a new ImageData (does not mutate input).
 *
 * @param sourceImageData - Source image to apply mask to
 * @param direction - Fade direction
 * @param fadeStart - Where the fade begins (0-1, fraction of dimension)
 * @param fadeEnd - Where the fade ends (0-1, fraction of dimension)
 */
export function generateGradientMask(
  sourceImageData: ImageData,
  direction: MaskDirection,
  fadeStart: number,
  fadeEnd: number,
): ImageData {
  const { width, height } = sourceImageData;
  const result = new ImageData(
    new Uint8ClampedArray(sourceImageData.data),
    width,
    height,
  );
  const data = result.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t: number;

      switch (direction) {
        case 'top':
          // Fade out the top: t is large at top (y=0), small at bottom
          t = 1 - y / height;
          break;
        case 'bottom':
          // Fade out the bottom: t is large at bottom (y=height), small at top
          t = y / height;
          break;
        case 'left':
          // Fade out the left: t is large at left (x=0), small at right
          t = 1 - x / width;
          break;
        case 'right':
          // Fade out the right: t is large at right (x=width), small at left
          t = x / width;
          break;
        case 'radial': {
          const cx = width / 2;
          const cy = height / 2;
          const maxDist = Math.sqrt(cx * cx + cy * cy);
          const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
          t = dist / maxDist;
          break;
        }
      }

      // Calculate alpha multiplier based on fade range
      let alphaMul: number;
      if (fadeStart >= fadeEnd) {
        alphaMul = t < fadeStart ? 1 : 0;
      } else if (t <= fadeStart) {
        alphaMul = 1;
      } else if (t >= fadeEnd) {
        alphaMul = 0;
      } else {
        alphaMul = 1 - (t - fadeStart) / (fadeEnd - fadeStart);
      }

      const idx = (y * width + x) * 4;
      data[idx + 3] = Math.round(data[idx + 3] * alphaMul);
    }
  }

  return result;
}
