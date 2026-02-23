/**
 * @module image-utils
 * Image preprocessing utilities for SAM model inference.
 *
 * Mobile SAM expects:
 * - Input size: 1024x1024
 * - Normalization: ImageNet mean/std
 * - Format: NCHW Float32Array
 */

import type { Size } from '@photoshop-app/types';

/** ImageNet normalization constants. */
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/** Target input size for Mobile SAM encoder. */
export const SAM_INPUT_SIZE = 1024;

/**
 * Preprocess an RGBA image for SAM encoder input.
 * 1. Resize to fit within 1024x1024 (maintaining aspect ratio)
 * 2. Normalize with ImageNet mean/std
 * 3. Convert to NCHW Float32Array
 *
 * @param imageData - RGBA pixel data.
 * @param size - Original image dimensions.
 * @returns Preprocessed tensor as Float32Array in NCHW layout.
 */
export function preprocessImage(
  imageData: Uint8ClampedArray,
  size: Size,
): { tensor: Float32Array; resizedSize: Size } {
  // Calculate resize dimensions (fit within 1024x1024)
  const scale = Math.min(SAM_INPUT_SIZE / size.width, SAM_INPUT_SIZE / size.height);
  const resizedWidth = Math.round(size.width * scale);
  const resizedHeight = Math.round(size.height * scale);

  // Create NCHW tensor (1 x 3 x 1024 x 1024)
  const tensor = new Float32Array(3 * SAM_INPUT_SIZE * SAM_INPUT_SIZE);

  // Resize and normalize
  for (let y = 0; y < resizedHeight; y++) {
    for (let x = 0; x < resizedWidth; x++) {
      // Nearest-neighbor sampling from original image
      const srcX = Math.min(Math.floor(x / scale), size.width - 1);
      const srcY = Math.min(Math.floor(y / scale), size.height - 1);
      const srcIdx = (srcY * size.width + srcX) * 4;

      const r = imageData[srcIdx] / 255;
      const g = imageData[srcIdx + 1] / 255;
      const b = imageData[srcIdx + 2] / 255;

      // ImageNet normalization
      const normR = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      const normG = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      const normB = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];

      // NCHW layout: [channel][height][width]
      const dstIdx = y * SAM_INPUT_SIZE + x;
      tensor[0 * SAM_INPUT_SIZE * SAM_INPUT_SIZE + dstIdx] = normR;
      tensor[1 * SAM_INPUT_SIZE * SAM_INPUT_SIZE + dstIdx] = normG;
      tensor[2 * SAM_INPUT_SIZE * SAM_INPUT_SIZE + dstIdx] = normB;
    }
  }

  return { tensor, resizedSize: { width: resizedWidth, height: resizedHeight } };
}

/**
 * Create point prompt tensors for SAM decoder.
 * Converts document-space points to 1024x1024 space and creates
 * the required coords + labels tensors.
 *
 * @param points - Point prompts in document coordinates.
 * @param originalSize - Original image dimensions.
 * @param resizedSize - Size after preprocessing resize.
 * @returns Coords (Nx2 Float32) and labels (Nx1 Float32) tensors.
 */
export function createPointTensors(
  points: Array<{ x: number; y: number; label: 'positive' | 'negative' }>,
  originalSize: Size,
  resizedSize: Size,
): { coords: Float32Array; labels: Float32Array } {
  const n = points.length;
  const coords = new Float32Array(n * 2);
  const labels = new Float32Array(n);

  const scaleX = resizedSize.width / originalSize.width;
  const scaleY = resizedSize.height / originalSize.height;

  for (let i = 0; i < n; i++) {
    coords[i * 2] = points[i].x * scaleX;
    coords[i * 2 + 1] = points[i].y * scaleY;
    labels[i] = points[i].label === 'positive' ? 1 : 0;
  }

  return { coords, labels };
}

/**
 * Post-process SAM decoder output into a binary mask.
 * Applies sigmoid and threshold to logits.
 *
 * @param logits - Raw mask logits from decoder.
 * @param maskSize - Dimensions of the logits tensor.
 * @param originalSize - Target output dimensions.
 * @param threshold - Sigmoid threshold for binarization (default 0.5).
 * @returns Binary mask (0 or 255) at original resolution.
 */
export function postprocessMask(
  logits: Float32Array,
  maskSize: Size,
  originalSize: Size,
  threshold = 0.5,
): Uint8Array {
  const mask = new Uint8Array(originalSize.width * originalSize.height);

  const scaleX = maskSize.width / originalSize.width;
  const scaleY = maskSize.height / originalSize.height;

  for (let y = 0; y < originalSize.height; y++) {
    for (let x = 0; x < originalSize.width; x++) {
      // Nearest-neighbor sampling from logits
      const srcX = Math.min(Math.floor(x * scaleX), maskSize.width - 1);
      const srcY = Math.min(Math.floor(y * scaleY), maskSize.height - 1);
      const logit = logits[srcY * maskSize.width + srcX];

      // Sigmoid
      const prob = 1 / (1 + Math.exp(-logit));
      mask[y * originalSize.width + x] = prob >= threshold ? 255 : 0;
    }
  }

  return mask;
}

/**
 * Calculate confidence score from mask logits.
 * Uses the mean absolute logit value as a proxy for confidence.
 */
export function calculateConfidence(logits: Float32Array): number {
  if (logits.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    sum += Math.abs(logits[i]);
  }
  const meanAbsLogit = sum / logits.length;
  // Map to 0-1 range using sigmoid-like curve
  return 1 / (1 + Math.exp(-meanAbsLogit + 3));
}
