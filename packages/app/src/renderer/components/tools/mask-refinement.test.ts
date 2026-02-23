/**
 * @module mask-refinement.test
 * Unit tests for mask refinement pixel operations.
 * @see APP-006: AI cutout UI
 */

import { describe, it, expect } from 'vitest';
import type { Size } from '@photoshop-app/types';
import {
  paintBrush,
  paintBrushLine,
  dilateMask,
  erodeMask,
  adjustBoundary,
  featherMask,
  extractContour,
} from './mask-refinement';

/** Create a blank (all-zero) mask. */
function blankMask(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

/** Create a mask with a filled rectangle. */
function rectMask(
  width: number,
  height: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Uint8Array {
  const mask = blankMask(width, height);
  for (let y = ry; y < ry + rh && y < height; y++) {
    for (let x = rx; x < rx + rw && x < width; x++) {
      mask[y * width + x] = 255;
    }
  }
  return mask;
}

/** Count foreground (255) pixels. */
function countForeground(mask: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 255) count++;
  }
  return count;
}

const SIZE_10: Size = { width: 10, height: 10 };
const SIZE_20: Size = { width: 20, height: 20 };

describe('paintBrush', () => {
  it('should paint foreground pixels within the brush radius', () => {
    const mask = blankMask(10, 10);
    paintBrush(mask, SIZE_10, 5, 5, 2, 255);

    // Center pixel should be painted
    expect(mask[5 * 10 + 5]).toBe(255);
    // Pixels within radius should be painted
    expect(mask[5 * 10 + 4]).toBe(255);
    expect(mask[4 * 10 + 5]).toBe(255);
    // Total painted pixels should be reasonable for r=2 circle
    const count = countForeground(mask);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(Math.ceil(Math.PI * 4) + 4); // pi*r^2 + margin
  });

  it('should erase foreground pixels when painting with value 0', () => {
    const mask = rectMask(10, 10, 0, 0, 10, 10); // all foreground
    paintBrush(mask, SIZE_10, 5, 5, 3, 0);

    expect(mask[5 * 10 + 5]).toBe(0);
    expect(countForeground(mask)).toBeLessThan(100);
  });

  it('should clip to mask boundaries', () => {
    const mask = blankMask(10, 10);
    // Paint at corner — should not throw
    paintBrush(mask, SIZE_10, 0, 0, 5, 255);

    expect(mask[0]).toBe(255);
    const count = countForeground(mask);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(100); // not all pixels
  });
});

describe('paintBrushLine', () => {
  it('should paint along a line between two points', () => {
    const mask = blankMask(20, 20);
    paintBrushLine(mask, SIZE_20, 2, 10, 18, 10, 2, 255);

    // Points along the horizontal line should be painted
    expect(mask[10 * 20 + 2]).toBe(255);
    expect(mask[10 * 20 + 10]).toBe(255);
    expect(mask[10 * 20 + 18]).toBe(255);
  });

  it('should paint at a single point when start equals end', () => {
    const mask = blankMask(10, 10);
    paintBrushLine(mask, SIZE_10, 5, 5, 5, 5, 1, 255);

    expect(mask[5 * 10 + 5]).toBe(255);
  });
});

describe('dilateMask', () => {
  it('should expand the mask boundary', () => {
    const mask = rectMask(20, 20, 8, 8, 4, 4);
    const originalCount = countForeground(mask);

    const dilated = dilateMask(mask, SIZE_20, 2);
    const dilatedCount = countForeground(dilated);

    expect(dilatedCount).toBeGreaterThan(originalCount);
    // Original pixels should still be foreground
    expect(dilated[8 * 20 + 8]).toBe(255);
    expect(dilated[9 * 20 + 9]).toBe(255);
  });

  it('should return a copy for radius 0', () => {
    const mask = rectMask(10, 10, 3, 3, 4, 4);
    const result = dilateMask(mask, SIZE_10, 0);

    expect(result).not.toBe(mask); // different reference
    expect(countForeground(result)).toBe(countForeground(mask));
  });

  it('should not modify the original mask', () => {
    const mask = rectMask(10, 10, 4, 4, 2, 2);
    const originalCount = countForeground(mask);

    dilateMask(mask, SIZE_10, 3);

    expect(countForeground(mask)).toBe(originalCount);
  });
});

describe('erodeMask', () => {
  it('should contract the mask boundary', () => {
    const mask = rectMask(20, 20, 5, 5, 10, 10);
    const originalCount = countForeground(mask);

    const eroded = erodeMask(mask, SIZE_20, 2);
    const erodedCount = countForeground(eroded);

    expect(erodedCount).toBeLessThan(originalCount);
    // Center should still be foreground
    expect(eroded[10 * 20 + 10]).toBe(255);
  });

  it('should not modify the original mask', () => {
    const mask = rectMask(10, 10, 2, 2, 6, 6);
    const originalCount = countForeground(mask);

    erodeMask(mask, SIZE_10, 1);

    expect(countForeground(mask)).toBe(originalCount);
  });

  it('should return empty mask if erosion is too large', () => {
    const mask = rectMask(10, 10, 4, 4, 2, 2); // tiny rect
    const eroded = erodeMask(mask, SIZE_10, 5);

    expect(countForeground(eroded)).toBe(0);
  });
});

describe('adjustBoundary', () => {
  it('should dilate for positive values', () => {
    const mask = rectMask(20, 20, 8, 8, 4, 4);
    const result = adjustBoundary(mask, SIZE_20, 2);

    expect(countForeground(result)).toBeGreaterThan(countForeground(mask));
  });

  it('should erode for negative values', () => {
    const mask = rectMask(20, 20, 5, 5, 10, 10);
    const result = adjustBoundary(mask, SIZE_20, -2);

    expect(countForeground(result)).toBeLessThan(countForeground(mask));
  });

  it('should return a copy for zero', () => {
    const mask = rectMask(10, 10, 3, 3, 4, 4);
    const result = adjustBoundary(mask, SIZE_10, 0);

    expect(result).not.toBe(mask);
    expect(countForeground(result)).toBe(countForeground(mask));
  });
});

describe('featherMask', () => {
  it('should create smooth transitions at edges', () => {
    const mask = rectMask(20, 20, 5, 5, 10, 10);
    const feathered = featherMask(mask, SIZE_20, 3);

    // Center should remain close to 255
    expect(feathered[10 * 20 + 10]).toBeGreaterThan(200);

    // Far background should remain close to 0
    expect(feathered[0]).toBeLessThan(50);

    // Edge pixels should have intermediate values
    const edgePixel = feathered[5 * 20 + 5];
    expect(edgePixel).toBeGreaterThan(0);
    expect(edgePixel).toBeLessThan(255);
  });

  it('should return a copy for radius 0', () => {
    const mask = rectMask(10, 10, 3, 3, 4, 4);
    const result = featherMask(mask, SIZE_10, 0);

    expect(result).not.toBe(mask);
    for (let i = 0; i < mask.length; i++) {
      expect(result[i]).toBe(mask[i]);
    }
  });

  it('should not modify the original mask', () => {
    const mask = rectMask(10, 10, 3, 3, 4, 4);
    const copy = new Uint8Array(mask);

    featherMask(mask, SIZE_10, 3);

    for (let i = 0; i < mask.length; i++) {
      expect(mask[i]).toBe(copy[i]);
    }
  });
});

describe('extractContour', () => {
  it('should extract boundary pixels of a filled rectangle', () => {
    const mask = rectMask(10, 10, 3, 3, 4, 4);
    const contour = extractContour(mask, SIZE_10);

    // All contour pixels should be foreground
    for (const { x, y } of contour) {
      expect(mask[y * 10 + x]).toBe(255);
    }

    // (5,5) should not be on the contour since all 4 neighbors are foreground
    const trueInterior = contour.some(
      (p) => p.x === 5 && p.y === 5,
    );
    expect(trueInterior).toBe(false);

    // Contour should have > 0 pixels
    expect(contour.length).toBeGreaterThan(0);
  });

  it('should return empty array for empty mask', () => {
    const mask = blankMask(10, 10);
    const contour = extractContour(mask, SIZE_10);

    expect(contour).toHaveLength(0);
  });

  it('should mark all pixels as contour for a single pixel', () => {
    const mask = blankMask(10, 10);
    mask[5 * 10 + 5] = 255;
    const contour = extractContour(mask, SIZE_10);

    expect(contour).toHaveLength(1);
    expect(contour[0]).toEqual({ x: 5, y: 5 });
  });

  it('should mark edge pixels as contour', () => {
    const mask = blankMask(5, 5);
    mask.fill(255);
    const contour = extractContour(mask, { width: 5, height: 5 });

    // All border pixels should be in contour
    expect(contour.length).toBeGreaterThan(0);
    // Center pixel (2,2) should NOT be in contour
    const centerInContour = contour.some((p) => p.x === 2 && p.y === 2);
    expect(centerInContour).toBe(false);
  });
});
