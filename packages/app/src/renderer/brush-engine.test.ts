/**
 * @module brush-engine.test
 * Unit tests for the BrushEngine (APP-013).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BrushEngine } from './brush-engine';
import type { BrushStrokeOptions, BrushPoint } from './brush-engine';

/** Create an empty ImageData-like object for testing. */
function createImageData(width: number, height: number): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

/** Create a white-filled ImageData (all pixels RGBA 255,255,255,255). */
function createWhiteImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

const defaultOptions: BrushStrokeOptions = {
  size: 10,
  hardness: 1,
  opacity: 1,
  color: { r: 255, g: 0, b: 0, a: 1 },
  spacing: 0.25,
  eraser: false,
};

describe('BrushEngine', () => {
  let engine: BrushEngine;

  beforeEach(() => {
    engine = new BrushEngine();
  });

  describe('startStroke', () => {
    it('should activate the engine', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);
      expect(engine.isActive).toBe(true);
    });

    it('should place a dab at the starting point', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);

      // Check center pixel is painted red
      const idx = (50 * 100 + 50) * 4;
      expect(img.data[idx]).toBe(255);     // R
      expect(img.data[idx + 1]).toBe(0);   // G
      expect(img.data[idx + 2]).toBe(0);   // B
      expect(img.data[idx + 3]).toBeGreaterThan(0); // A
    });

    it('should not paint outside the brush radius', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, { ...defaultOptions, size: 4 });

      // Check a pixel far from the center is untouched
      const farIdx = (10 * 100 + 10) * 4;
      expect(img.data[farIdx]).toBe(0);
      expect(img.data[farIdx + 3]).toBe(0);
    });
  });

  describe('continueStroke', () => {
    it('should interpolate between points', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 10, y: 50 }, defaultOptions);
      engine.continueStroke({ x: 90, y: 50 });

      // Pixels along the stroke path should be painted
      const midIdx = (50 * 100 + 50) * 4;
      expect(img.data[midIdx + 3]).toBeGreaterThan(0);
    });

    it('should not paint when stroke is not active', () => {
      const img = createImageData(100, 100);
      // Don't call startStroke
      engine.continueStroke({ x: 50, y: 50 });

      // All pixels should be untouched
      const idx = (50 * 100 + 50) * 4;
      expect(img.data[idx + 3]).toBe(0);
    });

    it('should handle very close points gracefully', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);
      engine.continueStroke({ x: 50.1, y: 50.1 });
      // Should not throw
      expect(engine.isActive).toBe(true);
    });
  });

  describe('endStroke', () => {
    it('should return a BrushStrokeResult with region and pixels', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);
      const result = engine.endStroke();

      expect(result).not.toBeNull();
      if (result) {
        expect(result.region.width).toBeGreaterThan(0);
        expect(result.region.height).toBeGreaterThan(0);
        expect(result.oldPixels.length).toBe(result.region.width * result.region.height * 4);
        expect(result.newPixels.length).toBe(result.region.width * result.region.height * 4);
      }
    });

    it('should return null when no stroke is active', () => {
      const result = engine.endStroke();
      expect(result).toBeNull();
    });

    it('should deactivate the engine', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);
      engine.endStroke();
      expect(engine.isActive).toBe(false);
    });

    it('should capture old pixels as zeros (empty image)', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);
      const result = engine.endStroke();

      if (result) {
        // Old pixels should be all zeros (empty image before painting)
        const allZero = result.oldPixels.every((v) => v === 0);
        expect(allZero).toBe(true);
      }
    });

    it('should capture new pixels with painted data', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, defaultOptions);
      const result = engine.endStroke();

      if (result) {
        // New pixels should have some non-zero values
        const hasColor = result.newPixels.some((v) => v > 0);
        expect(hasColor).toBe(true);
      }
    });
  });

  describe('eraser mode', () => {
    it('should reduce alpha in eraser mode', () => {
      const img = createWhiteImageData(100, 100);
      const eraserOptions: BrushStrokeOptions = {
        ...defaultOptions,
        eraser: true,
        size: 20,
      };

      engine.startStroke(img, { x: 50, y: 50 }, eraserOptions);
      const result = engine.endStroke();

      // Center pixel alpha should be reduced
      const idx = (50 * 100 + 50) * 4;
      expect(img.data[idx + 3]).toBeLessThan(255);
    });

    it('should not add color in eraser mode', () => {
      const img = createImageData(100, 100);
      const eraserOptions: BrushStrokeOptions = {
        ...defaultOptions,
        eraser: true,
        color: { r: 255, g: 0, b: 0, a: 1 },
      };

      engine.startStroke(img, { x: 50, y: 50 }, eraserOptions);
      engine.endStroke();

      // Pixel should still be transparent (can't erase what doesn't exist)
      const idx = (50 * 100 + 50) * 4;
      expect(img.data[idx]).toBe(0);
    });
  });

  describe('hardness', () => {
    it('should paint a uniform circle with hardness 1', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, { ...defaultOptions, size: 10, hardness: 1 });
      engine.endStroke();

      // Center pixel should be fully opaque
      const centerIdx = (50 * 100 + 50) * 4;
      expect(img.data[centerIdx + 3]).toBe(255);
    });

    it('should have softer edges with hardness 0', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, { ...defaultOptions, size: 20, hardness: 0 });
      engine.endStroke();

      // Center should still have high alpha
      const centerIdx = (50 * 100 + 50) * 4;
      expect(img.data[centerIdx + 3]).toBeGreaterThan(200);

      // Edge pixel should have lower alpha
      const edgeIdx = (50 * 100 + 59) * 4; // ~9px from center
      expect(img.data[edgeIdx + 3]).toBeLessThan(img.data[centerIdx + 3]);
    });
  });

  describe('pressure', () => {
    it('should reduce brush size with lower pressure', () => {
      const img1 = createImageData(100, 100);
      engine.startStroke(img1, { x: 50, y: 50, pressure: 1 }, { ...defaultOptions, size: 20 });
      engine.endStroke();

      const img2 = createImageData(100, 100);
      engine.startStroke(img2, { x: 50, y: 50, pressure: 0.5 }, { ...defaultOptions, size: 20 });
      engine.endStroke();

      // Count painted pixels
      let count1 = 0, count2 = 0;
      for (let i = 3; i < img1.data.length; i += 4) {
        if (img1.data[i] > 0) count1++;
        if (img2.data[i] > 0) count2++;
      }

      // Full pressure should paint more pixels
      expect(count1).toBeGreaterThan(count2);
    });
  });

  describe('stroke along a line', () => {
    it('should paint a continuous line', () => {
      const img = createImageData(200, 50);
      engine.startStroke(img, { x: 10, y: 25 }, { ...defaultOptions, size: 6 });
      engine.continueStroke({ x: 190, y: 25 });
      const result = engine.endStroke();

      expect(result).not.toBeNull();
      if (result) {
        // The dirty region should span most of the horizontal range
        expect(result.region.width).toBeGreaterThan(150);
      }
    });

    it('should paint a diagonal line', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 10, y: 10 }, { ...defaultOptions, size: 4 });
      engine.continueStroke({ x: 90, y: 90 });
      const result = engine.endStroke();

      expect(result).not.toBeNull();
      // Check midpoint is painted
      const midIdx = (50 * 100 + 50) * 4;
      expect(img.data[midIdx + 3]).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle painting at image boundary', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 0, y: 0 }, defaultOptions);
      engine.endStroke();
      // Should not throw
      expect(img.data[0 + 3]).toBeGreaterThan(0); // Top-left pixel alpha
    });

    it('should handle painting at bottom-right corner', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 99, y: 99 }, defaultOptions);
      engine.endStroke();
      const idx = (99 * 100 + 99) * 4;
      expect(img.data[idx + 3]).toBeGreaterThan(0);
    });

    it('should handle zero-size brush', () => {
      const img = createImageData(100, 100);
      engine.startStroke(img, { x: 50, y: 50 }, { ...defaultOptions, size: 0 });
      const result = engine.endStroke();
      // Should return null as no pixels were modified
      expect(result).toBeNull();
    });

    it('should handle multiple sequential strokes', () => {
      const img = createImageData(100, 100);

      engine.startStroke(img, { x: 20, y: 50 }, defaultOptions);
      engine.endStroke();

      engine.startStroke(img, { x: 80, y: 50 }, defaultOptions);
      const result2 = engine.endStroke();

      expect(result2).not.toBeNull();
      // Both areas should have paint
      const idx1 = (50 * 100 + 20) * 4;
      const idx2 = (50 * 100 + 80) * 4;
      expect(img.data[idx1 + 3]).toBeGreaterThan(0);
      expect(img.data[idx2 + 3]).toBeGreaterThan(0);
    });
  });
});
