import { describe, it, expect } from 'vitest';
import {
  preprocessImage,
  createPointTensors,
  postprocessMask,
  calculateConfidence,
  SAM_INPUT_SIZE,
} from './image-utils';

describe('preprocessImage', () => {
  it('should produce correct tensor dimensions', () => {
    const rgba = new Uint8ClampedArray(100 * 80 * 4);
    const { tensor, resizedSize } = preprocessImage(rgba, { width: 100, height: 80 });

    // Tensor should be 3 x 1024 x 1024
    expect(tensor.length).toBe(3 * SAM_INPUT_SIZE * SAM_INPUT_SIZE);
    // Resized should maintain aspect ratio
    expect(resizedSize.width).toBeLessThanOrEqual(SAM_INPUT_SIZE);
    expect(resizedSize.height).toBeLessThanOrEqual(SAM_INPUT_SIZE);
  });

  it('should resize maintaining aspect ratio', () => {
    const rgba = new Uint8ClampedArray(2000 * 1000 * 4);
    const { resizedSize } = preprocessImage(rgba, { width: 2000, height: 1000 });

    // Scale = 1024/2000 = 0.512
    expect(resizedSize.width).toBe(Math.round(2000 * (1024 / 2000)));
    expect(resizedSize.height).toBe(Math.round(1000 * (1024 / 2000)));
  });

  it('should normalize pixel values with ImageNet stats', () => {
    // Create a solid red image
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 4 * 4; i++) {
      rgba[i * 4] = 255;     // R = 1.0
      rgba[i * 4 + 1] = 0;   // G = 0.0
      rgba[i * 4 + 2] = 0;   // B = 0.0
      rgba[i * 4 + 3] = 255; // A
    }

    const { tensor } = preprocessImage(rgba, { width: 4, height: 4 });

    // R channel at (0,0): (1.0 - 0.485) / 0.229 ≈ 2.249
    const rValue = tensor[0];
    expect(rValue).toBeCloseTo((1 - 0.485) / 0.229, 1);

    // G channel at (0,0): (0.0 - 0.456) / 0.224 ≈ -2.036
    const gValue = tensor[SAM_INPUT_SIZE * SAM_INPUT_SIZE];
    expect(gValue).toBeCloseTo((0 - 0.456) / 0.224, 1);
  });
});

describe('createPointTensors', () => {
  it('should transform point coordinates to resized space', () => {
    const points = [
      { x: 400, y: 300, label: 'positive' as const },
      { x: 100, y: 200, label: 'negative' as const },
    ];

    const { coords, labels } = createPointTensors(
      points,
      { width: 800, height: 600 },
      { width: 512, height: 384 },
    );

    // coords: Nx2
    expect(coords.length).toBe(4);
    expect(coords[0]).toBeCloseTo(400 * (512 / 800)); // x1
    expect(coords[1]).toBeCloseTo(300 * (384 / 600)); // y1
    expect(coords[2]).toBeCloseTo(100 * (512 / 800)); // x2
    expect(coords[3]).toBeCloseTo(200 * (384 / 600)); // y2

    // labels: positive=1, negative=0
    expect(labels.length).toBe(2);
    expect(labels[0]).toBe(1);
    expect(labels[1]).toBe(0);
  });

  it('should handle single point', () => {
    const { coords, labels } = createPointTensors(
      [{ x: 50, y: 50, label: 'positive' }],
      { width: 100, height: 100 },
      { width: 1024, height: 1024 },
    );

    expect(coords.length).toBe(2);
    expect(labels.length).toBe(1);
    expect(labels[0]).toBe(1);
  });
});

describe('postprocessMask', () => {
  it('should threshold logits to binary mask', () => {
    // Create logits: positive = foreground, negative = background
    const logits = new Float32Array(4 * 4);
    logits[0] = 5.0;  // sigmoid → ~0.993 → 255
    logits[1] = -5.0; // sigmoid → ~0.007 → 0
    logits[2] = 0.0;  // sigmoid → 0.5 → 255 (at threshold)
    logits[3] = -0.1; // sigmoid → ~0.475 → 0

    const mask = postprocessMask(
      logits,
      { width: 4, height: 4 },
      { width: 4, height: 4 },
    );

    expect(mask[0]).toBe(255);
    expect(mask[1]).toBe(0);
    expect(mask[2]).toBe(255); // exactly 0.5 → foreground
    expect(mask[3]).toBe(0);
  });

  it('should resize mask to original dimensions', () => {
    // 2x2 logits → 4x4 output (nearest neighbor)
    const logits = new Float32Array([5, -5, -5, 5]);
    const mask = postprocessMask(
      logits,
      { width: 2, height: 2 },
      { width: 4, height: 4 },
    );

    expect(mask.length).toBe(16);
    // Top-left quadrant should be foreground
    expect(mask[0]).toBe(255);
    expect(mask[1]).toBe(255);
    // Top-right should be background
    expect(mask[2]).toBe(0);
    expect(mask[3]).toBe(0);
  });

  it('should respect custom threshold', () => {
    const logits = new Float32Array([0.0]); // sigmoid = 0.5
    const mask1 = postprocessMask(logits, { width: 1, height: 1 }, { width: 1, height: 1 }, 0.5);
    const mask2 = postprocessMask(logits, { width: 1, height: 1 }, { width: 1, height: 1 }, 0.6);

    expect(mask1[0]).toBe(255); // 0.5 >= 0.5
    expect(mask2[0]).toBe(0);   // 0.5 < 0.6
  });
});

describe('calculateConfidence', () => {
  it('should return high confidence for strong logits', () => {
    const strong = new Float32Array([10, 10, 10, 10]);
    const confidence = calculateConfidence(strong);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it('should return lower confidence for weak logits', () => {
    const weak = new Float32Array([0.1, -0.1, 0.2, -0.05]);
    const confidence = calculateConfidence(weak);
    expect(confidence).toBeLessThan(0.2);
  });

  it('should return 0 for empty logits', () => {
    expect(calculateConfidence(new Float32Array(0))).toBe(0);
  });
});
