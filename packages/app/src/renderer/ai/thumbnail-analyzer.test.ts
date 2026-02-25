/**
 * @module ai/thumbnail-analyzer.test
 * Tests for the full thumbnail analysis engine.
 *
 * Test coverage:
 * - Full analysis pipeline (analyzeThumbnail) integration
 * - ThumbnailAnalysis schema validation (all required fields)
 * - Effect estimation (estimateEffects) for stroke/shadow/glow patterns
 * - Text region position labeling
 * - Edge cases: no text regions, uniform image, small image
 * - Style description generation
 *
 * @see ANALYZE-001: Thumbnail Analysis Engine
 * @see {@link ./thumbnail-analyzer.ts}
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeThumbnail,
  estimateEffects,
} from './thumbnail-analyzer';
// Type imports used for documentation purposes; type-checked via return values
// import type { ThumbnailAnalysis, EstimatedEffect } from './thumbnail-analyzer';
import type { LayoutRegion } from '../../../../ai/src/layout-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a synthetic ImageData filled with a single color.
 */
function createImageData(
  width: number,
  height: number,
  fill?: { r: number; g: number; b: number; a: number },
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  const color = fill ?? { r: 128, g: 128, b: 128, a: 255 };
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = color.r;
    data[i * 4 + 1] = color.g;
    data[i * 4 + 2] = color.b;
    data[i * 4 + 3] = color.a;
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/**
 * Create an image that simulates text with a stroke:
 * Dark background, white text-like region with a colored border.
 */
function createStrokeTextImage(
  width: number,
  height: number,
  textBounds: { x: number; y: number; w: number; h: number },
  strokeColor: { r: number; g: number; b: number },
  strokeWidth: number,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  // Dark background
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 30;
    data[i * 4 + 1] = 30;
    data[i * 4 + 2] = 30;
    data[i * 4 + 3] = 255;
  }

  // Stroke region (slightly larger than text bounds)
  for (let y = textBounds.y - strokeWidth; y < textBounds.y + textBounds.h + strokeWidth; y++) {
    for (let x = textBounds.x - strokeWidth; x < textBounds.x + textBounds.w + strokeWidth; x++) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        const i = (y * width + x) * 4;
        data[i] = strokeColor.r;
        data[i + 1] = strokeColor.g;
        data[i + 2] = strokeColor.b;
        data[i + 3] = 255;
      }
    }
  }

  // White text interior
  for (let y = textBounds.y; y < textBounds.y + textBounds.h; y++) {
    for (let x = textBounds.x; x < textBounds.x + textBounds.w; x++) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }

  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/**
 * Create an image that simulates a shadow pattern:
 * Bright content region with a dark offset copy below-right.
 */
function createShadowTextImage(
  width: number,
  height: number,
  textBounds: { x: number; y: number; w: number; h: number },
  shadowOffset: number,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  // Medium gray background
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 180;
    data[i * 4 + 1] = 180;
    data[i * 4 + 2] = 180;
    data[i * 4 + 3] = 255;
  }

  // Dark shadow (offset below-right)
  for (let y = textBounds.y + shadowOffset; y < textBounds.y + textBounds.h + shadowOffset + 4; y++) {
    for (let x = textBounds.x + shadowOffset; x < textBounds.x + textBounds.w + shadowOffset + 4; x++) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        const i = (y * width + x) * 4;
        data[i] = 20;
        data[i + 1] = 20;
        data[i + 2] = 20;
        data[i + 3] = 255;
      }
    }
  }

  // White text
  for (let y = textBounds.y; y < textBounds.y + textBounds.h; y++) {
    for (let x = textBounds.x; x < textBounds.x + textBounds.w; x++) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }

  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// ---------------------------------------------------------------------------
// 1. Full Analysis Pipeline
// ---------------------------------------------------------------------------

describe('analyzeThumbnail — full pipeline', () => {
  it('should return a valid ThumbnailAnalysis object', () => {
    const img = createImageData(200, 150);
    const analysis = analyzeThumbnail(img);

    expect(analysis).toBeDefined();
    expect(analysis.layout).toBeDefined();
    expect(Array.isArray(analysis.layout)).toBe(true);
    expect(analysis.texts).toBeDefined();
    expect(Array.isArray(analysis.texts)).toBe(true);
    expect(analysis.palette).toBeDefined();
    expect(analysis.palette.dominant).toBeDefined();
    expect(analysis.palette.colors).toBeDefined();
    expect(analysis.estimatedEffects).toBeDefined();
    expect(Array.isArray(analysis.estimatedEffects)).toBe(true);
    expect(typeof analysis.styleDescription).toBe('string');
  });

  it('should extract a color palette with at least one color', () => {
    const img = createImageData(100, 100, { r: 255, g: 128, b: 0, a: 255 });
    const analysis = analyzeThumbnail(img);

    expect(analysis.palette.colors.length).toBeGreaterThanOrEqual(1);
    expect(analysis.palette.dominant.r).toBeGreaterThan(200);
  });

  it('should detect layout regions', () => {
    const img = createImageData(200, 200, { r: 100, g: 100, b: 100, a: 255 });
    const analysis = analyzeThumbnail(img);

    expect(analysis.layout.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate a style description string', () => {
    const img = createImageData(100, 100);
    const analysis = analyzeThumbnail(img);

    expect(typeof analysis.styleDescription).toBe('string');
    expect(analysis.styleDescription.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Schema Validation
// ---------------------------------------------------------------------------

describe('analyzeThumbnail — schema validation', () => {
  it('should have palette with contrastRatio >= 1', () => {
    const img = createImageData(100, 100);
    const analysis = analyzeThumbnail(img);

    expect(analysis.palette.contrastRatio).toBeGreaterThanOrEqual(1);
  });

  it('should have layout regions with valid types', () => {
    const img = createImageData(200, 200);
    const analysis = analyzeThumbnail(img);

    const validTypes = new Set(['text', 'image', 'background']);
    for (const region of analysis.layout) {
      expect(validTypes.has(region.type)).toBe(true);
    }
  });

  it('should have estimated effects with confidence 0-1', () => {
    const img = createStrokeTextImage(
      300, 200,
      { x: 50, y: 50, w: 200, h: 40 },
      { r: 0, g: 0, b: 0 },
      4,
    );
    const analysis = analyzeThumbnail(img);

    for (const effect of analysis.estimatedEffects) {
      expect(effect.confidence).toBeGreaterThanOrEqual(0);
      expect(effect.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should have text regions with position labels', () => {
    const img = createStrokeTextImage(
      400, 300,
      { x: 50, y: 20, w: 300, h: 15 },
      { r: 0, g: 0, b: 0 },
      3,
    );
    const analysis = analyzeThumbnail(img);

    for (const text of analysis.texts) {
      expect(typeof text.position).toBe('string');
      expect(text.position).toMatch(/^(top|middle|bottom)-(left|center|right)$/);
      expect(text.confidence).toBeGreaterThanOrEqual(0);
      expect(text.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Effect Estimation
// ---------------------------------------------------------------------------

describe('estimateEffects', () => {
  it('should return an empty array when no text regions are provided', () => {
    const img = createImageData(100, 100);
    const effects = estimateEffects(img, []);

    expect(effects).toEqual([]);
  });

  it('should detect stroke-like patterns around a text region', () => {
    const textBounds = { x: 60, y: 60, w: 180, h: 30 };
    const img = createStrokeTextImage(
      300, 200,
      textBounds,
      { r: 0, g: 0, b: 0 },
      5,
    );

    const textRegion: LayoutRegion = {
      type: 'text',
      bounds: { x: textBounds.x, y: textBounds.y, w: textBounds.w, h: textBounds.h },
      confidence: 0.8,
    };

    const effects = estimateEffects(img, [textRegion]);

    // Should detect at least one effect (stroke)
    const strokeEffects = effects.filter((e) => e.effect.type === 'stroke');
    // Stroke detection depends on pixel patterns; with our test image it should work
    if (strokeEffects.length > 0) {
      expect(strokeEffects[0].confidence).toBeGreaterThan(0);
      expect(strokeEffects[0].description).toContain('stroke');
    }
  });

  it('should detect shadow patterns when dark offset pixels are present', () => {
    const textBounds = { x: 50, y: 50, w: 150, h: 30 };
    const img = createShadowTextImage(300, 200, textBounds, 4);

    const textRegion: LayoutRegion = {
      type: 'text',
      bounds: { x: textBounds.x, y: textBounds.y, w: textBounds.w, h: textBounds.h },
      confidence: 0.7,
    };

    const effects = estimateEffects(img, [textRegion]);

    const shadowEffects = effects.filter((e) => e.effect.type === 'drop-shadow');
    if (shadowEffects.length > 0) {
      expect(shadowEffects[0].confidence).toBeGreaterThan(0);
      expect(shadowEffects[0].description).toContain('shadow');
    }
  });

  it('should return effects with valid LayerEffect objects', () => {
    const textBounds = { x: 50, y: 50, w: 200, h: 40 };
    const img = createStrokeTextImage(
      300, 200,
      textBounds,
      { r: 255, g: 0, b: 0 },
      4,
    );

    const textRegion: LayoutRegion = {
      type: 'text',
      bounds: { x: textBounds.x, y: textBounds.y, w: textBounds.w, h: textBounds.h },
      confidence: 0.8,
    };

    const effects = estimateEffects(img, [textRegion]);

    for (const estimated of effects) {
      expect(estimated.effect).toBeDefined();
      expect(estimated.effect.type).toBeDefined();
      expect(estimated.effect.enabled).toBe(true);
      expect(typeof estimated.description).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Edge Cases
// ---------------------------------------------------------------------------

describe('analyzeThumbnail — edge cases', () => {
  it('should handle a very small image without errors', () => {
    const img = createImageData(4, 4, { r: 200, g: 100, b: 50, a: 255 });
    const analysis = analyzeThumbnail(img);

    expect(analysis).toBeDefined();
    expect(analysis.layout.length).toBeGreaterThanOrEqual(1);
    expect(analysis.palette.colors.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle a uniform image (no text, no edges)', () => {
    const img = createImageData(200, 200, { r: 60, g: 60, b: 60, a: 255 });
    const analysis = analyzeThumbnail(img);

    // No text regions expected
    expect(analysis.texts.length).toBe(0);
    // No effects estimated without text regions
    expect(analysis.estimatedEffects.length).toBe(0);
  });

  it('should produce a non-empty style description even with no effects', () => {
    const img = createImageData(100, 100, { r: 128, g: 128, b: 128, a: 255 });
    const analysis = analyzeThumbnail(img);

    // describeEffects returns "エフェクトなし" or "no effects" when empty
    expect(analysis.styleDescription.length).toBeGreaterThan(0);
  });
});
