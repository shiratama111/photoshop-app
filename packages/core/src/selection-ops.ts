/**
 * @module selection-ops
 * Selection operations for the Photoshop-like app.
 *
 * A selection is represented as a grayscale ImageData where the red channel
 * holds the selection intensity: 255 = fully selected, 0 = not selected.
 * This "selection mask" approach supports soft/feathered edges naturally.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How to combine two selection masks. */
export type SelectionMode = 'new' | 'add' | 'subtract' | 'intersect';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Create an empty (fully deselected) mask of the given dimensions. */
export function createEmptyMask(width: number, height: number): ImageData {
  return new ImageData(width, height);
}

/** Create a fully selected mask of the given dimensions. */
export function createFullMask(width: number, height: number): ImageData {
  const mask = new ImageData(width, height);
  const { data } = mask;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // r = selection intensity
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return mask;
}

/** Clone a mask. */
function cloneMask(src: ImageData): ImageData {
  const dst = new ImageData(src.width, src.height);
  dst.data.set(src.data);
  return dst;
}

// ---------------------------------------------------------------------------
// Primitive Selection Shapes
// ---------------------------------------------------------------------------

/**
 * Create a rectangular selection mask.
 *
 * @param width - Image width.
 * @param height - Image height.
 * @param x - Left edge of selection.
 * @param y - Top edge of selection.
 * @param w - Width of selection rectangle.
 * @param h - Height of selection rectangle.
 * @returns A new ImageData mask with the rectangle selected.
 */
export function createRectSelection(
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
): ImageData {
  const mask = createEmptyMask(width, height);
  const { data } = mask;

  const x0 = clamp(Math.round(x), 0, width);
  const y0 = clamp(Math.round(y), 0, height);
  const x1 = clamp(Math.round(x + w), 0, width);
  const y1 = clamp(Math.round(y + h), 0, height);

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const offset = (py * width + px) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }

  return mask;
}

/**
 * Create an elliptical selection mask.
 *
 * @param width - Image width.
 * @param height - Image height.
 * @param cx - Center X of the ellipse.
 * @param cy - Center Y of the ellipse.
 * @param rx - Horizontal radius.
 * @param ry - Vertical radius.
 * @returns A new ImageData mask with the ellipse selected.
 */
export function createEllipseSelection(
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): ImageData {
  const mask = createEmptyMask(width, height);
  const { data } = mask;

  if (rx <= 0 || ry <= 0) return mask;

  // Bounding box
  const x0 = clamp(Math.floor(cx - rx), 0, width);
  const y0 = clamp(Math.floor(cy - ry), 0, height);
  const x1 = clamp(Math.ceil(cx + rx), 0, width);
  const y1 = clamp(Math.ceil(cy + ry), 0, height);

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = (px + 0.5 - cx) / rx;
      const dy = (py + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const offset = (py * width + px) * 4;
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        data[offset + 3] = 255;
      }
    }
  }

  return mask;
}

// ---------------------------------------------------------------------------
// Magic Wand
// ---------------------------------------------------------------------------

/**
 * Magic wand selection: selects all contiguous pixels similar to the seed pixel.
 *
 * Uses a scanline flood fill approach (same as fill.ts) to find matching pixels.
 *
 * @param imageData - The image to sample from.
 * @param startX - Seed pixel X.
 * @param startY - Seed pixel Y.
 * @param tolerance - Per-channel tolerance (0-255). Default 32.
 * @param contiguous - If true, only selects connected pixels. If false, selects all matching pixels. Default true.
 * @returns A selection mask.
 */
export function magicWandSelect(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number = 32,
  contiguous: boolean = true,
): ImageData {
  const { width, height, data } = imageData;
  const mask = createEmptyMask(width, height);
  const mData = mask.data;

  const sx = clamp(Math.round(startX), 0, width - 1);
  const sy = clamp(Math.round(startY), 0, height - 1);

  const seedOffset = (sy * width + sx) * 4;
  const seedR = data[seedOffset];
  const seedG = data[seedOffset + 1];
  const seedB = data[seedOffset + 2];
  const seedA = data[seedOffset + 3];

  const matches = (offset: number): boolean => {
    return (
      Math.abs(data[offset] - seedR) <= tolerance &&
      Math.abs(data[offset + 1] - seedG) <= tolerance &&
      Math.abs(data[offset + 2] - seedB) <= tolerance &&
      Math.abs(data[offset + 3] - seedA) <= tolerance
    );
  };

  if (!contiguous) {
    // Non-contiguous: select ALL matching pixels
    for (let i = 0; i < data.length; i += 4) {
      if (matches(i)) {
        mData[i] = 255;
        mData[i + 1] = 255;
        mData[i + 2] = 255;
        mData[i + 3] = 255;
      }
    }
    return mask;
  }

  // Contiguous: scanline flood fill
  const visited = new Uint8Array(width * height);
  const stack: [number, number][] = [[sx, sy]];

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cy < 0 || cy >= height) continue;

    const rowIdx = cy * width;
    if (visited[rowIdx + cx]) continue;
    if (!matches((rowIdx + cx) * 4)) continue;

    // Scan left
    let left = cx;
    while (left > 0 && matches(((rowIdx + left - 1) * 4))) {
      left--;
    }

    // Scan right
    let right = cx;
    while (right < width - 1 && matches(((rowIdx + right + 1) * 4))) {
      right++;
    }

    // Fill scanline and seed above/below
    let aboveAdded = false;
    let belowAdded = false;

    for (let x = left; x <= right; x++) {
      const idx = rowIdx + x;
      visited[idx] = 1;
      const off = idx * 4;
      mData[off] = 255;
      mData[off + 1] = 255;
      mData[off + 2] = 255;
      mData[off + 3] = 255;

      // Above
      if (cy > 0) {
        const aboveIdx = ((cy - 1) * width + x) * 4;
        const aboveMatch = matches(aboveIdx);
        if (aboveMatch && !aboveAdded) {
          stack.push([x, cy - 1]);
          aboveAdded = true;
        } else if (!aboveMatch) {
          aboveAdded = false;
        }
      }

      // Below
      if (cy < height - 1) {
        const belowIdx = ((cy + 1) * width + x) * 4;
        const belowMatch = matches(belowIdx);
        if (belowMatch && !belowAdded) {
          stack.push([x, cy + 1]);
          belowAdded = true;
        } else if (!belowMatch) {
          belowAdded = false;
        }
      }
    }
  }

  return mask;
}

// ---------------------------------------------------------------------------
// Color Range Selection
// ---------------------------------------------------------------------------

/**
 * Select all pixels within a color range (similar to Photoshop's Select > Color Range).
 *
 * @param imageData - The image to sample from.
 * @param targetColor - The target color to match against.
 * @param fuzziness - How far from the target color a pixel can be (0-255). Default 40.
 * @returns A selection mask with intensity based on color proximity.
 */
export function colorRangeSelect(
  imageData: ImageData,
  targetColor: { r: number; g: number; b: number },
  fuzziness: number = 40,
): ImageData {
  const { width, height, data } = imageData;
  const mask = createEmptyMask(width, height);
  const mData = mask.data;
  const threshold = Math.max(0, fuzziness);

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - targetColor.r;
    const dg = data[i + 1] - targetColor.g;
    const db = data[i + 2] - targetColor.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (threshold === 0) {
      if (dr === 0 && dg === 0 && db === 0) {
        mData[i] = 255;
        mData[i + 1] = 255;
        mData[i + 2] = 255;
        mData[i + 3] = 255;
      }
      continue;
    }

    if (dist <= threshold) {
      // Intensity falls off linearly with distance
      const intensity = Math.round(255 * (1 - dist / threshold));
      mData[i] = intensity;
      mData[i + 1] = intensity;
      mData[i + 2] = intensity;
      mData[i + 3] = 255;
    }
  }

  return mask;
}

// ---------------------------------------------------------------------------
// Mask Operations
// ---------------------------------------------------------------------------

/**
 * Invert a selection mask (selected <-> deselected).
 *
 * @param mask - The mask to invert.
 * @returns A new inverted mask.
 */
export function invertSelection(mask: ImageData): ImageData {
  const result = cloneMask(mask);
  const { data } = result;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
    // Keep alpha at 255
    data[i + 3] = 255;
  }

  return result;
}

/**
 * Expand a selection mask by a given number of pixels.
 * Uses a simple morphological dilation with a circular kernel.
 *
 * @param mask - Source mask.
 * @param pixels - Number of pixels to expand.
 * @returns A new expanded mask.
 */
export function expandSelection(mask: ImageData, pixels: number): ImageData {
  const { width, height, data } = mask;
  const result = createEmptyMask(width, height);
  const rData = result.data;
  const radius = Math.round(Math.abs(pixels));

  if (radius === 0) {
    rData.set(data);
    return result;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        const sy = y + ky;
        if (sy < 0 || sy >= height) continue;
        for (let kx = -radius; kx <= radius; kx++) {
          const sxr = x + kx;
          if (sxr < 0 || sxr >= width) continue;
          // Circular kernel
          if (kx * kx + ky * ky > radius * radius) continue;

          const val = data[(sy * width + sxr) * 4];
          if (val > maxVal) maxVal = val;
        }
      }

      const offset = (y * width + x) * 4;
      rData[offset] = maxVal;
      rData[offset + 1] = maxVal;
      rData[offset + 2] = maxVal;
      rData[offset + 3] = 255;
    }
  }

  return result;
}

/**
 * Contract a selection mask by a given number of pixels.
 * Uses a simple morphological erosion with a circular kernel.
 *
 * @param mask - Source mask.
 * @param pixels - Number of pixels to contract.
 * @returns A new contracted mask.
 */
export function contractSelection(mask: ImageData, pixels: number): ImageData {
  const { width, height, data } = mask;
  const result = createEmptyMask(width, height);
  const rData = result.data;
  const radius = Math.round(Math.abs(pixels));

  if (radius === 0) {
    rData.set(data);
    return result;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;

      for (let ky = -radius; ky <= radius; ky++) {
        const sy = y + ky;
        if (sy < 0 || sy >= height) { minVal = 0; continue; }
        for (let kx = -radius; kx <= radius; kx++) {
          const sxr = x + kx;
          if (sxr < 0 || sxr >= width) { minVal = 0; continue; }
          if (kx * kx + ky * ky > radius * radius) continue;

          const val = data[(sy * width + sxr) * 4];
          if (val < minVal) minVal = val;
        }
      }

      const offset = (y * width + x) * 4;
      rData[offset] = minVal;
      rData[offset + 1] = minVal;
      rData[offset + 2] = minVal;
      rData[offset + 3] = 255;
    }
  }

  return result;
}

/**
 * Feather (blur) a selection mask to create soft edges.
 * Uses a separable box blur approximation of a Gaussian.
 *
 * @param mask - Source mask.
 * @param radius - Feather radius in pixels.
 * @returns A new feathered mask.
 */
export function featherSelection(mask: ImageData, radius: number): ImageData {
  const { width, height, data } = mask;
  const r = Math.round(Math.abs(radius));

  if (r === 0) {
    return cloneMask(mask);
  }

  // Extract the red channel as a float buffer for blurring
  const src = new Float32Array(width * height);
  for (let i = 0; i < src.length; i++) {
    src[i] = data[i * 4];
  }

  // Horizontal pass
  const temp = new Float32Array(width * height);
  const kernelSize = r * 2 + 1;

  for (let y = 0; y < height; y++) {
    let sum = 0;
    // Initialize window
    for (let kx = -r; kx <= r; kx++) {
      sum += src[y * width + clamp(kx, 0, width - 1)];
    }
    temp[y * width] = sum / kernelSize;

    for (let x = 1; x < width; x++) {
      sum += src[y * width + clamp(x + r, 0, width - 1)];
      sum -= src[y * width + clamp(x - r - 1, 0, width - 1)];
      temp[y * width + x] = sum / kernelSize;
    }
  }

  // Vertical pass
  const dst = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let ky = -r; ky <= r; ky++) {
      sum += temp[clamp(ky, 0, height - 1) * width + x];
    }
    dst[x] = sum / kernelSize;

    for (let y = 1; y < height; y++) {
      sum += temp[clamp(y + r, 0, height - 1) * width + x];
      sum -= temp[clamp(y - r - 1, 0, height - 1) * width + x];
      dst[y * width + x] = sum / kernelSize;
    }
  }

  // Write back to ImageData
  const result = new ImageData(width, height);
  const rData = result.data;
  for (let i = 0; i < dst.length; i++) {
    const v = clamp(Math.round(dst[i]), 0, 255);
    const off = i * 4;
    rData[off] = v;
    rData[off + 1] = v;
    rData[off + 2] = v;
    rData[off + 3] = 255;
  }

  return result;
}

/**
 * Get the bounding rectangle of the selected area in a mask.
 *
 * @param mask - The selection mask to analyze.
 * @returns Bounding rect { x, y, width, height } or null if nothing is selected.
 */
export function selectionBounds(
  mask: ImageData,
): { x: number; y: number; width: number; height: number } | null {
  const { width, height, data } = mask;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Combine two selection masks using a boolean operation.
 *
 * @param existing - The current selection mask.
 * @param incoming - The new selection shape to combine.
 * @param mode - How to combine: 'new' replaces, 'add' unions, 'subtract' removes, 'intersect' finds overlap.
 * @returns A new combined mask.
 */
export function combineSelections(
  existing: ImageData,
  incoming: ImageData,
  mode: SelectionMode,
): ImageData {
  const { width, height } = existing;
  const result = new ImageData(width, height);
  const rData = result.data;
  const eData = existing.data;
  const iData = incoming.data;

  switch (mode) {
    case 'new':
      rData.set(iData);
      break;

    case 'add':
      for (let i = 0; i < rData.length; i += 4) {
        const v = clamp(eData[i] + iData[i], 0, 255);
        rData[i] = v;
        rData[i + 1] = v;
        rData[i + 2] = v;
        rData[i + 3] = 255;
      }
      break;

    case 'subtract':
      for (let i = 0; i < rData.length; i += 4) {
        const v = clamp(eData[i] - iData[i], 0, 255);
        rData[i] = v;
        rData[i + 1] = v;
        rData[i + 2] = v;
        rData[i + 3] = 255;
      }
      break;

    case 'intersect':
      for (let i = 0; i < rData.length; i += 4) {
        const v = Math.min(eData[i], iData[i]);
        rData[i] = v;
        rData[i + 1] = v;
        rData[i + 2] = v;
        rData[i + 3] = 255;
      }
      break;
  }

  return result;
}

/**
 * Check if any pixel in the mask is selected (value > 0).
 *
 * @param mask - The selection mask to check.
 * @returns True if at least one pixel is selected.
 */
export function hasSelection(mask: ImageData): boolean {
  const { data } = mask;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

/**
 * Deselect all — returns an empty mask.
 *
 * @param width - Mask width.
 * @param height - Mask height.
 * @returns An empty mask.
 */
export function deselectAll(width: number, height: number): ImageData {
  return createEmptyMask(width, height);
}

/**
 * Select all — returns a fully selected mask.
 *
 * @param width - Mask width.
 * @param height - Mask height.
 * @returns A fully selected mask.
 */
export function selectAll(width: number, height: number): ImageData {
  return createFullMask(width, height);
}
