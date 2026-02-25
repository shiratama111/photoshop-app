/**
 * @module gradient-mask.test
 * Tests for gradient mask generation and application.
 *
 * @see GMASK-001 - Gradient mask ticket
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { generateGradientMask, applyGradientMask } from './gradient-mask';
import type { GradientMaskConfig } from './gradient-mask';

// ---------------------------------------------------------------------------
// Polyfill ImageData for Node.js test environment
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a default config with overrides. */
function makeConfig(overrides?: Partial<GradientMaskConfig>): GradientMaskConfig {
  return {
    type: 'linear',
    direction: 0,
    startPosition: 0,
    endPosition: 100,
    reversed: false,
    ...overrides,
  };
}

/**
 * Get the alpha value at a specific pixel coordinate.
 *
 * @param imageData - The ImageData to read from
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Alpha value (0-255)
 */
function getAlpha(imageData: ImageData, x: number, y: number): number {
  const idx = (y * imageData.width + x) * 4;
  return imageData.data[idx + 3];
}

/**
 * Create a solid-color source ImageData for testing applyGradientMask.
 *
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @param alpha - Alpha value for all pixels (0-255)
 * @returns ImageData filled with the specified alpha
 */
function createSolidSource(width: number, height: number, alpha: number = 255): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;     // R
    data[i + 1] = 64;  // G
    data[i + 2] = 200; // B
    data[i + 3] = alpha;
  }
  return imageData;
}

// ---------------------------------------------------------------------------
// generateGradientMask — Linear
// ---------------------------------------------------------------------------

describe('generateGradientMask — linear', () => {
  it('generates a top-to-bottom gradient (direction=0)', () => {
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    expect(mask.width).toBe(100);
    expect(mask.height).toBe(100);

    // Top row should be fully opaque (alpha ~255)
    const topAlpha = getAlpha(mask, 50, 0);
    expect(topAlpha).toBe(255);

    // Bottom row should be fully transparent (alpha ~0)
    const bottomAlpha = getAlpha(mask, 50, 99);
    expect(bottomAlpha).toBeLessThanOrEqual(5);

    // Middle should be roughly half
    const midAlpha = getAlpha(mask, 50, 50);
    expect(midAlpha).toBeGreaterThan(100);
    expect(midAlpha).toBeLessThan(160);
  });

  it('generates a left-to-right gradient (direction=90)', () => {
    const config = makeConfig({ type: 'linear', direction: 90, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    // Left edge should be opaque
    const leftAlpha = getAlpha(mask, 0, 50);
    expect(leftAlpha).toBe(255);

    // Right edge should be transparent
    const rightAlpha = getAlpha(mask, 99, 50);
    expect(rightAlpha).toBeLessThanOrEqual(5);
  });

  it('generates a bottom-to-top gradient (direction=180)', () => {
    const config = makeConfig({ type: 'linear', direction: 180, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    // Bottom should be opaque
    const bottomAlpha = getAlpha(mask, 50, 99);
    expect(bottomAlpha).toBe(255);

    // Top should be transparent
    const topAlpha = getAlpha(mask, 50, 0);
    expect(topAlpha).toBeLessThanOrEqual(5);
  });

  it('generates a right-to-left gradient (direction=270)', () => {
    const config = makeConfig({ type: 'linear', direction: 270, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    // Right should be opaque
    const rightAlpha = getAlpha(mask, 99, 50);
    expect(rightAlpha).toBe(255);

    // Left should be transparent
    const leftAlpha = getAlpha(mask, 0, 50);
    expect(leftAlpha).toBeLessThanOrEqual(5);
  });

  it('generates a diagonal gradient (direction=45)', () => {
    const config = makeConfig({ type: 'linear', direction: 45, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    // Top-left corner should be most opaque
    const topLeftAlpha = getAlpha(mask, 0, 0);
    // Bottom-right corner should be most transparent
    const bottomRightAlpha = getAlpha(mask, 99, 99);

    expect(topLeftAlpha).toBeGreaterThan(bottomRightAlpha);
    expect(topLeftAlpha).toBe(255);
    expect(bottomRightAlpha).toBeLessThanOrEqual(5);
  });

  it('produces uniform alpha with equal start and end', () => {
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 50, endPosition: 50 });
    const mask = generateGradientMask(100, 100, config);

    // Before the threshold (t < 0.5): opaque, after: transparent
    const aboveAlpha = getAlpha(mask, 50, 0);
    const belowAlpha = getAlpha(mask, 50, 99);
    expect(aboveAlpha).toBe(255);
    expect(belowAlpha).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateGradientMask — Radial
// ---------------------------------------------------------------------------

describe('generateGradientMask — radial', () => {
  it('generates a center-to-edge gradient', () => {
    const config = makeConfig({ type: 'radial', startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    // Center should be fully opaque
    const centerAlpha = getAlpha(mask, 50, 50);
    expect(centerAlpha).toBe(255);

    // Corner should be fully transparent
    const cornerAlpha = getAlpha(mask, 0, 0);
    expect(cornerAlpha).toBeLessThanOrEqual(5);
  });

  it('fades from center outward', () => {
    const config = makeConfig({ type: 'radial', startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(200, 200, config);

    // Pixels closer to center should have higher alpha
    const innerAlpha = getAlpha(mask, 100, 80);  // close to center
    const outerAlpha = getAlpha(mask, 100, 20);  // further from center

    expect(innerAlpha).toBeGreaterThan(outerAlpha);
  });

  it('ignores direction parameter for radial type', () => {
    const config0 = makeConfig({ type: 'radial', direction: 0, startPosition: 0, endPosition: 100 });
    const config90 = makeConfig({ type: 'radial', direction: 90, startPosition: 0, endPosition: 100 });
    const mask0 = generateGradientMask(50, 50, config0);
    const mask90 = generateGradientMask(50, 50, config90);

    // Both should produce identical masks
    for (let i = 0; i < mask0.data.length; i++) {
      expect(mask0.data[i]).toBe(mask90.data[i]);
    }
  });

  it('with reversed: center transparent, edge opaque', () => {
    const config = makeConfig({ type: 'radial', startPosition: 0, endPosition: 100, reversed: true });
    const mask = generateGradientMask(100, 100, config);

    // Center should be transparent
    const centerAlpha = getAlpha(mask, 50, 50);
    expect(centerAlpha).toBe(0);

    // Corner should be opaque
    const cornerAlpha = getAlpha(mask, 0, 0);
    expect(cornerAlpha).toBeGreaterThanOrEqual(250);
  });
});

// ---------------------------------------------------------------------------
// Start/End Position Control
// ---------------------------------------------------------------------------

describe('start/end position control', () => {
  it('delays fade when startPosition > 0', () => {
    const configImmediate = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const configDelayed = makeConfig({ type: 'linear', direction: 0, startPosition: 50, endPosition: 100 });
    const maskImmediate = generateGradientMask(100, 100, configImmediate);
    const maskDelayed = generateGradientMask(100, 100, configDelayed);

    // At 25% down, immediate fade has already started; delayed fade has not
    const alphaImmediate = getAlpha(maskImmediate, 50, 25);
    const alphaDelayed = getAlpha(maskDelayed, 50, 25);
    expect(alphaDelayed).toBe(255);
    expect(alphaImmediate).toBeLessThan(255);
  });

  it('truncates fade when endPosition < 100', () => {
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 50 });
    const mask = generateGradientMask(100, 100, config);

    // At 75% down, the fade should be complete (fully transparent)
    const alpha = getAlpha(mask, 50, 75);
    expect(alpha).toBe(0);
  });

  it('clamps positions to valid range', () => {
    // Negative startPosition, over-100 endPosition — should not crash
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: -10, endPosition: 150 });
    const mask = generateGradientMask(50, 50, config);
    expect(mask.width).toBe(50);
    expect(mask.height).toBe(50);
  });

  it('creates a narrow fade band', () => {
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 45, endPosition: 55 });
    const mask = generateGradientMask(100, 100, config);

    // Well before fade: fully opaque
    const beforeFade = getAlpha(mask, 50, 10);
    expect(beforeFade).toBe(255);

    // Well after fade: fully transparent
    const afterFade = getAlpha(mask, 50, 90);
    expect(afterFade).toBe(0);

    // In the fade band: partially transparent
    const inFade = getAlpha(mask, 50, 50);
    expect(inFade).toBeGreaterThan(0);
    expect(inFade).toBeLessThan(255);
  });
});

// ---------------------------------------------------------------------------
// Mask Reversal
// ---------------------------------------------------------------------------

describe('mask reversal', () => {
  it('reverses a linear gradient', () => {
    const configNormal = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100, reversed: false });
    const configReversed = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100, reversed: true });
    const maskNormal = generateGradientMask(100, 100, configNormal);
    const maskReversed = generateGradientMask(100, 100, configReversed);

    // Top row: normal=opaque, reversed=transparent
    const topNormal = getAlpha(maskNormal, 50, 0);
    const topReversed = getAlpha(maskReversed, 50, 0);
    expect(topNormal).toBe(255);
    expect(topReversed).toBe(0);

    // Bottom row: normal=transparent, reversed=opaque
    const bottomNormal = getAlpha(maskNormal, 50, 99);
    const bottomReversed = getAlpha(maskReversed, 50, 99);
    expect(bottomNormal).toBeLessThanOrEqual(5);
    expect(bottomReversed).toBeGreaterThanOrEqual(250);
  });

  it('reverses a radial gradient', () => {
    const configNormal = makeConfig({ type: 'radial', startPosition: 0, endPosition: 100, reversed: false });
    const configReversed = makeConfig({ type: 'radial', startPosition: 0, endPosition: 100, reversed: true });
    const maskNormal = generateGradientMask(100, 100, configNormal);
    const maskReversed = generateGradientMask(100, 100, configReversed);

    // Center: normal=opaque, reversed=transparent
    const centerNormal = getAlpha(maskNormal, 50, 50);
    const centerReversed = getAlpha(maskReversed, 50, 50);
    expect(centerNormal).toBe(255);
    expect(centerReversed).toBe(0);
  });

  it('alpha values of normal + reversed sum to 255', () => {
    const configNormal = makeConfig({ type: 'linear', direction: 0, startPosition: 20, endPosition: 80, reversed: false });
    const configReversed = makeConfig({ type: 'linear', direction: 0, startPosition: 20, endPosition: 80, reversed: true });
    const maskNormal = generateGradientMask(50, 50, configNormal);
    const maskReversed = generateGradientMask(50, 50, configReversed);

    for (let i = 3; i < maskNormal.data.length; i += 4) {
      const sum = maskNormal.data[i] + maskReversed.data[i];
      // Due to rounding, allow +-1 difference
      expect(sum).toBeGreaterThanOrEqual(254);
      expect(sum).toBeLessThanOrEqual(256);
    }
  });
});

// ---------------------------------------------------------------------------
// applyGradientMask
// ---------------------------------------------------------------------------

describe('applyGradientMask', () => {
  it('multiplies source alpha by mask alpha', () => {
    const source = createSolidSource(100, 100, 255);
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    const result = applyGradientMask(source, mask);

    // Top: source=255 * mask=255 => ~255
    expect(getAlpha(result, 50, 0)).toBe(255);

    // Bottom: source=255 * mask=~0 => ~0
    expect(getAlpha(result, 50, 99)).toBeLessThanOrEqual(5);

    // RGB should be preserved from source
    const idx = (0 * 100 + 50) * 4;
    expect(result.data[idx]).toBe(128);     // R
    expect(result.data[idx + 1]).toBe(64);  // G
    expect(result.data[idx + 2]).toBe(200); // B
  });

  it('preserves fully transparent source pixels', () => {
    const source = createSolidSource(50, 50, 0);
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(50, 50, config);

    const result = applyGradientMask(source, mask);

    // All pixels should remain transparent regardless of mask
    for (let i = 3; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(0);
    }
  });

  it('handles partially transparent source', () => {
    const source = createSolidSource(100, 100, 128);
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(100, 100, config);

    const result = applyGradientMask(source, mask);

    // Top: source=128 * mask=255/255 => ~128
    const topAlpha = getAlpha(result, 50, 0);
    expect(topAlpha).toBe(128);

    // Bottom: source=128 * mask=~0 => ~0
    const bottomAlpha = getAlpha(result, 50, 99);
    expect(bottomAlpha).toBeLessThanOrEqual(3);
  });

  it('does not mutate the source ImageData', () => {
    const source = createSolidSource(50, 50, 200);
    const originalData = new Uint8ClampedArray(source.data);
    const mask = generateGradientMask(50, 50, makeConfig());

    applyGradientMask(source, mask);

    // Source should be unchanged
    for (let i = 0; i < source.data.length; i++) {
      expect(source.data[i]).toBe(originalData[i]);
    }
  });

  it('throws on dimension mismatch', () => {
    const source = createSolidSource(100, 100, 255);
    const mask = generateGradientMask(50, 50, makeConfig());

    expect(() => applyGradientMask(source, mask)).toThrow(/Dimension mismatch/);
  });

  it('applies a fully opaque mask (no change) using reversed with start=0 end=0', () => {
    const source = createSolidSource(50, 50, 200);
    // A reversed mask with start=0, end=0: computeAlpha sees start>=end,
    // so alphaMul = (t < 0) ? 1 : 0 => 0 for all t>=0, then reversed => 1.
    // All pixels get alpha=255.
    const config = makeConfig({
      type: 'linear', direction: 0,
      startPosition: 0, endPosition: 0, reversed: true,
    });
    const mask = generateGradientMask(50, 50, config);

    const result = applyGradientMask(source, mask);

    // Every pixel: mask alpha = 255, so result alpha = 200
    for (let i = 3; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles 1x1 image', () => {
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(1, 1, config);
    expect(mask.width).toBe(1);
    expect(mask.height).toBe(1);
    // Single pixel: for a 1x1 image, projection normalizes to 0, so alpha = 255
    expect(getAlpha(mask, 0, 0)).toBe(255);
  });

  it('handles 1x1 radial image', () => {
    const config = makeConfig({ type: 'radial', startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(1, 1, config);
    expect(mask.width).toBe(1);
    expect(mask.height).toBe(1);
  });

  it('handles wide non-square image', () => {
    const config = makeConfig({ type: 'linear', direction: 90, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(200, 50, config);
    expect(mask.width).toBe(200);
    expect(mask.height).toBe(50);

    // Left edge opaque, right edge transparent
    expect(getAlpha(mask, 0, 25)).toBe(255);
    expect(getAlpha(mask, 199, 25)).toBeLessThanOrEqual(5);
  });

  it('handles tall non-square image', () => {
    const config = makeConfig({ type: 'linear', direction: 0, startPosition: 0, endPosition: 100 });
    const mask = generateGradientMask(50, 200, config);
    expect(mask.width).toBe(50);
    expect(mask.height).toBe(200);

    // Top opaque, bottom transparent
    expect(getAlpha(mask, 25, 0)).toBe(255);
    expect(getAlpha(mask, 25, 199)).toBeLessThanOrEqual(5);
  });

  it('handles direction > 360 (wraps correctly)', () => {
    const config360 = makeConfig({ type: 'linear', direction: 450, startPosition: 0, endPosition: 100 });
    const config90 = makeConfig({ type: 'linear', direction: 90, startPosition: 0, endPosition: 100 });
    const mask360 = generateGradientMask(50, 50, config360);
    const mask90 = generateGradientMask(50, 50, config90);

    // sin/cos handle wrapping, so 450 and 90 should produce the same mask
    for (let i = 0; i < mask360.data.length; i++) {
      expect(Math.abs(mask360.data[i] - mask90.data[i])).toBeLessThanOrEqual(1);
    }
  });

  it('handles negative direction', () => {
    const configNeg = makeConfig({ type: 'linear', direction: -90, startPosition: 0, endPosition: 100 });
    const config270 = makeConfig({ type: 'linear', direction: 270, startPosition: 0, endPosition: 100 });
    const maskNeg = generateGradientMask(50, 50, configNeg);
    const mask270 = generateGradientMask(50, 50, config270);

    for (let i = 0; i < maskNeg.data.length; i++) {
      expect(Math.abs(maskNeg.data[i] - mask270.data[i])).toBeLessThanOrEqual(1);
    }
  });

  it('RGB channels are always 0 in generated mask', () => {
    const config = makeConfig({ type: 'linear', direction: 45, startPosition: 20, endPosition: 80 });
    const mask = generateGradientMask(50, 50, config);

    for (let i = 0; i < mask.data.length; i += 4) {
      expect(mask.data[i]).toBe(0);     // R
      expect(mask.data[i + 1]).toBe(0); // G
      expect(mask.data[i + 2]).toBe(0); // B
    }
  });
});
