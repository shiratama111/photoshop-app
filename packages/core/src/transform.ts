/**
 * @module transform
 * Image transform engine: rotate, scale, flip, crop, affine transforms.
 * All functions create new ImageData and do NOT modify input.
 */

/** 2D affine transform matrix [a, b, c, d, tx, ty]. */
export type Matrix2D = [number, number, number, number, number, number];

/** Transform origin point. */
export interface TransformOrigin { x: number; y: number; }

/** Interpolation method for resampling. */
export type InterpolationMethod = 'nearest' | 'bilinear';

/**
 * Returns the identity matrix.
 * @returns Identity Matrix2D.
 */
export function identityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Multiply two 2D affine matrices.
 * @param a - First matrix.
 * @param b - Second matrix.
 * @returns Product matrix a * b.
 */
export function multiplyMatrix(a: Matrix2D, b: Matrix2D): Matrix2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * Create a rotation matrix.
 * @param angle - Angle in degrees.
 * @returns Rotation Matrix2D.
 */
export function rotateMatrix(angle: number): Matrix2D {
  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

/**
 * Create a scale matrix.
 * @param sx - Horizontal scale factor.
 * @param sy - Vertical scale factor.
 * @returns Scale Matrix2D.
 */
export function scaleMatrix(sx: number, sy: number): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * Create a translation matrix.
 * @param tx - Horizontal translation.
 * @param ty - Vertical translation.
 * @returns Translation Matrix2D.
 */
export function translateMatrix(tx: number, ty: number): Matrix2D {
  return [1, 0, 0, 1, tx, ty];
}

/**
 * Invert a 2D affine matrix.
 * @param m - Matrix to invert.
 * @returns Inverted matrix, or null if singular.
 */
export function invertMatrix(m: Matrix2D): Matrix2D | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    m[3] * invDet,
    -m[1] * invDet,
    -m[2] * invDet,
    m[0] * invDet,
    (m[2] * m[5] - m[3] * m[4]) * invDet,
    (m[1] * m[4] - m[0] * m[5]) * invDet,
  ];
}

/**
 * Sample with bilinear interpolation at sub-pixel coordinates.
 * @param imageData - Source image.
 * @param x - X coordinate (can be fractional).
 * @param y - Y coordinate (can be fractional).
 * @returns [r, g, b, a] pixel values.
 */
export function bilinearSample(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height, data } = imageData;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const cx0 = Math.max(0, Math.min(x0, width - 1));
  const cy0 = Math.max(0, Math.min(y0, height - 1));

  const i00 = (cy0 * width + cx0) * 4;
  const i10 = (cy0 * width + x1) * 4;
  const i01 = (y1 * width + cx0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const result: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = data[i00 + c];
    const v10 = data[i10 + c];
    const v01 = data[i01 + c];
    const v11 = data[i11 + c];
    const top = v00 + (v10 - v00) * fx;
    const bottom = v01 + (v11 - v01) * fx;
    result[c] = Math.round(top + (bottom - top) * fy);
  }
  return result;
}

/**
 * Nearest-neighbor sample.
 * @param imageData - Source image.
 * @param x - X coordinate.
 * @param y - Y coordinate.
 * @returns [r, g, b, a] pixel values.
 */
export function nearestSample(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height, data } = imageData;
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const idx = (py * width + px) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

/**
 * Flip image horizontally (left-right).
 * @param imageData - Source image.
 * @returns Flipped ImageData.
 */
export function flipHorizontal(imageData: ImageData): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return new ImageData(dst, width, height);
}

/**
 * Flip image vertically (top-bottom).
 * @param imageData - Source image.
 * @returns Flipped ImageData.
 */
export function flipVertical(imageData: ImageData): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    const srcRow = y * width * 4;
    const dstRow = (height - 1 - y) * width * 4;
    dst.set(src.subarray(srcRow, srcRow + width * 4), dstRow);
  }
  return new ImageData(dst, width, height);
}

/**
 * Rotate image 90 degrees clockwise.
 * @param imageData - Source image.
 * @returns Rotated ImageData (width/height swapped).
 */
export function rotate90CW(imageData: ImageData): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (x * height + (height - 1 - y)) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return new ImageData(dst, height, width);
}

/**
 * Rotate image 90 degrees counter-clockwise.
 * @param imageData - Source image.
 * @returns Rotated ImageData (width/height swapped).
 */
export function rotate90CCW(imageData: ImageData): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = ((width - 1 - x) * height + y) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return new ImageData(dst, height, width);
}

/**
 * Rotate image 180 degrees.
 * @param imageData - Source image.
 * @returns Rotated ImageData.
 */
export function rotate180(imageData: ImageData): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(src.length);
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const srcIdx = i * 4;
    const dstIdx = (total - 1 - i) * 4;
    dst[dstIdx] = src[srcIdx];
    dst[dstIdx + 1] = src[srcIdx + 1];
    dst[dstIdx + 2] = src[srcIdx + 2];
    dst[dstIdx + 3] = src[srcIdx + 3];
  }
  return new ImageData(dst, width, height);
}

/**
 * Rotate by arbitrary angle with bilinear interpolation.
 * Output size is adjusted to contain the full rotated image.
 * @param imageData - Source image.
 * @param angle - Angle in degrees.
 * @param origin - Rotation center.
 * @param method - Interpolation method.
 * @returns Rotated ImageData.
 */
export function rotateArbitrary(
  imageData: ImageData,
  angle: number,
  origin: TransformOrigin,
  method: InterpolationMethod = 'bilinear',
): ImageData {
  const { width, height } = imageData;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Compute bounding box of rotated corners
  const corners = [
    [0, 0], [width, 0], [width, height], [0, height],
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [cx, cy] of corners) {
    const dx = cx - origin.x;
    const dy = cy - origin.y;
    const rx = cos * dx - sin * dy + origin.x;
    const ry = sin * dx + cos * dy + origin.y;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }

  const newW = Math.ceil(maxX - minX);
  const newH = Math.ceil(maxY - minY);
  const dst = new Uint8ClampedArray(newW * newH * 4);
  const sample = method === 'bilinear' ? bilinearSample : nearestSample;

  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const wx = x + minX;
      const wy = y + minY;
      const dx = wx - origin.x;
      const dy = wy - origin.y;
      const srcX = cos * dx + sin * dy + origin.x;
      const srcY = -sin * dx + cos * dy + origin.y;
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const [r, g, b, a] = sample(imageData, srcX, srcY);
        const idx = (y * newW + x) * 4;
        dst[idx] = r; dst[idx + 1] = g; dst[idx + 2] = b; dst[idx + 3] = a;
      }
    }
  }
  return new ImageData(dst, newW, newH);
}

/**
 * Scale (resize) image with interpolation.
 * @param imageData - Source image.
 * @param newWidth - Target width.
 * @param newHeight - Target height.
 * @param method - Interpolation method.
 * @returns Scaled ImageData.
 */
export function scaleImage(
  imageData: ImageData,
  newWidth: number,
  newHeight: number,
  method: InterpolationMethod = 'bilinear',
): ImageData {
  const { width, height } = imageData;
  const dst = new Uint8ClampedArray(newWidth * newHeight * 4);
  const sample = method === 'bilinear' ? bilinearSample : nearestSample;
  const sx = width / newWidth;
  const sy = height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = (x + 0.5) * sx - 0.5;
      const srcY = (y + 0.5) * sy - 0.5;
      const [r, g, b, a] = sample(imageData, srcX, srcY);
      const idx = (y * newWidth + x) * 4;
      dst[idx] = r; dst[idx + 1] = g; dst[idx + 2] = b; dst[idx + 3] = a;
    }
  }
  return new ImageData(dst, newWidth, newHeight);
}

/**
 * Apply an arbitrary affine transform matrix.
 * @param imageData - Source image.
 * @param matrix - Transform matrix.
 * @param outputWidth - Output width.
 * @param outputHeight - Output height.
 * @param method - Interpolation method.
 * @returns Transformed ImageData.
 */
export function applyTransform(
  imageData: ImageData,
  matrix: Matrix2D,
  outputWidth: number,
  outputHeight: number,
  method: InterpolationMethod = 'bilinear',
): ImageData {
  const inv = invertMatrix(matrix);
  if (!inv) return new ImageData(outputWidth, outputHeight);
  const { width, height } = imageData;
  const dst = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const sample = method === 'bilinear' ? bilinearSample : nearestSample;

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const srcX = inv[0] * x + inv[2] * y + inv[4];
      const srcY = inv[1] * x + inv[3] * y + inv[5];
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const [r, g, b, a] = sample(imageData, srcX, srcY);
        const idx = (y * outputWidth + x) * 4;
        dst[idx] = r; dst[idx + 1] = g; dst[idx + 2] = b; dst[idx + 3] = a;
      }
    }
  }
  return new ImageData(dst, outputWidth, outputHeight);
}

/**
 * Crop image to a rectangular region.
 * @param imageData - Source image.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param cropWidth - Crop width.
 * @param cropHeight - Crop height.
 * @returns Cropped ImageData.
 */
export function cropImage(
  imageData: ImageData,
  x: number,
  y: number,
  cropWidth: number,
  cropHeight: number,
): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(cropWidth * cropHeight * 4);

  for (let dy = 0; dy < cropHeight; dy++) {
    const srcY = y + dy;
    if (srcY < 0 || srcY >= height) continue;

    const srcStartX = Math.max(0, x);
    const srcEndX = Math.min(width, x + cropWidth);
    const rowCopyWidth = srcEndX - srcStartX;
    if (rowCopyWidth <= 0) continue;

    const srcRow = (srcY * width + srcStartX) * 4;
    const dstStartX = srcStartX - x;
    const dstRow = (dy * cropWidth + dstStartX) * 4;
    const srcEnd = srcRow + rowCopyWidth * 4;
    dst.set(src.subarray(srcRow, srcEnd), dstRow);
  }
  return new ImageData(dst, cropWidth, cropHeight);
}

/**
 * Resize the canvas (add/remove border).
 * @param imageData - Source image.
 * @param newWidth - New canvas width.
 * @param newHeight - New canvas height.
 * @param anchorX - Horizontal anchor (0=left, 0.5=center, 1=right).
 * @param anchorY - Vertical anchor (0=top, 0.5=center, 1=bottom).
 * @returns Resized ImageData.
 */
export function canvasResize(
  imageData: ImageData,
  newWidth: number,
  newHeight: number,
  anchorX: number,
  anchorY: number,
): ImageData {
  const { width, height, data: src } = imageData;
  const dst = new Uint8ClampedArray(newWidth * newHeight * 4);
  const offsetX = Math.round((newWidth - width) * anchorX);
  const offsetY = Math.round((newHeight - height) * anchorY);

  for (let y = 0; y < height; y++) {
    const destY = y + offsetY;
    if (destY < 0 || destY >= newHeight) continue;
    for (let x = 0; x < width; x++) {
      const destX = x + offsetX;
      if (destX < 0 || destX >= newWidth) continue;
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (destY * newWidth + destX) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return new ImageData(dst, newWidth, newHeight);
}
