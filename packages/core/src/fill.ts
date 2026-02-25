/**
 * @module fill
 * Fill operations for image data: flood fill, solid fill, selection fill, and gradient fill.
 *
 * The flood fill implementation uses a scanline algorithm to avoid stack overflow
 * on large images (no recursion).
 *
 * @see https://en.wikipedia.org/wiki/Flood_fill#Scanline_fill
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** RGBA color with channels in [0, 255]. */
export interface FillColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Rectangular region within an image. */
export interface FillSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Clone an ImageData buffer. */
function cloneImageData(src: ImageData): ImageData {
  const dst = new ImageData(src.width, src.height);
  dst.data.set(src.data);
  return dst;
}

/** Get the RGBA values at pixel (x, y). */
function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): FillColor {
  const offset = (y * width + x) * 4;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  };
}

/** Set the RGBA values at pixel (x, y). */
function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, color: FillColor): void {
  const offset = (y * width + x) * 4;
  data[offset] = color.r;
  data[offset + 1] = color.g;
  data[offset + 2] = color.b;
  data[offset + 3] = color.a;
}

/** Check if two colors are within the tolerance threshold. */
function colorsMatch(c1: FillColor, c2: FillColor, tolerance: number): boolean {
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance &&
    Math.abs(c1.a - c2.a) <= tolerance
  );
}

// ---------------------------------------------------------------------------
// Flood Fill (Scanline Algorithm)
// ---------------------------------------------------------------------------

/**
 * Flood fill starting at (startX, startY) using a scanline algorithm.
 *
 * Replaces all connected pixels that match the seed color (within tolerance)
 * with the fill color. Does NOT recurse — uses an explicit stack of scanline
 * segments to avoid blowing the call stack on large images.
 *
 * @param imageData - Source image data (a copy is made internally).
 * @param startX - X coordinate of the seed pixel.
 * @param startY - Y coordinate of the seed pixel.
 * @param fillColor - The color to fill with.
 * @param tolerance - Per-channel tolerance for matching (0-255). Default 0.
 * @returns A new ImageData with the flood fill applied.
 */
export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: FillColor,
  tolerance: number = 0,
): ImageData {
  const result = cloneImageData(imageData);
  const { width, height, data } = result;

  const sx = clamp(Math.round(startX), 0, width - 1);
  const sy = clamp(Math.round(startY), 0, height - 1);

  const seedColor = getPixel(data, width, sx, sy);

  // If the seed color already matches the fill color, no work to do
  if (colorsMatch(seedColor, fillColor, 0)) {
    return result;
  }

  const visited = new Uint8Array(width * height);

  // Stack stores [x, y] pairs representing seed pixels for scanline segments
  const stack: [number, number][] = [[sx, sy]];

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;

    if (cy < 0 || cy >= height) continue;

    const rowIdx = cy * width;
    if (visited[rowIdx + cx]) continue;

    // Check if this pixel matches the seed color
    if (!colorsMatch(getPixel(data, width, cx, cy), seedColor, tolerance)) continue;

    // Find the leftmost matching pixel on this scanline
    let left = cx;
    while (left > 0 && colorsMatch(getPixel(data, width, left - 1, cy), seedColor, tolerance)) {
      left--;
    }

    // Find the rightmost matching pixel on this scanline
    let right = cx;
    while (right < width - 1 && colorsMatch(getPixel(data, width, right + 1, cy), seedColor, tolerance)) {
      right++;
    }

    // Fill the scanline segment and check rows above/below
    let aboveAdded = false;
    let belowAdded = false;

    for (let x = left; x <= right; x++) {
      setPixel(data, width, x, cy, fillColor);
      visited[rowIdx + x] = 1;

      // Check pixel above
      if (cy > 0) {
        const aboveMatches = colorsMatch(getPixel(data, width, x, cy - 1), seedColor, tolerance);
        if (aboveMatches && !aboveAdded) {
          stack.push([x, cy - 1]);
          aboveAdded = true;
        } else if (!aboveMatches) {
          aboveAdded = false;
        }
      }

      // Check pixel below
      if (cy < height - 1) {
        const belowMatches = colorsMatch(getPixel(data, width, x, cy + 1), seedColor, tolerance);
        if (belowMatches && !belowAdded) {
          stack.push([x, cy + 1]);
          belowAdded = true;
        } else if (!belowMatches) {
          belowAdded = false;
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Solid Fill
// ---------------------------------------------------------------------------

/**
 * Fill the entire image with a solid color.
 *
 * @param imageData - Source image data (a copy is made internally).
 * @param color - The color to fill with.
 * @returns A new ImageData filled with the given color.
 */
export function fillAll(imageData: ImageData, color: FillColor): ImageData {
  const result = cloneImageData(imageData);
  const { data } = result;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = color.a;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Selection Fill
// ---------------------------------------------------------------------------

/**
 * Fill a rectangular selection with a solid color.
 * Pixels outside the selection are copied unchanged.
 *
 * @param imageData - Source image data (a copy is made internally).
 * @param selection - Rectangular region to fill.
 * @param color - The color to fill with.
 * @returns A new ImageData with the selection filled.
 */
export function fillSelection(
  imageData: ImageData,
  selection: FillSelection,
  color: FillColor,
): ImageData {
  const result = cloneImageData(imageData);
  const { width, height, data } = result;

  const x0 = clamp(Math.round(selection.x), 0, width);
  const y0 = clamp(Math.round(selection.y), 0, height);
  const x1 = clamp(Math.round(selection.x + selection.width), 0, width);
  const y1 = clamp(Math.round(selection.y + selection.height), 0, height);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      setPixel(data, width, x, y, color);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Gradient Fill (simple linear two-color)
// ---------------------------------------------------------------------------

/** Linear gradient definition between two points and two colors. */
export interface SimpleGradientDef {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startColor: FillColor;
  endColor: FillColor;
}

/**
 * Fill the image with a simple linear gradient between two colors.
 *
 * For more advanced gradient rendering (radial, angle, diamond, multi-stop),
 * use the gradient module directly.
 *
 * @param imageData - Source image data (a copy is made internally).
 * @param gradient - Gradient definition with start/end points and colors.
 * @returns A new ImageData with the gradient applied.
 */
export function fillGradient(imageData: ImageData, gradient: SimpleGradientDef): ImageData {
  const result = cloneImageData(imageData);
  const { width, height, data } = result;

  const dx = gradient.endX - gradient.startX;
  const dy = gradient.endY - gradient.startY;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate gradient — fill with start color
    for (let i = 0; i < data.length; i += 4) {
      data[i] = gradient.startColor.r;
      data[i + 1] = gradient.startColor.g;
      data[i + 2] = gradient.startColor.b;
      data[i + 3] = gradient.startColor.a;
    }
    return result;
  }

  const { startColor: sc, endColor: ec } = gradient;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = clamp(
        ((x - gradient.startX) * dx + (y - gradient.startY) * dy) / lenSq,
        0,
        1,
      );

      const offset = (y * width + x) * 4;
      data[offset] = Math.round(sc.r + (ec.r - sc.r) * t);
      data[offset + 1] = Math.round(sc.g + (ec.g - sc.g) * t);
      data[offset + 2] = Math.round(sc.b + (ec.b - sc.b) * t);
      data[offset + 3] = Math.round(sc.a + (ec.a - sc.a) * t);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Mask-Aware Fill
// ---------------------------------------------------------------------------

/**
 * Fill pixels using a selection mask (grayscale ImageData used as alpha).
 * White pixels (255) in the mask are fully filled, black (0) not at all.
 *
 * @param imageData - Source image data (a copy is made internally).
 * @param mask - Grayscale ImageData whose red channel represents selection intensity (0-255).
 * @param color - The color to fill with.
 * @returns A new ImageData with the masked fill applied.
 */
export function fillWithMask(
  imageData: ImageData,
  mask: ImageData,
  color: FillColor,
): ImageData {
  const result = cloneImageData(imageData);
  const { width, height, data } = result;

  const mw = mask.width;
  const mh = mask.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sample the mask (clamp to mask bounds)
      const mx = clamp(x, 0, mw - 1);
      const my = clamp(y, 0, mh - 1);
      const maskOffset = (my * mw + mx) * 4;
      const maskAlpha = mask.data[maskOffset] / 255; // Use red channel as mask intensity

      if (maskAlpha === 0) continue;

      const offset = (y * width + x) * 4;

      // Blend the fill color with the existing pixel based on mask intensity
      const srcA = (color.a / 255) * maskAlpha;
      const dstA = data[offset + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);

      if (outA > 0) {
        data[offset] = Math.round((color.r * srcA + data[offset] * dstA * (1 - srcA)) / outA);
        data[offset + 1] = Math.round((color.g * srcA + data[offset + 1] * dstA * (1 - srcA)) / outA);
        data[offset + 2] = Math.round((color.b * srcA + data[offset + 2] * dstA * (1 - srcA)) / outA);
        data[offset + 3] = Math.round(outA * 255);
      }
    }
  }

  return result;
}
