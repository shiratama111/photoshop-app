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
import type { GradientStop, ProceduralColor } from '../procedural';

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
  it('returns ImageData with correct dimensions', () => {
    const result = generateConcentrationLines(100, 100, 50, 50, 30, BLACK, 20, 3);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });

  it('center area is transparent', () => {
    const result = generateConcentrationLines(100, 100, 50, 50, 60, BLACK, 30, 3);
    // Check that the center pixel is transparent
    const centerIdx = (50 * 100 + 50) * 4;
    expect(result.data[centerIdx + 3]).toBe(0);
  });

  it('has non-zero pixels outside inner radius', () => {
    const result = generateConcentrationLines(100, 100, 50, 50, 60, BLACK, 10, 5);
    let hasContent = false;
    for (let i = 3; i < result.data.length; i += 4) {
      if (result.data[i] > 0) { hasContent = true; break; }
    }
    expect(hasContent).toBe(true);
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
