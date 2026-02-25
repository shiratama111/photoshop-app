/**
 * @module procedural.test
 * Tests for procedural image generation functions.
 *
 * @see Phase 1-3/1-4
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateGradientBackground,
  generatePattern,
  generateConcentrationLines,
  generateBorderFrame,
  generateGradientMask,
} from '../procedural';
import type { GradientStop, ProceduralColor, ConcentrationLinesConfig } from '../procedural';

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

const WHITE: ProceduralColor = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: ProceduralColor = { r: 0, g: 0, b: 0, a: 255 };

const SIMPLE_STOPS: GradientStop[] = [
  { position: 0, r: 255, g: 0, b: 0, a: 255 },
  { position: 1, r: 0, g: 0, b: 255, a: 255 },
];

describe('generateGradientBackground', () => {
  it('returns ImageData with correct dimensions', () => {
    const result = generateGradientBackground(100, 50, SIMPLE_STOPS, 'linear', 180);
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.data.length).toBe(100 * 50 * 4);
  });

  it('fills pixels with non-zero values', () => {
    const result = generateGradientBackground(10, 10, SIMPLE_STOPS, 'linear', 180);
    let nonZero = 0;
    for (let i = 0; i < result.data.length; i++) {
      if (result.data[i] !== 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(0);
  });

  it('works with radial type', () => {
    const result = generateGradientBackground(20, 20, SIMPLE_STOPS, 'radial');
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('works with 3-stop gradient', () => {
    const stops: GradientStop[] = [
      { position: 0, r: 255, g: 0, b: 0, a: 255 },
      { position: 0.5, r: 0, g: 255, b: 0, a: 255 },
      { position: 1, r: 0, g: 0, b: 255, a: 255 },
    ];
    const result = generateGradientBackground(30, 30, stops, 'linear', 90);
    expect(result.data.length).toBe(30 * 30 * 4);
  });
});

describe('generatePattern', () => {
  it('generates dots pattern with correct size', () => {
    const result = generatePattern(100, 100, 'dots', BLACK, 20, 4, 1);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });

  it('generates stripes pattern', () => {
    const result = generatePattern(50, 50, 'stripes', BLACK, 10, 3, 0.8);
    expect(result.data.length).toBe(50 * 50 * 4);
    // Should have some non-zero alpha pixels (stripes)
    let hasContent = false;
    for (let i = 3; i < result.data.length; i += 4) {
      if (result.data[i] > 0) { hasContent = true; break; }
    }
    expect(hasContent).toBe(true);
  });

  it('generates checker pattern', () => {
    const result = generatePattern(40, 40, 'checker', WHITE, 10, 10, 1);
    expect(result.width).toBe(40);
  });

  it('generates diagonal-stripes pattern', () => {
    const result = generatePattern(60, 60, 'diagonal-stripes', BLACK, 15, 3, 0.5);
    expect(result.data.length).toBe(60 * 60 * 4);
  });

  it('respects opacity parameter', () => {
    const full = generatePattern(10, 10, 'stripes', BLACK, 2, 2, 1);
    const half = generatePattern(10, 10, 'stripes', BLACK, 2, 2, 0.5);

    // Find a pixel that's a stripe in both
    let fullAlpha = 0;
    let halfAlpha = 0;
    for (let i = 3; i < full.data.length; i += 4) {
      if (full.data[i] > 0 && half.data[i] > 0) {
        fullAlpha = full.data[i];
        halfAlpha = half.data[i];
        break;
      }
    }
    // Half opacity should produce lower alpha
    if (fullAlpha > 0) {
      expect(halfAlpha).toBeLessThan(fullAlpha);
    }
  });
});

describe('generateConcentrationLines', () => {
  /** Helper to create a default config with optional overrides. */
  function makeConfig(overrides?: Partial<ConcentrationLinesConfig>): ConcentrationLinesConfig {
    return {
      centerX: 50,
      centerY: 50,
      canvasWidth: 100,
      canvasHeight: 100,
      lineCount: 30,
      lineWidthMin: 2,
      lineWidthMax: 6,
      innerRadius: 0.2,
      color: BLACK,
      randomSeed: 12345,
      ...overrides,
    };
  }

  /** Count pixels with non-zero alpha in the given ImageData. */
  function countNonTransparentPixels(imageData: ImageData): number {
    let count = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) count++;
    }
    return count;
  }

  it('returns ImageData with correct dimensions', () => {
    const result = generateConcentrationLines(makeConfig());
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.data.length).toBe(100 * 100 * 4);
  });

  it('returns ImageData with correct dimensions for non-square canvas', () => {
    const result = generateConcentrationLines(makeConfig({
      canvasWidth: 200,
      canvasHeight: 80,
      centerX: 100,
      centerY: 40,
    }));
    expect(result.width).toBe(200);
    expect(result.height).toBe(80);
    expect(result.data.length).toBe(200 * 80 * 4);
  });

  it('center area within innerRadius is transparent', () => {
    const config = makeConfig({ innerRadius: 0.3 });
    const result = generateConcentrationLines(config);
    // The center pixel itself should be transparent
    const centerIdx = (50 * 100 + 50) * 4;
    expect(result.data[centerIdx + 3]).toBe(0);
  });

  it('has non-zero pixels outside inner radius', () => {
    const result = generateConcentrationLines(makeConfig({ lineCount: 60, lineWidthMin: 4, lineWidthMax: 8 }));
    expect(countNonTransparentPixels(result)).toBeGreaterThan(0);
  });

  it('lineCount=0 returns fully transparent image', () => {
    const result = generateConcentrationLines(makeConfig({ lineCount: 0 }));
    expect(countNonTransparentPixels(result)).toBe(0);
  });

  it('innerRadius=0 draws lines starting from center', () => {
    const result = generateConcentrationLines(makeConfig({
      innerRadius: 0,
      lineCount: 60,
      lineWidthMin: 4,
      lineWidthMax: 8,
    }));
    // Should still have content (lines reach near center)
    expect(countNonTransparentPixels(result)).toBeGreaterThan(0);
  });

  it('innerRadius=1 creates a large clear center (most pixels transparent)', () => {
    const result = generateConcentrationLines(makeConfig({ innerRadius: 1 }));
    // With innerRadius=1, the clear area covers half the diagonal.
    // Most pixels near the center should be transparent.
    const totalPixels = 100 * 100;
    const visiblePixels = countNonTransparentPixels(result);
    // The vast majority of pixels should be transparent
    expect(visiblePixels).toBeLessThan(totalPixels * 0.5);
  });

  it('seeded random produces identical output for same seed', () => {
    const config = makeConfig({ randomSeed: 99999 });
    const result1 = generateConcentrationLines(config);
    const result2 = generateConcentrationLines(config);
    expect(result1.data).toEqual(result2.data);
  });

  it('different seeds produce different output', () => {
    const result1 = generateConcentrationLines(makeConfig({ randomSeed: 111 }));
    const result2 = generateConcentrationLines(makeConfig({ randomSeed: 222 }));
    // At least some pixels should differ
    let hasDiff = false;
    for (let i = 0; i < result1.data.length; i++) {
      if (result1.data[i] !== result2.data[i]) {
        hasDiff = true;
        break;
      }
    }
    expect(hasDiff).toBe(true);
  });

  it('more lines produce more visible pixels', () => {
    const few = generateConcentrationLines(makeConfig({ lineCount: 10, lineWidthMin: 3, lineWidthMax: 5 }));
    const many = generateConcentrationLines(makeConfig({ lineCount: 80, lineWidthMin: 3, lineWidthMax: 5 }));
    expect(countNonTransparentPixels(many)).toBeGreaterThan(countNonTransparentPixels(few));
  });

  it('wider lines produce more visible pixels', () => {
    const thin = generateConcentrationLines(makeConfig({ lineWidthMin: 1, lineWidthMax: 2, lineCount: 40 }));
    const thick = generateConcentrationLines(makeConfig({ lineWidthMin: 8, lineWidthMax: 16, lineCount: 40 }));
    expect(countNonTransparentPixels(thick)).toBeGreaterThan(countNonTransparentPixels(thin));
  });

  it('uses default seed when randomSeed is omitted', () => {
    const config1: ConcentrationLinesConfig = {
      centerX: 50,
      centerY: 50,
      canvasWidth: 100,
      canvasHeight: 100,
      lineCount: 30,
      lineWidthMin: 2,
      lineWidthMax: 6,
      innerRadius: 0.2,
      color: BLACK,
    };
    const config2 = { ...config1 };
    const result1 = generateConcentrationLines(config1);
    const result2 = generateConcentrationLines(config2);
    // Without explicit seed, both should use the same default and produce identical results
    expect(result1.data).toEqual(result2.data);
  });

  it('respects the color parameter', () => {
    const red: ProceduralColor = { r: 255, g: 0, b: 0, a: 255 };
    const result = generateConcentrationLines(makeConfig({
      color: red,
      lineCount: 60,
      lineWidthMin: 4,
      lineWidthMax: 8,
    }));
    // Find a non-transparent pixel and verify it uses the specified color
    let foundColor = false;
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i + 3] > 0) {
        expect(result.data[i]).toBe(255);     // r
        expect(result.data[i + 1]).toBe(0);   // g
        expect(result.data[i + 2]).toBe(0);   // b
        foundColor = true;
        break;
      }
    }
    expect(foundColor).toBe(true);
  });
});

describe('generateBorderFrame', () => {
  it('generates solid border', () => {
    const result = generateBorderFrame(100, 80, 5, WHITE, 0, 'solid');
    expect(result.width).toBe(100);
    expect(result.height).toBe(80);

    // Top-left corner should have border pixels
    const topLeftIdx = (0 * 100 + 0) * 4;
    expect(result.data[topLeftIdx + 3]).toBe(255);

    // Center should be transparent
    const centerIdx = (40 * 100 + 50) * 4;
    expect(result.data[centerIdx + 3]).toBe(0);
  });

  it('generates double border', () => {
    const result = generateBorderFrame(100, 80, 12, BLACK, 0, 'double');
    expect(result.data.length).toBe(100 * 80 * 4);
  });

  it('generates dashed border', () => {
    const result = generateBorderFrame(100, 80, 5, BLACK, 0, 'dashed');
    // Should have some non-zero and some zero alpha in the border region
    let hasContent = false;
    let hasGap = false;
    for (let x = 0; x < 100; x++) {
      const idx = (0 * 100 + x) * 4; // top row
      if (result.data[idx + 3] > 0) hasContent = true;
      else hasGap = true;
    }
    expect(hasContent).toBe(true);
    expect(hasGap).toBe(true);
  });

  it('supports corner radius', () => {
    const result = generateBorderFrame(100, 80, 5, WHITE, 10, 'solid');
    // The very corner (0,0) should be transparent due to rounded corner
    const cornerIdx = (0 * 100 + 0) * 4;
    expect(result.data[cornerIdx + 3]).toBe(0);
  });
});

describe('generateGradientMask', () => {
  function createOpaqueImage(w: number, h: number): ImageData {
    const img = new ImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 128;
      img.data[i + 1] = 128;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
    return img;
  }

  it('returns new ImageData (does not mutate source)', () => {
    const source = createOpaqueImage(20, 20);
    const origData = new Uint8ClampedArray(source.data);
    const result = generateGradientMask(source, 'bottom', 0.3, 1.0);
    expect(result).not.toBe(source);
    expect(source.data).toEqual(origData);
  });

  it('bottom direction: top is opaque, bottom is faded', () => {
    const result = generateGradientMask(createOpaqueImage(10, 100), 'bottom', 0, 1);
    // Top pixel should be fully opaque
    expect(result.data[3]).toBe(255);
    // Bottom pixel should be transparent or nearly so
    const lastIdx = (99 * 10 + 5) * 4;
    expect(result.data[lastIdx + 3]).toBeLessThan(10);
  });

  it('top direction: bottom is opaque, top is faded', () => {
    const result = generateGradientMask(createOpaqueImage(10, 100), 'top', 0, 1);
    // Top pixel should be faded
    expect(result.data[3]).toBeLessThan(10);
    // Bottom pixel should be nearly opaque (slight rounding at edge)
    const lastIdx = (99 * 10 + 5) * 4;
    expect(result.data[lastIdx + 3]).toBeGreaterThan(240);
  });

  it('radial direction: center is opaque, edges are faded', () => {
    const result = generateGradientMask(createOpaqueImage(100, 100), 'radial', 0.2, 0.8);
    // Center should be mostly opaque
    const centerIdx = (50 * 100 + 50) * 4;
    expect(result.data[centerIdx + 3]).toBeGreaterThan(200);
    // Corner should be faded
    const cornerIdx = (0 * 100 + 0) * 4;
    expect(result.data[cornerIdx + 3]).toBeLessThan(50);
  });
});
