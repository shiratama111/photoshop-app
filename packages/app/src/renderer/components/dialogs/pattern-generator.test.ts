/**
 * @module pattern-generator.test
 * Unit tests for procedural pattern tile generators.
 *
 * Tests cover all four pattern types: dots, stripes, checkerboard, hatching.
 * Validates dimensions, pixel content, opacity, and parameter effects.
 *
 * @see BG-001: Pattern overlay & background expansion
 * @see pattern-generator.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateDotPattern,
  generateStripePattern,
  generateCheckerboardPattern,
  generateHatchPattern,
} from './pattern-generator';
import type {
  PatternColor,
  DotPatternConfig,
  StripePatternConfig,
  CheckerboardPatternConfig,
  HatchPatternConfig,
} from './pattern-generator';

// Polyfill ImageData for Node.js test environment
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).ImageData = class ImageData {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth: number, height?: number) {
        if (widthOrData instanceof Uint8ClampedArray) {
          this.data = widthOrData;
          this.width = heightOrWidth;
          this.height = height!;
        } else {
          this.width = widthOrData;
          this.height = heightOrWidth;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
      }
    };
  }
});

const BLACK: PatternColor = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: PatternColor = { r: 255, g: 255, b: 255, a: 255 };
const RED: PatternColor = { r: 255, g: 0, b: 0, a: 255 };

/** Count pixels with non-zero alpha in the given ImageData. */
function countNonTransparentPixels(imageData: ImageData): number {
  let count = 0;
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > 0) count++;
  }
  return count;
}

/** Find the maximum alpha value in the given ImageData. */
function maxAlpha(imageData: ImageData): number {
  let max = 0;
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > max) max = imageData.data[i];
  }
  return max;
}

// ---------------------------------------------------------------------------
// generateDotPattern
// ---------------------------------------------------------------------------

describe('generateDotPattern', () => {
  it('returns ImageData with correct dimensions', () => {
    const config: DotPatternConfig = {
      width: 100,
      height: 80,
      dotSize: 6,
      spacing: 20,
      color: BLACK,
      opacity: 1,
    };
    const result = generateDotPattern(config);
    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
    expect(result.data.length).toBe(100 * 80 * 4);
  });

  it('generates visible dots', () => {
    const config: DotPatternConfig = {
      width: 100,
      height: 100,
      dotSize: 10,
      spacing: 20,
      color: BLACK,
      opacity: 1,
    };
    const result = generateDotPattern(config);
    expect(countNonTransparentPixels(result)).toBeGreaterThan(0);
  });

  it('respects opacity parameter', () => {
    const baseConfig: DotPatternConfig = {
      width: 50,
      height: 50,
      dotSize: 8,
      spacing: 15,
      color: BLACK,
      opacity: 1,
    };
    const full = generateDotPattern(baseConfig);
    const half = generateDotPattern({ ...baseConfig, opacity: 0.5 });
    expect(maxAlpha(full)).toBe(255);
    expect(maxAlpha(half)).toBeLessThanOrEqual(128);
    expect(maxAlpha(half)).toBeGreaterThan(0);
  });

  it('uses the specified color', () => {
    const config: DotPatternConfig = {
      width: 50,
      height: 50,
      dotSize: 10,
      spacing: 15,
      color: RED,
      opacity: 1,
    };
    const result = generateDotPattern(config);
    // Find a non-transparent pixel and verify color
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i + 3] > 0) {
        expect(result.data[i]).toBe(255);     // r
        expect(result.data[i + 1]).toBe(0);   // g
        expect(result.data[i + 2]).toBe(0);   // b
        break;
      }
    }
  });

  it('larger dots produce more visible pixels', () => {
    const small = generateDotPattern({
      width: 100, height: 100, dotSize: 4, spacing: 20, color: BLACK, opacity: 1,
    });
    const large = generateDotPattern({
      width: 100, height: 100, dotSize: 12, spacing: 20, color: BLACK, opacity: 1,
    });
    expect(countNonTransparentPixels(large)).toBeGreaterThan(countNonTransparentPixels(small));
  });

  it('handles minimum size input', () => {
    const config: DotPatternConfig = {
      width: 1,
      height: 1,
      dotSize: 1,
      spacing: 1,
      color: BLACK,
      opacity: 1,
    };
    const result = generateDotPattern(config);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// generateStripePattern
// ---------------------------------------------------------------------------

describe('generateStripePattern', () => {
  it('returns ImageData with correct dimensions', () => {
    const config: StripePatternConfig = {
      width: 120,
      height: 90,
      stripeWidth: 5,
      gap: 10,
      color: BLACK,
      angle: 0,
      opacity: 1,
    };
    const result = generateStripePattern(config);
    expect(result.width).toBe(120);
    expect(result.height).toBe(90);
    expect(result.data.length).toBe(120 * 90 * 4);
  });

  it('generates visible stripes', () => {
    const config: StripePatternConfig = {
      width: 100,
      height: 100,
      stripeWidth: 5,
      gap: 10,
      color: BLACK,
      angle: 0,
      opacity: 1,
    };
    const result = generateStripePattern(config);
    expect(countNonTransparentPixels(result)).toBeGreaterThan(0);
  });

  it('0 deg stripes produce vertical bands (constant along center column)', () => {
    const config: StripePatternConfig = {
      width: 50,
      height: 50,
      stripeWidth: 5,
      gap: 10,
      color: BLACK,
      angle: 0,
      opacity: 1,
    };
    const result = generateStripePattern(config);
    // At 0 degrees, rotated = dx * cos(0) + dy * sin(0) = dx, so stripes
    // run vertically. Each column should be uniform.
    const cx = 25;
    const firstAlpha = result.data[(0 * 50 + cx) * 4 + 3];
    let isUniform = true;
    for (let y = 1; y < 50; y++) {
      if (result.data[(y * 50 + cx) * 4 + 3] !== firstAlpha) {
        isUniform = false;
        break;
      }
    }
    expect(isUniform).toBe(true);
  });

  it('90 deg stripes produce horizontal bands (rows away from center are uniform)', () => {
    const config: StripePatternConfig = {
      width: 50,
      height: 50,
      stripeWidth: 5,
      gap: 10,
      color: BLACK,
      angle: 90,
      opacity: 1,
    };
    const result = generateStripePattern(config);
    // At 90 degrees, rotated ~= dy (cos(90deg) is near-zero but not exact zero).
    // Check that rows sufficiently away from center are uniform — where dy
    // dominates over the near-zero cos component.
    let uniformRows = 0;
    for (let y = 5; y < 45; y++) {
      const firstAlpha = result.data[(y * 50 + 10) * 4 + 3];
      let isUniform = true;
      for (let x = 11; x < 40; x++) {
        if (result.data[(y * 50 + x) * 4 + 3] !== firstAlpha) {
          isUniform = false;
          break;
        }
      }
      if (isUniform) uniformRows++;
    }
    // Most rows should be uniform (allowing for float imprecision near center)
    expect(uniformRows).toBeGreaterThan(30);
  });

  it('respects opacity parameter', () => {
    const config: StripePatternConfig = {
      width: 50, height: 50, stripeWidth: 10, gap: 5, color: BLACK, angle: 0, opacity: 1,
    };
    const full = generateStripePattern(config);
    const half = generateStripePattern({ ...config, opacity: 0.5 });
    expect(maxAlpha(full)).toBe(255);
    expect(maxAlpha(half)).toBeLessThanOrEqual(128);
  });

  it('wider stripes produce more visible pixels', () => {
    const thin = generateStripePattern({
      width: 100, height: 100, stripeWidth: 2, gap: 10, color: BLACK, angle: 0, opacity: 1,
    });
    const wide = generateStripePattern({
      width: 100, height: 100, stripeWidth: 8, gap: 10, color: BLACK, angle: 0, opacity: 1,
    });
    expect(countNonTransparentPixels(wide)).toBeGreaterThan(countNonTransparentPixels(thin));
  });

  it('diagonal angle produces non-horizontal non-vertical pattern', () => {
    const config: StripePatternConfig = {
      width: 50, height: 50, stripeWidth: 5, gap: 10, color: BLACK, angle: 45, opacity: 1,
    };
    const result = generateStripePattern(config);
    // At 45 degrees, rows should NOT be uniform
    let hasNonUniformRow = false;
    for (let y = 0; y < 50; y++) {
      const firstAlpha = result.data[(y * 50 + 0) * 4 + 3];
      for (let x = 1; x < 50; x++) {
        if (result.data[(y * 50 + x) * 4 + 3] !== firstAlpha) {
          hasNonUniformRow = true;
          break;
        }
      }
      if (hasNonUniformRow) break;
    }
    expect(hasNonUniformRow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateCheckerboardPattern
// ---------------------------------------------------------------------------

describe('generateCheckerboardPattern', () => {
  it('returns ImageData with correct dimensions', () => {
    const config: CheckerboardPatternConfig = {
      width: 80,
      height: 60,
      cellSize: 10,
      color1: BLACK,
      color2: WHITE,
      opacity: 1,
    };
    const result = generateCheckerboardPattern(config);
    expect(result.width).toBe(80);
    expect(result.height).toBe(60);
    expect(result.data.length).toBe(80 * 60 * 4);
  });

  it('all pixels are non-transparent (two-color fill)', () => {
    const config: CheckerboardPatternConfig = {
      width: 40,
      height: 40,
      cellSize: 10,
      color1: BLACK,
      color2: WHITE,
      opacity: 1,
    };
    const result = generateCheckerboardPattern(config);
    expect(countNonTransparentPixels(result)).toBe(40 * 40);
  });

  it('adjacent cells have different colors', () => {
    const config: CheckerboardPatternConfig = {
      width: 40,
      height: 40,
      cellSize: 20,
      color1: BLACK,
      color2: WHITE,
      opacity: 1,
    };
    const result = generateCheckerboardPattern(config);
    // Pixel at (5, 5) should be color1 (cell 0,0)
    const idx1 = (5 * 40 + 5) * 4;
    // Pixel at (25, 5) should be color2 (cell 0,1)
    const idx2 = (5 * 40 + 25) * 4;
    expect(result.data[idx1]).not.toBe(result.data[idx2]);
  });

  it('respects opacity parameter', () => {
    const config: CheckerboardPatternConfig = {
      width: 20, height: 20, cellSize: 10, color1: BLACK, color2: WHITE, opacity: 1,
    };
    const full = generateCheckerboardPattern(config);
    const half = generateCheckerboardPattern({ ...config, opacity: 0.5 });
    expect(maxAlpha(full)).toBe(255);
    expect(maxAlpha(half)).toBeLessThanOrEqual(128);
  });

  it('uses the specified colors', () => {
    const blue: PatternColor = { r: 0, g: 0, b: 255, a: 255 };
    const config: CheckerboardPatternConfig = {
      width: 20,
      height: 20,
      cellSize: 10,
      color1: RED,
      color2: blue,
      opacity: 1,
    };
    const result = generateCheckerboardPattern(config);
    // Cell (0,0) at pixel (5,5) should be RED
    const idx1 = (5 * 20 + 5) * 4;
    expect(result.data[idx1]).toBe(255);     // r
    expect(result.data[idx1 + 1]).toBe(0);   // g
    expect(result.data[idx1 + 2]).toBe(0);   // b
    // Cell (0,1) at pixel (5,15) should be BLUE
    const idx2 = (5 * 20 + 15) * 4;
    expect(result.data[idx2]).toBe(0);       // r
    expect(result.data[idx2 + 1]).toBe(0);   // g
    expect(result.data[idx2 + 2]).toBe(255); // b
  });

  it('handles small cell sizes', () => {
    const config: CheckerboardPatternConfig = {
      width: 20, height: 20, cellSize: 1, color1: BLACK, color2: WHITE, opacity: 1,
    };
    const result = generateCheckerboardPattern(config);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    // With cellSize 1, every other pixel should alternate
    const p00 = result.data[(0 * 20 + 0) * 4];
    const p01 = result.data[(0 * 20 + 1) * 4];
    expect(p00).not.toBe(p01);
  });
});

// ---------------------------------------------------------------------------
// generateHatchPattern
// ---------------------------------------------------------------------------

describe('generateHatchPattern', () => {
  it('returns ImageData with correct dimensions', () => {
    const config: HatchPatternConfig = {
      width: 100,
      height: 75,
      lineWidth: 2,
      spacing: 12,
      angle: 45,
      color: BLACK,
      opacity: 1,
    };
    const result = generateHatchPattern(config);
    expect(result.width).toBe(100);
    expect(result.height).toBe(75);
    expect(result.data.length).toBe(100 * 75 * 4);
  });

  it('generates visible hatch lines', () => {
    const config: HatchPatternConfig = {
      width: 100,
      height: 100,
      lineWidth: 3,
      spacing: 15,
      angle: 45,
      color: BLACK,
      opacity: 1,
    };
    const result = generateHatchPattern(config);
    expect(countNonTransparentPixels(result)).toBeGreaterThan(0);
  });

  it('respects opacity parameter', () => {
    const config: HatchPatternConfig = {
      width: 50, height: 50, lineWidth: 3, spacing: 10, angle: 45, color: BLACK, opacity: 1,
    };
    const full = generateHatchPattern(config);
    const half = generateHatchPattern({ ...config, opacity: 0.5 });
    expect(maxAlpha(full)).toBe(255);
    expect(maxAlpha(half)).toBeLessThanOrEqual(128);
  });

  it('wider lines produce more visible pixels', () => {
    const thin = generateHatchPattern({
      width: 100, height: 100, lineWidth: 1, spacing: 15, angle: 45, color: BLACK, opacity: 1,
    });
    const thick = generateHatchPattern({
      width: 100, height: 100, lineWidth: 6, spacing: 15, angle: 45, color: BLACK, opacity: 1,
    });
    expect(countNonTransparentPixels(thick)).toBeGreaterThan(countNonTransparentPixels(thin));
  });

  it('different angles produce different patterns', () => {
    const config45: HatchPatternConfig = {
      width: 50, height: 50, lineWidth: 2, spacing: 10, angle: 45, color: BLACK, opacity: 1,
    };
    const config135: HatchPatternConfig = {
      ...config45, angle: 135,
    };
    const result45 = generateHatchPattern(config45);
    const result135 = generateHatchPattern(config135);
    let hasDiff = false;
    for (let i = 0; i < result45.data.length; i++) {
      if (result45.data[i] !== result135.data[i]) {
        hasDiff = true;
        break;
      }
    }
    expect(hasDiff).toBe(true);
  });

  it('uses the specified color', () => {
    const config: HatchPatternConfig = {
      width: 50, height: 50, lineWidth: 5, spacing: 10, angle: 45, color: RED, opacity: 1,
    };
    const result = generateHatchPattern(config);
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i + 3] > 0) {
        expect(result.data[i]).toBe(255);     // r
        expect(result.data[i + 1]).toBe(0);   // g
        expect(result.data[i + 2]).toBe(0);   // b
        break;
      }
    }
  });

  it('0 deg hatch produces vertical lines (consistent along center column)', () => {
    const config: HatchPatternConfig = {
      width: 50, height: 50, lineWidth: 3, spacing: 10, angle: 0, color: BLACK, opacity: 1,
    };
    const result = generateHatchPattern(config);
    // At 0 degrees, projection = dx * cos(0) + dy * sin(0) = dx, so hatch
    // lines run vertically. Each column should have uniform alpha.
    const cx = 25;
    const firstAlpha = result.data[(0 * 50 + cx) * 4 + 3];
    let isUniform = true;
    for (let y = 1; y < 50; y++) {
      if (result.data[(y * 50 + cx) * 4 + 3] !== firstAlpha) {
        isUniform = false;
        break;
      }
    }
    expect(isUniform).toBe(true);
  });
});
