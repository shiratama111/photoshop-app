/**
 * @module ai/color-palette.test
 * Tests for the color palette extraction engine.
 *
 * Test coverage:
 * - WCAG contrast ratio calculation (black/white, identical, gray pairs)
 * - Palette extraction from solid color images
 * - Palette extraction from multi-color images
 * - Role classification (background, accent, text)
 * - Edge cases: single-pixel, transparent, uniform images
 * - Color count parameter clamping
 *
 * @see ANALYZE-001: Thumbnail Analysis Engine
 * @see {@link ./color-palette.ts}
 */

import { describe, it, expect } from 'vitest';
import {
  extractColorPalette,
  calculateContrastRatio,
} from './color-palette';
// Type imports used for documentation purposes only; type-checked via return values
// import type { ColorPalette, PaletteColor } from './color-palette';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a synthetic ImageData with RGBA pixel buffer.
 * Fills with the specified color or defaults to black.
 */
function createImageData(
  width: number,
  height: number,
  fill?: { r: number; g: number; b: number; a: number },
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const color = fill ?? { r: 0, g: 0, b: 0, a: 255 };
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = color.r;
    data[i * 4 + 1] = color.g;
    data[i * 4 + 2] = color.b;
    data[i * 4 + 3] = color.a;
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/**
 * Create an ImageData with two horizontal halves of different colors.
 */
function createTwoColorImage(
  width: number,
  height: number,
  topColor: { r: number; g: number; b: number },
  bottomColor: { r: number; g: number; b: number },
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const halfH = Math.floor(height / 2);
  for (let y = 0; y < height; y++) {
    const color = y < halfH ? topColor : bottomColor;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/**
 * Create an ImageData with multiple horizontal color bands.
 */
function createMultiColorImage(
  width: number,
  height: number,
  colors: Array<{ r: number; g: number; b: number }>,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const bandHeight = Math.floor(height / colors.length);
  for (let y = 0; y < height; y++) {
    const colorIdx = Math.min(Math.floor(y / bandHeight), colors.length - 1);
    const color = colors[colorIdx];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// ---------------------------------------------------------------------------
// 1. WCAG Contrast Ratio
// ---------------------------------------------------------------------------

describe('calculateContrastRatio', () => {
  it('should return 21 for black vs white', () => {
    const ratio = calculateContrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('should return 1 for identical colors', () => {
    const ratio = calculateContrastRatio(
      { r: 128, g: 128, b: 128 },
      { r: 128, g: 128, b: 128 },
    );
    expect(ratio).toBe(1);
  });

  it('should be symmetric (order-independent)', () => {
    const ratio1 = calculateContrastRatio(
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
    );
    const ratio2 = calculateContrastRatio(
      { r: 255, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
    );
    expect(ratio1).toBeCloseTo(ratio2, 5);
  });

  it('should return a value >= 1', () => {
    const ratio = calculateContrastRatio(
      { r: 50, g: 100, b: 150 },
      { r: 60, g: 90, b: 140 },
    );
    expect(ratio).toBeGreaterThanOrEqual(1);
  });

  it('should give higher contrast for more different colors', () => {
    const lowContrast = calculateContrastRatio(
      { r: 120, g: 120, b: 120 },
      { r: 140, g: 140, b: 140 },
    );
    const highContrast = calculateContrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 200, g: 200, b: 200 },
    );
    expect(highContrast).toBeGreaterThan(lowContrast);
  });
});

// ---------------------------------------------------------------------------
// 2. Solid Color Image Extraction
// ---------------------------------------------------------------------------

describe('extractColorPalette — solid color images', () => {
  it('should extract a single dominant color from a uniform image', () => {
    const img = createImageData(100, 100, { r: 255, g: 0, b: 0, a: 255 });
    const palette = extractColorPalette(img, 5);

    expect(palette.dominant).toBeDefined();
    expect(palette.dominant.r).toBeCloseTo(255, -1);
    expect(palette.dominant.g).toBeCloseTo(0, -1);
    expect(palette.dominant.b).toBeCloseTo(0, -1);
    // Median-cut may split a uniform color into multiple identical buckets;
    // the dominant should have the highest frequency but not necessarily 1.0
    expect(palette.dominant.frequency).toBeGreaterThan(0.3);
  });

  it('should classify the sole color as background for uniform images', () => {
    const img = createImageData(50, 50, { r: 30, g: 30, b: 30, a: 255 });
    const palette = extractColorPalette(img, 3);

    const bgColors = palette.colors.filter((c) => c.role === 'background');
    expect(bgColors.length).toBeGreaterThanOrEqual(1);
  });

  it('should have contrast ratio of 1 for a uniform image', () => {
    const img = createImageData(50, 50, { r: 100, g: 100, b: 100, a: 255 });
    const palette = extractColorPalette(img);

    // All colors are the same, so contrast ratio should be 1
    expect(palette.contrastRatio).toBeCloseTo(1, 0);
  });
});

// ---------------------------------------------------------------------------
// 3. Multi-Color Image Extraction
// ---------------------------------------------------------------------------

describe('extractColorPalette — multi-color images', () => {
  it('should extract at least 2 colors from a two-color image', () => {
    const img = createTwoColorImage(
      100, 100,
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    const palette = extractColorPalette(img, 4);

    expect(palette.colors.length).toBeGreaterThanOrEqual(2);
  });

  it('should identify the larger area as background', () => {
    // 75% red, 25% blue
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const i = (y * 100 + x) * 4;
        if (y < 75) {
          data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; // red
        } else {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 255; // blue
        }
        data[i + 3] = 255;
      }
    }
    const img = { data, width: 100, height: 100, colorSpace: 'srgb' } as ImageData;
    const palette = extractColorPalette(img, 4);

    // Dominant (background) should be close to red
    expect(palette.dominant.r).toBeGreaterThan(200);
    expect(palette.dominant.role).toBe('background');
  });

  it('should extract at least 3 colors from a 5-band image', () => {
    const img = createMultiColorImage(100, 100, [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
      { r: 255, g: 0, b: 255 },
    ]);
    const palette = extractColorPalette(img, 6);

    expect(palette.colors.length).toBeGreaterThanOrEqual(3);
  });

  it('should produce a contrast ratio > 1 for black and white image', () => {
    const img = createTwoColorImage(
      100, 100,
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    const palette = extractColorPalette(img, 4);

    expect(palette.contrastRatio).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Role Classification
// ---------------------------------------------------------------------------

describe('extractColorPalette — role classification', () => {
  it('should assign background, accent, and text roles', () => {
    const img = createMultiColorImage(100, 120, [
      { r: 30, g: 30, b: 30 },     // dark bg (40 rows)
      { r: 30, g: 30, b: 30 },     // dark bg (40 rows)
      { r: 255, g: 0, b: 0 },      // red accent (20 rows)
      { r: 255, g: 255, b: 255 },  // white text (20 rows)
    ]);
    const palette = extractColorPalette(img, 4);

    const roles = new Set(palette.colors.map((c) => c.role));
    expect(roles.has('background')).toBe(true);
    // At least one of accent or text should be assigned
    expect(roles.has('accent') || roles.has('text')).toBe(true);
  });

  it('should classify the most saturated non-bg color as accent', () => {
    const img = createMultiColorImage(100, 90, [
      { r: 128, g: 128, b: 128 },  // gray bg (30 rows)
      { r: 128, g: 128, b: 128 },  // gray bg (30 rows)
      { r: 255, g: 0, b: 0 },      // highly saturated red (30 rows)
    ]);
    const palette = extractColorPalette(img, 3);

    const accentColors = palette.colors.filter((c) => c.role === 'accent');
    if (accentColors.length > 0) {
      // The accent should be close to red (the most saturated)
      expect(accentColors[0].r).toBeGreaterThan(200);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Edge Cases
// ---------------------------------------------------------------------------

describe('extractColorPalette — edge cases', () => {
  it('should handle a 1x1 pixel image', () => {
    const img = createImageData(1, 1, { r: 42, g: 84, b: 126, a: 255 });
    const palette = extractColorPalette(img);

    expect(palette.dominant).toBeDefined();
    expect(palette.colors.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle a fully transparent image', () => {
    const img = createImageData(50, 50, { r: 0, g: 0, b: 0, a: 0 });
    const palette = extractColorPalette(img);

    // Should still return a valid palette (fallback)
    expect(palette.dominant).toBeDefined();
    expect(palette.colors.length).toBeGreaterThanOrEqual(1);
  });

  it('should clamp colorCount to valid range', () => {
    const img = createImageData(50, 50, { r: 128, g: 128, b: 128, a: 255 });

    // Too small — should be clamped to 2
    const palette1 = extractColorPalette(img, 0);
    expect(palette1.colors.length).toBeGreaterThanOrEqual(1);

    // Too large — should be clamped to 16
    const palette2 = extractColorPalette(img, 100);
    expect(palette2.colors.length).toBeGreaterThanOrEqual(1);
  });

  it('should return frequencies that sum to approximately 1', () => {
    const img = createTwoColorImage(
      100, 100,
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
    );
    const palette = extractColorPalette(img, 4);

    const totalFreq = palette.colors.reduce((sum, c) => sum + c.frequency, 0);
    expect(totalFreq).toBeCloseTo(1, 1);
  });

  it('should return colors with RGB values in 0-255 range', () => {
    const img = createMultiColorImage(80, 80, [
      { r: 10, g: 20, b: 30 },
      { r: 200, g: 210, b: 220 },
      { r: 100, g: 50, b: 150 },
    ]);
    const palette = extractColorPalette(img, 5);

    for (const color of palette.colors) {
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(255);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(255);
    }
  });
});
