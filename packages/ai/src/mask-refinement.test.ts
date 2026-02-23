import { describe, it, expect } from 'vitest';
import { applyBrushStroke, featherMask, adjustBoundary } from './mask-refinement';

describe('applyBrushStroke', () => {
  it('should add foreground with add mode', () => {
    const mask = new Uint8Array(10 * 10); // all zeros
    const result = applyBrushStroke(
      mask,
      { width: 10, height: 10 },
      [{ x: 5, y: 5 }],
      { radius: 2, hardness: 1, mode: 'add' },
    );

    // Center pixel should be foreground
    expect(result[5 * 10 + 5]).toBe(255);
    // Original should be unchanged
    expect(mask[5 * 10 + 5]).toBe(0);
  });

  it('should remove foreground with remove mode', () => {
    const mask = new Uint8Array(10 * 10).fill(255);
    const result = applyBrushStroke(
      mask,
      { width: 10, height: 10 },
      [{ x: 5, y: 5 }],
      { radius: 2, hardness: 1, mode: 'remove' },
    );

    // Center pixel should be background
    expect(result[5 * 10 + 5]).toBe(0);
  });

  it('should return copy when points array is empty', () => {
    const mask = new Uint8Array([10, 20, 30, 40]);
    const result = applyBrushStroke(
      mask,
      { width: 2, height: 2 },
      [],
      { radius: 1, hardness: 1, mode: 'add' },
    );

    expect(result).toEqual(mask);
    expect(result).not.toBe(mask);
  });

  it('should handle soft brush (hardness=0) with gradient', () => {
    const mask = new Uint8Array(20 * 20);
    const result = applyBrushStroke(
      mask,
      { width: 20, height: 20 },
      [{ x: 10, y: 10 }],
      { radius: 5, hardness: 0, mode: 'add' },
    );

    // Center should be bright
    const center = result[10 * 20 + 10];
    expect(center).toBeGreaterThan(200);

    // Edge should be dimmer than center
    const edge = result[10 * 20 + 14]; // 4px from center, within radius 5
    expect(edge).toBeLessThan(center);
    expect(edge).toBeGreaterThan(0);
  });

  it('should handle multiple stroke points', () => {
    const mask = new Uint8Array(20 * 20);
    const result = applyBrushStroke(
      mask,
      { width: 20, height: 20 },
      [{ x: 3, y: 3 }, { x: 15, y: 15 }],
      { radius: 2, hardness: 1, mode: 'add' },
    );

    expect(result[3 * 20 + 3]).toBe(255);
    expect(result[15 * 20 + 15]).toBe(255);
  });

  it('should clamp to mask bounds', () => {
    const mask = new Uint8Array(10 * 10);
    // Brush at corner — should not throw
    const result = applyBrushStroke(
      mask,
      { width: 10, height: 10 },
      [{ x: 0, y: 0 }],
      { radius: 5, hardness: 1, mode: 'add' },
    );

    expect(result[0]).toBe(255);
    expect(result.length).toBe(100);
  });

  it('should not modify pixels outside brush radius', () => {
    const mask = new Uint8Array(20 * 20);
    const result = applyBrushStroke(
      mask,
      { width: 20, height: 20 },
      [{ x: 5, y: 5 }],
      { radius: 2, hardness: 1, mode: 'add' },
    );

    // Far corner should remain 0
    expect(result[19 * 20 + 19]).toBe(0);
  });
});

describe('featherMask', () => {
  it('should blur mask edges', () => {
    // Create a mask with a sharp edge: left half = 255, right half = 0
    const size = { width: 20, height: 10 };
    const mask = new Uint8Array(size.width * size.height);
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < 10; x++) {
        mask[y * size.width + x] = 255;
      }
    }

    const result = featherMask(mask, size, 3);

    // Left edge should still be bright
    expect(result[5 * size.width + 2]).toBeGreaterThan(200);
    // Right edge should still be dark
    expect(result[5 * size.width + 17]).toBeLessThan(50);
    // Transition zone should have intermediate values
    const transition = result[5 * size.width + 10];
    expect(transition).toBeGreaterThan(20);
    expect(transition).toBeLessThan(235);
  });

  it('should return copy when radius < 1', () => {
    const mask = new Uint8Array([100, 200, 50, 0]);
    const result = featherMask(mask, { width: 2, height: 2 }, 0);

    expect(result).toEqual(mask);
    expect(result).not.toBe(mask);
  });

  it('should preserve uniform masks', () => {
    const mask = new Uint8Array(25).fill(128);
    const result = featherMask(mask, { width: 5, height: 5 }, 2);

    // Uniform mask should stay approximately uniform
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(126);
      expect(result[i]).toBeLessThanOrEqual(130);
    }
  });

  it('should produce symmetric results', () => {
    const size = { width: 11, height: 11 };
    const mask = new Uint8Array(size.width * size.height);
    // Single bright pixel in center
    mask[5 * size.width + 5] = 255;

    const result = featherMask(mask, size, 2);

    // Should be symmetric around center
    const center = result[5 * size.width + 5];
    expect(center).toBeGreaterThan(0);
    // Left and right neighbors should be equal
    expect(result[5 * size.width + 4]).toBe(result[5 * size.width + 6]);
    // Top and bottom neighbors should be equal
    expect(result[4 * size.width + 5]).toBe(result[6 * size.width + 5]);
  });
});

describe('adjustBoundary', () => {
  /** Create a mask with a centered filled circle. */
  function createCircleMask(size: number, radius: number): Uint8Array {
    const mask = new Uint8Array(size * size);
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          mask[y * size + x] = 255;
        }
      }
    }
    return mask;
  }

  it('should expand the mask with positive amount (dilate)', () => {
    const mask = createCircleMask(20, 3);
    const size = { width: 20, height: 20 };

    const result = adjustBoundary(mask, size, 2);

    // Count foreground pixels
    const originalCount = mask.reduce((s, v) => s + (v === 255 ? 1 : 0), 0);
    const expandedCount = result.reduce((s, v) => s + (v === 255 ? 1 : 0), 0);
    expect(expandedCount).toBeGreaterThan(originalCount);
  });

  it('should contract the mask with negative amount (erode)', () => {
    const mask = createCircleMask(20, 5);
    const size = { width: 20, height: 20 };

    const result = adjustBoundary(mask, size, -2);

    const originalCount = mask.reduce((s, v) => s + (v === 255 ? 1 : 0), 0);
    const contractedCount = result.reduce((s, v) => s + (v === 255 ? 1 : 0), 0);
    expect(contractedCount).toBeLessThan(originalCount);
    expect(contractedCount).toBeGreaterThan(0);
  });

  it('should return copy when amount is 0', () => {
    const mask = new Uint8Array([0, 255, 255, 0]);
    const result = adjustBoundary(mask, { width: 2, height: 2 }, 0);

    expect(result).toEqual(mask);
    expect(result).not.toBe(mask);
  });

  it('should erode small mask to empty', () => {
    // Single pixel in center of 5x5
    const mask = new Uint8Array(25);
    mask[12] = 255; // center

    const result = adjustBoundary(mask, { width: 5, height: 5 }, -1);

    // Single pixel cannot survive erosion with radius 1
    const count = result.reduce((s, v) => s + (v === 255 ? 1 : 0), 0);
    expect(count).toBe(0);
  });

  it('should dilate single pixel into a filled circle', () => {
    const mask = new Uint8Array(11 * 11);
    mask[5 * 11 + 5] = 255;

    const result = adjustBoundary(mask, { width: 11, height: 11 }, 2);

    // Center should be foreground
    expect(result[5 * 11 + 5]).toBe(255);
    // Direct neighbors should be foreground
    expect(result[5 * 11 + 6]).toBe(255);
    expect(result[5 * 11 + 4]).toBe(255);
    expect(result[4 * 11 + 5]).toBe(255);
    expect(result[6 * 11 + 5]).toBe(255);
  });

  it('should binarize input before processing', () => {
    // Mask with gray values
    const mask = new Uint8Array([100, 200, 50, 180]);
    adjustBoundary(mask, { width: 2, height: 2 }, 0);

    // amount=0 returns copy, but test that non-zero amounts binarize
    const result2 = adjustBoundary(mask, { width: 2, height: 2 }, 1);
    // All output values should be 0 or 255
    for (let i = 0; i < result2.length; i++) {
      expect(result2[i] === 0 || result2[i] === 255).toBe(true);
    }
  });
});
