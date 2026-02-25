/**
 * @module filters/blur
 * Blur and sharpen filters: gaussian blur (box blur approximation), unsharp mask, motion blur.
 * All functions create a new ImageData and do NOT modify the input.
 */

/** Clone ImageData. */
function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

/** Clamp 0-255. */
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Single-pass horizontal box blur.
 */
function boxBlurH(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    let ti = y * w * 4;
    let li = ti;
    let ri = ti + r * 4;
    const fv = [src[ti], src[ti + 1], src[ti + 2], src[ti + 3]];
    const lv = [src[ti + (w - 1) * 4], src[ti + (w - 1) * 4 + 1], src[ti + (w - 1) * 4 + 2], src[ti + (w - 1) * 4 + 3]];
    const val = [fv[0] * (r + 1), fv[1] * (r + 1), fv[2] * (r + 1), fv[3] * (r + 1)];
    for (let j = 0; j < r; j++) {
      const idx = Math.min(j, w - 1) * 4 + ti;
      val[0] += src[idx]; val[1] += src[idx + 1]; val[2] += src[idx + 2]; val[3] += src[idx + 3];
    }
    for (let j = 0; j <= r; j++) {
      const idx = Math.min(j + r, w - 1) * 4 + y * w * 4;
      val[0] += src[idx] - fv[0]; val[1] += src[idx + 1] - fv[1];
      val[2] += src[idx + 2] - fv[2]; val[3] += src[idx + 3] - fv[3];
      dst[ti] = Math.round(val[0] * iarr); dst[ti + 1] = Math.round(val[1] * iarr);
      dst[ti + 2] = Math.round(val[2] * iarr); dst[ti + 3] = Math.round(val[3] * iarr);
      ti += 4;
    }
    for (let j = r + 1; j < w - r; j++) {
      val[0] += src[ri] - src[li]; val[1] += src[ri + 1] - src[li + 1];
      val[2] += src[ri + 2] - src[li + 2]; val[3] += src[ri + 3] - src[li + 3];
      dst[ti] = Math.round(val[0] * iarr); dst[ti + 1] = Math.round(val[1] * iarr);
      dst[ti + 2] = Math.round(val[2] * iarr); dst[ti + 3] = Math.round(val[3] * iarr);
      ri += 4; li += 4; ti += 4;
    }
    for (let j = w - r; j < w; j++) {
      val[0] += lv[0] - src[li]; val[1] += lv[1] - src[li + 1];
      val[2] += lv[2] - src[li + 2]; val[3] += lv[3] - src[li + 3];
      dst[ti] = Math.round(val[0] * iarr); dst[ti + 1] = Math.round(val[1] * iarr);
      dst[ti + 2] = Math.round(val[2] * iarr); dst[ti + 3] = Math.round(val[3] * iarr);
      li += 4; ti += 4;
    }
  }
}

/**
 * Single-pass vertical box blur.
 */
function boxBlurV(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    let ti = x * 4;
    let li = ti;
    let ri = ti + r * w * 4;
    const fv = [src[ti], src[ti + 1], src[ti + 2], src[ti + 3]];
    const lv = [src[ti + (h - 1) * w * 4], src[ti + (h - 1) * w * 4 + 1], src[ti + (h - 1) * w * 4 + 2], src[ti + (h - 1) * w * 4 + 3]];
    const val = [fv[0] * (r + 1), fv[1] * (r + 1), fv[2] * (r + 1), fv[3] * (r + 1)];
    for (let j = 0; j < r; j++) {
      const idx = x * 4 + Math.min(j, h - 1) * w * 4;
      val[0] += src[idx]; val[1] += src[idx + 1]; val[2] += src[idx + 2]; val[3] += src[idx + 3];
    }
    for (let j = 0; j <= r; j++) {
      const idx = x * 4 + Math.min(j + r, h - 1) * w * 4;
      val[0] += src[idx] - fv[0]; val[1] += src[idx + 1] - fv[1];
      val[2] += src[idx + 2] - fv[2]; val[3] += src[idx + 3] - fv[3];
      dst[ti] = Math.round(val[0] * iarr); dst[ti + 1] = Math.round(val[1] * iarr);
      dst[ti + 2] = Math.round(val[2] * iarr); dst[ti + 3] = Math.round(val[3] * iarr);
      ti += w * 4;
    }
    for (let j = r + 1; j < h - r; j++) {
      val[0] += src[ri] - src[li]; val[1] += src[ri + 1] - src[li + 1];
      val[2] += src[ri + 2] - src[li + 2]; val[3] += src[ri + 3] - src[li + 3];
      dst[ti] = Math.round(val[0] * iarr); dst[ti + 1] = Math.round(val[1] * iarr);
      dst[ti + 2] = Math.round(val[2] * iarr); dst[ti + 3] = Math.round(val[3] * iarr);
      ri += w * 4; li += w * 4; ti += w * 4;
    }
    for (let j = h - r; j < h; j++) {
      val[0] += lv[0] - src[li]; val[1] += lv[1] - src[li + 1];
      val[2] += lv[2] - src[li + 2]; val[3] += lv[3] - src[li + 3];
      dst[ti] = Math.round(val[0] * iarr); dst[ti + 1] = Math.round(val[1] * iarr);
      dst[ti + 2] = Math.round(val[2] * iarr); dst[ti + 3] = Math.round(val[3] * iarr);
      li += w * 4; ti += w * 4;
    }
  }
}

/**
 * Compute box sizes for a gaussian blur approximation (3-pass).
 */
function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) {
    sizes.push(i < m ? wl : wu);
  }
  return sizes;
}

/**
 * Apply gaussian blur using 3-pass box blur approximation.
 * @param imageData - Source image data.
 * @param radius - Blur radius in pixels (1-100).
 * @returns New ImageData with gaussian blur applied.
 */
export function gaussianBlur(imageData: ImageData, radius: number): ImageData {
  const r = Math.max(1, Math.min(100, Math.round(radius)));
  const { width, height } = imageData;
  const src = new Uint8ClampedArray(imageData.data);
  const dst = new Uint8ClampedArray(imageData.data.length);
  const boxes = boxesForGauss(r, 3);
  boxBlurH(src, dst, width, height, (boxes[0] - 1) / 2);
  boxBlurV(dst, src, width, height, (boxes[0] - 1) / 2);
  boxBlurH(src, dst, width, height, (boxes[1] - 1) / 2);
  boxBlurV(dst, src, width, height, (boxes[1] - 1) / 2);
  boxBlurH(src, dst, width, height, (boxes[2] - 1) / 2);
  boxBlurV(dst, src, width, height, (boxes[2] - 1) / 2);
  return new ImageData(src, width, height);
}

/**
 * Sharpen using unsharp mask algorithm.
 * @param imageData - Source image data.
 * @param amount - Sharpen intensity (0-500, 100 = normal).
 * @returns New ImageData with sharpening applied.
 */
export function sharpen(imageData: ImageData, amount: number): ImageData {
  const blurred = gaussianBlur(imageData, 1);
  const result = cloneImageData(imageData);
  const d = result.data;
  const bd = blurred.data;
  const factor = amount / 100;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] + (d[i] - bd[i]) * factor);
    d[i + 1] = clamp255(d[i + 1] + (d[i + 1] - bd[i + 1]) * factor);
    d[i + 2] = clamp255(d[i + 2] + (d[i + 2] - bd[i + 2]) * factor);
  }
  return result;
}

/**
 * Apply motion blur along a direction.
 * @param imageData - Source image data.
 * @param angle - Blur direction in degrees.
 * @param distance - Blur distance in pixels.
 * @returns New ImageData with motion blur applied.
 */
export function motionBlur(imageData: ImageData, angle: number, distance: number): ImageData {
  const { width, height, data: src } = imageData;
  const result = new Uint8ClampedArray(src.length);
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const dist = Math.max(1, Math.round(distance));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      for (let s = -dist; s <= dist; s++) {
        const sx = Math.round(x + dx * s);
        const sy = Math.round(y + dy * s);
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          const idx = (sy * width + sx) * 4;
          rSum += src[idx]; gSum += src[idx + 1]; bSum += src[idx + 2]; aSum += src[idx + 3];
          count++;
        }
      }
      const idx = (y * width + x) * 4;
      const c = Math.max(1, count);
      result[idx] = Math.round(rSum / c);
      result[idx + 1] = Math.round(gSum / c);
      result[idx + 2] = Math.round(bSum / c);
      result[idx + 3] = Math.round(aSum / c);
    }
  }
  return new ImageData(result, width, height);
}
