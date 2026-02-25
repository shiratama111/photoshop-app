/**
 * @module ai/batch-generator.test
 * Tests for the batch thumbnail variation generator (BATCH-001).
 *
 * Covers:
 * - Batch generation with default and custom options
 * - Style variation application (Bold, Minimal, Colorful, Dark, Classic)
 * - Variation count clamping and style cycling
 * - Error handling for invalid inputs
 * - Utility functions (getAvailableStyles, getStyleByName)
 *
 * @see BATCH-001: AI画像生成統合・バッチ生成
 * @see {@link ./batch-generator.ts} — module under test
 */

import { describe, it, expect } from 'vitest';
import {
  generateBatch,
  getAvailableStyles,
  getStyleByName,
  STYLE_VARIATIONS,
} from './batch-generator';
import type {
  BatchOptions,
  BatchResult,
} from './batch-generator';
import type { ThumbnailDesign, TextLayerDesign } from './design-schema';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Create a basic batch options object for testing. */
function createTestOptions(overrides?: Partial<BatchOptions>): BatchOptions {
  return {
    instruction: '衝撃的なニュース系サムネ、タイトル「AIが弁護士を超えた日」',
    ...overrides,
  };
}

/** Find all text layers in a design. */
function getTextLayers(design: ThumbnailDesign): TextLayerDesign[] {
  return design.layers.filter((l): l is TextLayerDesign => l.kind === 'text');
}

/** Assert that a batch result is successful with the expected number of variations. */
function assertSuccessfulBatch(result: BatchResult, expectedCount: number): void {
  expect(result.success).toBe(true);
  expect(result.error).toBeUndefined();
  expect(result.variations).toHaveLength(expectedCount);

  for (const v of result.variations) {
    expect(v.design).toBeDefined();
    expect(v.actions.length).toBeGreaterThan(0);
    expect(v.styleName).toBeTruthy();
  }
}

// ---------------------------------------------------------------------------
// Basic Batch Generation Tests
// ---------------------------------------------------------------------------

describe('generateBatch', () => {
  it('generates the default 3 variations from a Japanese instruction', () => {
    const result = generateBatch(createTestOptions());
    assertSuccessfulBatch(result, 3);
  });

  it('generates the requested number of variations', () => {
    const result = generateBatch(createTestOptions({ variationCount: 5 }));
    assertSuccessfulBatch(result, 5);
  });

  it('generates exactly 1 variation when variationCount is 1', () => {
    const result = generateBatch(createTestOptions({ variationCount: 1 }));
    assertSuccessfulBatch(result, 1);
  });

  it('clamps variationCount to maximum of 10', () => {
    const result = generateBatch(createTestOptions({ variationCount: 20 }));
    assertSuccessfulBatch(result, 10);
  });

  it('clamps variationCount to minimum of 1', () => {
    const result = generateBatch(createTestOptions({ variationCount: 0 }));
    assertSuccessfulBatch(result, 1);
  });

  it('each variation has a unique style name when count <= available styles', () => {
    const result = generateBatch(createTestOptions({ variationCount: 5 }));
    assertSuccessfulBatch(result, 5);

    const names = result.variations.map((v) => v.styleName);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(5);
  });

  it('cycles styles when variationCount exceeds available styles', () => {
    const result = generateBatch(createTestOptions({ variationCount: 7 }));
    assertSuccessfulBatch(result, 7);

    // Should have cycled back
    expect(result.variations[5].styleName).toBe(result.variations[0].styleName);
    expect(result.variations[6].styleName).toBe(result.variations[1].styleName);
  });

  it('each variation has valid canvas dimensions', () => {
    const result = generateBatch(createTestOptions());

    for (const v of result.variations) {
      expect(v.design.canvas.width).toBeGreaterThan(0);
      expect(v.design.canvas.height).toBeGreaterThan(0);
    }
  });

  it('each variation has at least one layer', () => {
    const result = generateBatch(createTestOptions());

    for (const v of result.variations) {
      expect(v.design.layers.length).toBeGreaterThan(0);
    }
  });

  it('each variation produces valid editor actions', () => {
    const result = generateBatch(createTestOptions());

    for (const v of result.variations) {
      expect(Array.isArray(v.actions)).toBe(true);
      // Should at least have a background action
      const hasBg = v.actions.some(
        (a) => a.type === 'addGradientBackground' || a.type === 'addPattern',
      );
      expect(hasBg).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Custom Style Selection Tests
// ---------------------------------------------------------------------------

describe('generateBatch with explicit styles', () => {
  it('uses only the specified styles', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 2,
      styles: ['Dark', 'Minimal'],
    }));

    assertSuccessfulBatch(result, 2);
    expect(result.variations[0].styleName).toBe('Dark');
    expect(result.variations[1].styleName).toBe('Minimal');
  });

  it('cycles explicit styles when count exceeds styles length', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 4,
      styles: ['Bold', 'Dark'],
    }));

    assertSuccessfulBatch(result, 4);
    expect(result.variations[0].styleName).toBe('Bold');
    expect(result.variations[1].styleName).toBe('Dark');
    expect(result.variations[2].styleName).toBe('Bold');
    expect(result.variations[3].styleName).toBe('Dark');
  });

  it('handles a single explicit style', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 3,
      styles: ['Colorful'],
    }));

    assertSuccessfulBatch(result, 3);
    for (const v of result.variations) {
      expect(v.styleName).toBe('Colorful');
    }
  });
});

// ---------------------------------------------------------------------------
// Platform and Canvas Tests
// ---------------------------------------------------------------------------

describe('generateBatch with platform options', () => {
  it('respects custom canvas size', () => {
    const result = generateBatch(createTestOptions({
      canvasSize: { width: 1920, height: 1080 },
    }));

    assertSuccessfulBatch(result, 3);
    for (const v of result.variations) {
      expect(v.design.canvas.width).toBe(1920);
      expect(v.design.canvas.height).toBe(1080);
    }
  });

  it('respects instagram platform', () => {
    const result = generateBatch(createTestOptions({
      platform: 'instagram',
    }));

    assertSuccessfulBatch(result, 3);
    for (const v of result.variations) {
      expect(v.design.canvas.width).toBe(1080);
      expect(v.design.canvas.height).toBe(1080);
    }
  });

  it('respects category override', () => {
    const result = generateBatch(createTestOptions({
      category: 'howto',
    }));

    assertSuccessfulBatch(result, 3);
    for (const v of result.variations) {
      expect(v.design.metadata.category).toBe('howto');
    }
  });
});

// ---------------------------------------------------------------------------
// Style Variation Effect Tests
// ---------------------------------------------------------------------------

describe('style variation: Bold', () => {
  it('increases font sizes', () => {
    const resultDefault = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Minimal'], // Use Minimal as baseline (slightly reduced)
    }));
    const resultBold = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Bold'],
    }));

    const minimalLayers = getTextLayers(resultDefault.variations[0].design);
    const boldLayers = getTextLayers(resultBold.variations[0].design);

    // Bold should have larger font sizes than Minimal
    for (let i = 0; i < Math.min(minimalLayers.length, boldLayers.length); i++) {
      expect(boldLayers[i].fontSize).toBeGreaterThan(minimalLayers[i].fontSize);
    }
  });

  it('forces bold on all text layers', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Bold'],
    }));

    const textLayers = getTextLayers(result.variations[0].design);
    for (const layer of textLayers) {
      expect(layer.bold).toBe(true);
    }
  });
});

describe('style variation: Minimal', () => {
  it('uses solid background', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Minimal'],
    }));

    expect(result.variations[0].design.background.type).toBe('solid');
  });

  it('removes shape layers', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Minimal'],
    }));

    const shapeLayers = result.variations[0].design.layers.filter((l) => l.kind === 'shape');
    expect(shapeLayers).toHaveLength(0);
  });
});

describe('style variation: Dark', () => {
  it('applies dark background', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Dark'],
    }));

    const bg = result.variations[0].design.background;
    expect(bg.type).toBe('gradient');
    if (bg.type === 'gradient') {
      // First stop should be dark
      const firstStop = bg.stops[0];
      const brightness = firstStop.color.r + firstStop.color.g + firstStop.color.b;
      expect(brightness).toBeLessThan(150); // Dark colors
    }
  });

  it('makes text white for contrast', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Dark'],
    }));

    const textLayers = getTextLayers(result.variations[0].design);
    for (const layer of textLayers) {
      expect(layer.color.r).toBe(255);
      expect(layer.color.g).toBe(255);
      expect(layer.color.b).toBe(255);
    }
  });
});

describe('style variation: Classic', () => {
  it('uses serif font family', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Classic'],
    }));

    const textLayers = getTextLayers(result.variations[0].design);
    for (const layer of textLayers) {
      expect(layer.fontFamily).toContain('Serif');
    }
  });

  it('applies warm background tones', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Classic'],
    }));

    const bg = result.variations[0].design.background;
    expect(bg.type).toBe('gradient');
    if (bg.type === 'gradient') {
      // First stop should be warm/beige
      const firstStop = bg.stops[0];
      expect(firstStop.color.r).toBeGreaterThan(200);
      expect(firstStop.color.g).toBeGreaterThan(200);
    }
  });
});

describe('style variation: Colorful', () => {
  it('applies vibrant text colors', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 1,
      styles: ['Colorful'],
    }));

    const textLayers = getTextLayers(result.variations[0].design);
    // At least one text layer should have a vibrant (high-saturation) color
    const hasVibrant = textLayers.some((layer) => {
      const max = Math.max(layer.color.r, layer.color.g, layer.color.b);
      const min = Math.min(layer.color.r, layer.color.g, layer.color.b);
      return (max - min) > 100; // High saturation difference
    });
    expect(hasVibrant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error Handling Tests
// ---------------------------------------------------------------------------

describe('generateBatch error handling', () => {
  it('returns error for empty instruction', () => {
    const result = generateBatch({ instruction: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Instruction is required');
    expect(result.variations).toHaveLength(0);
  });

  it('returns error for whitespace-only instruction', () => {
    const result = generateBatch({ instruction: '   ' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Instruction is required');
  });

  it('returns empty variations on error', () => {
    const result = generateBatch({ instruction: '' });

    expect(result.variations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Immutability Tests
// ---------------------------------------------------------------------------

describe('generateBatch immutability', () => {
  it('does not share object references between variations', () => {
    const result = generateBatch(createTestOptions({ variationCount: 3 }));

    for (let i = 0; i < result.variations.length; i++) {
      for (let j = i + 1; j < result.variations.length; j++) {
        // Designs should be separate objects
        expect(result.variations[i].design).not.toBe(result.variations[j].design);
        expect(result.variations[i].design.layers).not.toBe(result.variations[j].design.layers);
      }
    }
  });

  it('produces different designs for different styles', () => {
    const result = generateBatch(createTestOptions({
      variationCount: 5,
      styles: ['Bold', 'Minimal', 'Colorful', 'Dark', 'Classic'],
    }));

    assertSuccessfulBatch(result, 5);

    // Convert designs to JSON for comparison
    const jsons = result.variations.map((v) => JSON.stringify(v.design));
    const uniqueJsons = new Set(jsons);
    // All 5 should be unique
    expect(uniqueJsons.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Utility Function Tests
// ---------------------------------------------------------------------------

describe('getAvailableStyles', () => {
  it('returns all style names', () => {
    const styles = getAvailableStyles();

    expect(styles).toContain('Bold');
    expect(styles).toContain('Minimal');
    expect(styles).toContain('Colorful');
    expect(styles).toContain('Dark');
    expect(styles).toContain('Classic');
    expect(styles.length).toBe(STYLE_VARIATIONS.length);
  });

  it('returns an array of strings', () => {
    const styles = getAvailableStyles();

    for (const name of styles) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe('getStyleByName', () => {
  it('finds a style by exact name', () => {
    const style = getStyleByName('Bold');

    expect(style).toBeDefined();
    expect(style!.name).toBe('Bold');
  });

  it('finds a style case-insensitively', () => {
    const style = getStyleByName('bold');

    expect(style).toBeDefined();
    expect(style!.name).toBe('Bold');
  });

  it('returns undefined for unknown style name', () => {
    const style = getStyleByName('NonExistentStyle');

    expect(style).toBeUndefined();
  });

  it('returns style with all required properties', () => {
    const style = getStyleByName('Minimal');

    expect(style).toBeDefined();
    expect(style!.name).toBeTruthy();
    expect(style!.labelJa).toBeTruthy();
    expect(style!.labelEn).toBeTruthy();
    expect(style!.description).toBeTruthy();
    expect(typeof style!.transform).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// STYLE_VARIATIONS Constant Tests
// ---------------------------------------------------------------------------

describe('STYLE_VARIATIONS', () => {
  it('contains at least 5 variations', () => {
    expect(STYLE_VARIATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('each variation has a unique name', () => {
    const names = STYLE_VARIATIONS.map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(STYLE_VARIATIONS.length);
  });

  it('each variation has Japanese and English labels', () => {
    for (const style of STYLE_VARIATIONS) {
      expect(style.labelJa.length).toBeGreaterThan(0);
      expect(style.labelEn.length).toBeGreaterThan(0);
    }
  });

  it('each variation has a transform function', () => {
    for (const style of STYLE_VARIATIONS) {
      expect(typeof style.transform).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('batch generation integration', () => {
  it('handles a how-to instruction', () => {
    const result = generateBatch({
      instruction: 'Photoshopの使い方チュートリアル、タイトル「初心者向けガイド」',
      variationCount: 3,
    });

    assertSuccessfulBatch(result, 3);
  });

  it('handles an English gaming instruction', () => {
    const result = generateBatch({
      instruction: 'Gaming thumbnail, title: "Epic Win Compilation"',
      variationCount: 3,
    });

    assertSuccessfulBatch(result, 3);
  });

  it('handles product review instruction with all styles', () => {
    const result = generateBatch({
      instruction: '商品レビューサムネイル、タイトル「最新iPhone徹底レビュー」',
      variationCount: 5,
      styles: ['Bold', 'Minimal', 'Colorful', 'Dark', 'Classic'],
    });

    assertSuccessfulBatch(result, 5);
    const styleNames = result.variations.map((v) => v.styleName);
    expect(styleNames).toEqual(['Bold', 'Minimal', 'Colorful', 'Dark', 'Classic']);
  });

  it('generates consistent results for the same input', () => {
    const options = createTestOptions({ variationCount: 3 });
    const result1 = generateBatch(options);
    const result2 = generateBatch(options);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.variations.length).toBe(result2.variations.length);

    for (let i = 0; i < result1.variations.length; i++) {
      expect(result1.variations[i].styleName).toBe(result2.variations[i].styleName);
      expect(result1.variations[i].design.canvas).toEqual(result2.variations[i].design.canvas);
    }
  });
});
