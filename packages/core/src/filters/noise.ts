/**
 * @module filters/noise
 * Noise filters: add noise, reduce noise (median filter).
 * All functions create a new ImageData and do NOT modify the input.
 */

/** Clamp 0-255. */
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Simple pseudo-random number generator (mulberry32).
 */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return (): number => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Add noise to an image.
 * @param imageData - Source image data.
 * @param amount - Noise intensity (0-100).
 * @param monochrome - If true, same noise for all channels (grainy look).
 * @returns New ImageData with noise added.
 */
export function addNoise(imageData: ImageData, amount: number, monochrome: boolean): ImageData {
  const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const d = result.data;
  const intensity = (amount / 100) * 128;
  const rng = mulberry32(42);
  for (let i = 0; i < d.length; i += 4) {
    if (monochrome) {
      const noise = (rng() - 0.5) * 2 * intensity;
      d[i] = clamp255(d[i] + noise);
      d[i + 1] = clamp255(d[i + 1] + noise);
      d[i + 2] = clamp255(d[i + 2] + noise);
    } else {
      d[i] = clamp255(d[i] + (rng() - 0.5) * 2 * intensity);
      d[i + 1] = clamp255(d[i + 1] + (rng() - 0.5) * 2 * intensity);
      d[i + 2] = clamp255(d[i + 2] + (rng() - 0.5) * 2 * intensity);
    }
  }
  return result;
}

/**
 * Reduce noise using a median filter.
 * @param imageData - Source image data.
 * @param strength - Filter window radius (1-5). Higher = stronger noise reduction.
 * @returns New ImageData with noise reduced.
 */
export function reduceNoise(imageData: ImageData, strength: number): ImageData {
  const { width, height, data: src } = imageData;
  const result = new Uint8ClampedArray(src.length);
  const r = Math.max(1, Math.min(5, Math.round(strength)));
  const windowSize = (2 * r + 1) * (2 * r + 1);
  const rBuf = new Uint8Array(windowSize);
  const gBuf = new Uint8Array(windowSize);
  const bBuf = new Uint8Array(windowSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const idx = (ny * width + nx) * 4;
          rBuf[count] = src[idx];
          gBuf[count] = src[idx + 1];
          bBuf[count] = src[idx + 2];
          count++;
        }
      }
      // Sort and take median
      rBuf.sort();
      gBuf.sort();
      bBuf.sort();
      const mid = count >> 1;
      const idx = (y * width + x) * 4;
      result[idx] = rBuf[mid];
      result[idx + 1] = gBuf[mid];
      result[idx + 2] = bBuf[mid];
      result[idx + 3] = src[idx + 3];
    }
  }
  return new ImageData(result, width, height);
}
