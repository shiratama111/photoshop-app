/**
 * @module ai/style-transfer.test
 * Tests for the style transfer engine.
 *
 * Test coverage:
 * - transferStyle() — full pipeline (analysis -> design + actions + similarity)
 * - analysisToDesign() — analysis structure -> design blueprint conversion
 * - replaceText() — text replacement preserving style properties
 * - scoreSimilarity() — similarity scoring (layout, color, effects)
 * - Edge cases: empty analysis, no text regions, no effects, canvas scaling
 * - Color palette override support
 *
 * @see TRANSFER-001: Style Transfer Engine
 * @see {@link ./style-transfer.ts}
 */

import { describe, it, expect } from 'vitest';
import {
  transferStyle,
  analysisToDesign,
  replaceText,
  scoreSimilarity,
} from './style-transfer';
import type {
  StyleTransferOptions,
  SimilarityScore,
  StyleTransferResult,
} from './style-transfer';
import type { ThumbnailAnalysis, EstimatedEffect, TextRegionInfo } from './thumbnail-analyzer';
import type { ColorPalette, PaletteColor } from './color-palette';
import type { TextLayerDesign } from './design-schema';
import type { LayoutRegion } from '../../../../ai/src/layout-detector';
import type { StrokeEffect, DropShadowEffect } from '@photoshop-app/types';

// ---------------------------------------------------------------------------
// Helpers: Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create a minimal valid PaletteColor.
 */
function createPaletteColor(
  r: number,
  g: number,
  b: number,
  role: 'background' | 'accent' | 'text',
  frequency = 0.5,
): PaletteColor {
  return { r, g, b, frequency, role };
}

/**
 * Create a minimal valid ColorPalette.
 */
function createPalette(overrides?: Partial<ColorPalette>): ColorPalette {
  const bg = createPaletteColor(30, 30, 30, 'background', 0.6);
  const accent = createPaletteColor(255, 50, 50, 'accent', 0.2);
  const text = createPaletteColor(255, 255, 255, 'text', 0.2);
  return {
    dominant: bg,
    colors: [bg, accent, text],
    contrastRatio: 15,
    ...overrides,
  };
}

/**
 * Create a text region info for testing.
 */
function createTextRegion(
  x: number,
  y: number,
  w: number,
  h: number,
  position: string,
  confidence = 0.8,
): TextRegionInfo {
  return {
    bounds: { x, y, w, h },
    position,
    confidence,
  };
}

/**
 * Create a layout region for testing.
 */
function createLayoutRegion(
  type: 'text' | 'image' | 'background',
  x: number,
  y: number,
  w: number,
  h: number,
  confidence = 0.8,
): LayoutRegion {
  return {
    type,
    bounds: { x, y, w, h },
    confidence,
  };
}

/**
 * Create a stroke EstimatedEffect for testing.
 */
function createStrokeEffect(confidence = 0.7): EstimatedEffect {
  const strokeEffect: StrokeEffect = {
    type: 'stroke',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 1 },
    size: 3,
    position: 'outside',
    opacity: 1,
  };
  return {
    effect: strokeEffect,
    confidence,
    description: 'Detected stroke/outline (~3px)',
  };
}

/**
 * Create a drop shadow EstimatedEffect for testing.
 */
function createShadowEffect(confidence = 0.6): EstimatedEffect {
  const shadowEffect: DropShadowEffect = {
    type: 'drop-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 0.75 },
    opacity: 0.75,
    angle: 135,
    distance: 4,
    blur: 6,
    spread: 0,
  };
  return {
    effect: shadowEffect,
    confidence,
    description: 'Detected drop shadow pattern',
  };
}

/**
 * Create a minimal valid ThumbnailAnalysis for testing.
 */
function createAnalysis(overrides?: Partial<ThumbnailAnalysis>): ThumbnailAnalysis {
  const layout: LayoutRegion[] = [
    createLayoutRegion('background', 0, 0, 1280, 720),
    createLayoutRegion('text', 100, 50, 600, 80),
    createLayoutRegion('text', 100, 200, 400, 50),
    createLayoutRegion('image', 700, 100, 400, 500),
  ];
  const texts: TextRegionInfo[] = [
    createTextRegion(100, 50, 600, 80, 'top-left'),
    createTextRegion(100, 200, 400, 50, 'middle-left'),
  ];
  const palette = createPalette();
  const estimatedEffects = [createStrokeEffect(), createShadowEffect()];

  return {
    layout,
    texts,
    palette,
    estimatedEffects,
    styleDescription: 'Dark background with white outlined text and drop shadow.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. transferStyle — Full Pipeline
// ---------------------------------------------------------------------------

describe('transferStyle — full pipeline', () => {
  it('should return a StyleTransferResult with design, actions, and similarity', () => {
    const analysis = createAnalysis();
    const options: StyleTransferOptions = { analysis };

    const result: StyleTransferResult = transferStyle(options);

    expect(result.design).toBeDefined();
    expect(result.design.canvas).toBeDefined();
    expect(result.design.background).toBeDefined();
    expect(result.design.layers).toBeDefined();
    expect(result.design.metadata).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.similarity).toBeDefined();
    expect(typeof result.similarity.overall).toBe('number');
  });

  it('should use default canvas size 1280x720 when not specified', () => {
    const analysis = createAnalysis();
    const result = transferStyle({ analysis });

    expect(result.design.canvas.width).toBe(1280);
    expect(result.design.canvas.height).toBe(720);
  });

  it('should use specified targetCanvas dimensions', () => {
    const analysis = createAnalysis();
    const result = transferStyle({
      analysis,
      targetCanvas: { width: 1920, height: 1080 },
    });

    expect(result.design.canvas.width).toBe(1920);
    expect(result.design.canvas.height).toBe(1080);
  });

  it('should replace title text when newTitle is provided', () => {
    const analysis = createAnalysis();
    const result = transferStyle({
      analysis,
      newTitle: 'Custom Headline',
    });

    const titleLayer = result.design.layers.find(
      (l) => l.kind === 'text' && l.name.toLowerCase().includes('title') &&
        !l.name.toLowerCase().includes('sub'),
    ) as TextLayerDesign | undefined;

    expect(titleLayer).toBeDefined();
    expect(titleLayer?.text).toBe('Custom Headline');
  });

  it('should replace subtitle text when newSubtitle is provided', () => {
    const analysis = createAnalysis();
    const result = transferStyle({
      analysis,
      newTitle: 'Main Title',
      newSubtitle: 'Custom Sub',
    });

    const subLayer = result.design.layers.find(
      (l) => l.kind === 'text' && l.name.toLowerCase().includes('sub'),
    ) as TextLayerDesign | undefined;

    expect(subLayer).toBeDefined();
    expect(subLayer?.text).toBe('Custom Sub');
  });

  it('should apply colorOverride to the design palette', () => {
    const analysis = createAnalysis();
    const overrideDominant = createPaletteColor(0, 100, 200, 'background', 0.7);
    const result = transferStyle({
      analysis,
      colorOverride: {
        dominant: overrideDominant,
      },
    });

    // The background gradient should use the overridden dominant color
    if (result.design.background.type === 'gradient') {
      const firstStop = result.design.background.stops[0];
      expect(firstStop.color.r).toBe(0);
      expect(firstStop.color.g).toBe(100);
      expect(firstStop.color.b).toBe(200);
    }
  });

  it('should generate EditorActions from the design', () => {
    const analysis = createAnalysis();
    const result = transferStyle({ analysis });

    // Should have at least a background action and text layer actions
    const bgActions = result.actions.filter((a) => a.type === 'addGradientBackground');
    const textActions = result.actions.filter((a) => a.type === 'createTextLayer');

    expect(bgActions.length).toBeGreaterThanOrEqual(1);
    expect(textActions.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 2. analysisToDesign — Core Conversion
// ---------------------------------------------------------------------------

describe('analysisToDesign — analysis to design conversion', () => {
  it('should create a gradient background from the palette dominant color', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    expect(design.background.type).toBe('gradient');
    if (design.background.type === 'gradient') {
      expect(design.background.stops.length).toBe(2);
      // First stop should match dominant color
      expect(design.background.stops[0].color.r).toBe(30);
      expect(design.background.stops[0].color.g).toBe(30);
      expect(design.background.stops[0].color.b).toBe(30);
    }
  });

  it('should create text layers from detected text regions', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const textLayers = design.layers.filter((l) => l.kind === 'text');
    // Should have at least 2 text layers (title + subtitle)
    expect(textLayers.length).toBeGreaterThanOrEqual(2);
  });

  it('should create image placeholder layers from image regions', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const imageLayers = design.layers.filter((l) => l.kind === 'image');
    expect(imageLayers.length).toBeGreaterThanOrEqual(1);
  });

  it('should use text color from palette for text layers', () => {
    const palette = createPalette({
      colors: [
        createPaletteColor(0, 0, 0, 'background', 0.6),
        createPaletteColor(255, 200, 0, 'accent', 0.2),
        createPaletteColor(200, 220, 255, 'text', 0.2),
      ],
    });
    const analysis = createAnalysis({ palette });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 }, palette);

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    // Text layer color should match the 'text' role color
    expect(textLayers[0].color.r).toBe(200);
    expect(textLayers[0].color.g).toBe(220);
    expect(textLayers[0].color.b).toBe(255);
  });

  it('should apply estimated effects to text layers', () => {
    const analysis = createAnalysis({
      estimatedEffects: [createStrokeEffect(0.8)],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    // Should have at least one effect (the stroke)
    expect(textLayers[0].effects.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter out low-confidence effects', () => {
    const analysis = createAnalysis({
      estimatedEffects: [createStrokeEffect(0.2)], // below 0.3 threshold
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    expect(textLayers[0].effects.length).toBe(0);
  });

  it('should scale positions when target canvas differs from source', () => {
    // Source analysis has text at x=100 in a ~1280px wide layout
    const analysis = createAnalysis();
    // Target canvas is 2560px wide (2x source)
    const design = analysisToDesign(analysis, { width: 2560, height: 1440 });

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    // The text position should be roughly doubled from the source
    // Source x=100 with source width ~1280 -> ratio ~0.078 -> 2560*0.078 = ~200
    expect(textLayers[0].x).toBeGreaterThan(100);
  });

  it('should set metadata with category "style-transfer"', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    expect(design.metadata.category).toBe('style-transfer');
    expect(design.metadata.targetPlatform).toBe('youtube');
  });

  it('should create a default title layer when no text regions are detected', () => {
    const analysis = createAnalysis({
      texts: [],
      layout: [createLayoutRegion('background', 0, 0, 1280, 720)],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBe(1);
    expect(textLayers[0].name).toBe('Title');
  });

  it('should set alignment based on text region position', () => {
    const analysis = createAnalysis({
      texts: [
        createTextRegion(50, 50, 200, 60, 'top-left'),
        createTextRegion(500, 300, 200, 40, 'middle-center'),
        createTextRegion(900, 500, 200, 40, 'bottom-right'),
      ],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBe(3);
    expect(textLayers[0].alignment).toBe('left');
    expect(textLayers[1].alignment).toBe('center');
    expect(textLayers[2].alignment).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// 3. replaceText — Text Replacement
// ---------------------------------------------------------------------------

describe('replaceText — text content replacement', () => {
  it('should replace title text in title layers', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const updated = replaceText(design, 'New Title');

    const titleLayer = updated.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign;

    expect(titleLayer.text).toBe('New Title');
  });

  it('should replace subtitle text in subtitle layers', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const updated = replaceText(design, undefined, 'New Sub');

    const subLayer = updated.layers.find(
      (l) => l.kind === 'text' && l.name.toLowerCase().includes('sub'),
    ) as TextLayerDesign | undefined;

    if (subLayer) {
      expect(subLayer.text).toBe('New Sub');
    }
  });

  it('should preserve style properties (fontSize, color, effects) when replacing text', () => {
    const analysis = createAnalysis({
      estimatedEffects: [createStrokeEffect(0.8)],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const originalTitle = design.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign;
    const originalFontSize = originalTitle.fontSize;
    const originalColor = { ...originalTitle.color };
    const originalEffectCount = originalTitle.effects.length;

    const updated = replaceText(design, 'Replaced Title');
    const updatedTitle = updated.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign;

    expect(updatedTitle.text).toBe('Replaced Title');
    expect(updatedTitle.fontSize).toBe(originalFontSize);
    expect(updatedTitle.color.r).toBe(originalColor.r);
    expect(updatedTitle.color.g).toBe(originalColor.g);
    expect(updatedTitle.color.b).toBe(originalColor.b);
    expect(updatedTitle.effects.length).toBe(originalEffectCount);
  });

  it('should not mutate the original design', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const originalTitle = (design.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign).text;

    replaceText(design, 'Changed Title');

    const stillOriginalTitle = (design.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign).text;

    expect(stillOriginalTitle).toBe(originalTitle);
  });

  it('should keep existing text when replacement is undefined', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const originalTitle = (design.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign).text;

    const updated = replaceText(design, undefined, undefined);
    const updatedTitle = (updated.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign).text;

    expect(updatedTitle).toBe(originalTitle);
  });

  it('should handle empty string replacement', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const updated = replaceText(design, '');

    const titleLayer = updated.layers.find(
      (l) => l.kind === 'text' && l.name === 'Title',
    ) as TextLayerDesign;

    expect(titleLayer.text).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 4. scoreSimilarity — Similarity Scoring
// ---------------------------------------------------------------------------

describe('scoreSimilarity — similarity scoring', () => {
  it('should return all score components between 0 and 1', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const score: SimilarityScore = scoreSimilarity(analysis, design);

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
    expect(score.layout).toBeGreaterThanOrEqual(0);
    expect(score.layout).toBeLessThanOrEqual(1);
    expect(score.color).toBeGreaterThanOrEqual(0);
    expect(score.color).toBeLessThanOrEqual(1);
    expect(score.effects).toBeGreaterThanOrEqual(0);
    expect(score.effects).toBeLessThanOrEqual(1);
  });

  it('should have high similarity when design is generated from the same analysis', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const score = scoreSimilarity(analysis, design);

    // Self-comparison should be fairly high
    expect(score.overall).toBeGreaterThan(0.5);
    expect(score.color).toBeGreaterThan(0.5);
  });

  it('should have high effect similarity when all effect types match', () => {
    const analysis = createAnalysis({
      estimatedEffects: [createStrokeEffect(0.8), createShadowEffect(0.7)],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const score = scoreSimilarity(analysis, design);

    // Both stroke and shadow should be present -> high effect score
    expect(score.effects).toBeGreaterThan(0.5);
  });

  it('should return effects=1 when both analysis and design have no effects', () => {
    const analysis = createAnalysis({ estimatedEffects: [] });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const score = scoreSimilarity(analysis, design);

    expect(score.effects).toBe(1);
  });

  it('should have lower color similarity with a very different palette', () => {
    const analysis = createAnalysis({
      palette: createPalette({
        dominant: createPaletteColor(255, 0, 0, 'background', 0.6),
        colors: [
          createPaletteColor(255, 0, 0, 'background', 0.6),
          createPaletteColor(0, 255, 0, 'accent', 0.2),
          createPaletteColor(0, 0, 255, 'text', 0.2),
        ],
      }),
    });
    // Design with the same analysis
    const designFromAnalysis = analysisToDesign(analysis, { width: 1280, height: 720 });
    const scoreMatching = scoreSimilarity(analysis, designFromAnalysis);

    // Now compare with a design using a totally different palette
    const differentPalette = createPalette({
      dominant: createPaletteColor(0, 0, 0, 'background', 0.6),
      colors: [
        createPaletteColor(0, 0, 0, 'background', 0.6),
        createPaletteColor(128, 128, 128, 'accent', 0.2),
        createPaletteColor(64, 64, 64, 'text', 0.2),
      ],
    });
    const differentDesign = analysisToDesign(analysis, { width: 1280, height: 720 }, differentPalette);
    const scoreDifferent = scoreSimilarity(analysis, differentDesign);

    // The matching design should have higher color similarity
    expect(scoreMatching.color).toBeGreaterThanOrEqual(scoreDifferent.color);
  });

  it('should handle analysis with no text regions', () => {
    const analysis = createAnalysis({
      texts: [],
      layout: [createLayoutRegion('background', 0, 0, 1280, 720)],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const score = scoreSimilarity(analysis, design);

    // Should still produce valid scores
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
    // Layout: 0 texts vs 1 default title layer -> 0.5 special case
    expect(score.layout).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Edge Cases
// ---------------------------------------------------------------------------

describe('style transfer — edge cases', () => {
  it('should handle empty layout (only background)', () => {
    const analysis = createAnalysis({
      layout: [createLayoutRegion('background', 0, 0, 800, 600)],
      texts: [],
      estimatedEffects: [],
    });

    const result = transferStyle({ analysis });

    expect(result.design).toBeDefined();
    expect(result.design.layers.length).toBeGreaterThanOrEqual(1); // default title
    expect(result.similarity.overall).toBeGreaterThanOrEqual(0);
  });

  it('should handle analysis with a single text region', () => {
    const analysis = createAnalysis({
      texts: [createTextRegion(100, 100, 500, 60, 'middle-center')],
      layout: [
        createLayoutRegion('background', 0, 0, 1280, 720),
        createLayoutRegion('text', 100, 100, 500, 60),
      ],
    });

    const result = transferStyle({ analysis, newTitle: 'Solo Title' });

    const textLayers = result.design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBe(1);
    expect(textLayers[0].text).toBe('Solo Title');
  });

  it('should handle very small canvas target', () => {
    const analysis = createAnalysis();
    const result = transferStyle({
      analysis,
      targetCanvas: { width: 100, height: 56 },
    });

    expect(result.design.canvas.width).toBe(100);
    expect(result.design.canvas.height).toBe(56);
    // Positions should be scaled down
    const textLayers = result.design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    expect(textLayers[0].x).toBeLessThan(100);
  });

  it('should produce a valid design when all effects have low confidence', () => {
    const analysis = createAnalysis({
      estimatedEffects: [createStrokeEffect(0.1), createShadowEffect(0.05)],
    });
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });
    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];

    // Low confidence effects should be filtered out
    expect(textLayers.length).toBeGreaterThan(0);
    expect(textLayers[0].effects.length).toBe(0);
  });

  it('should handle palette with only one color', () => {
    const singleColor = createPaletteColor(128, 128, 128, 'background', 1);
    const palette: ColorPalette = {
      dominant: singleColor,
      colors: [singleColor],
      contrastRatio: 1,
    };
    const analysis = createAnalysis({ palette });

    const result = transferStyle({ analysis });
    expect(result.design.background.type).toBe('gradient');
    // Text color should fall back to dominant
    const textLayers = result.design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    expect(textLayers[0].color.r).toBe(128);
  });

  it('should set correct metadata mood based on palette brightness', () => {
    // Dark palette
    const darkPalette = createPalette({
      dominant: createPaletteColor(10, 10, 10, 'background', 0.8),
    });
    const darkAnalysis = createAnalysis({ palette: darkPalette });
    const darkDesign = analysisToDesign(darkAnalysis, { width: 1280, height: 720 }, darkPalette);
    expect(darkDesign.metadata.mood).toBe('dark');

    // Bright palette
    const brightPalette = createPalette({
      dominant: createPaletteColor(230, 230, 230, 'background', 0.8),
    });
    const brightAnalysis = createAnalysis({ palette: brightPalette });
    const brightDesign = analysisToDesign(brightAnalysis, { width: 1280, height: 720 }, brightPalette);
    expect(brightDesign.metadata.mood).toBe('bright');
  });

  it('should produce correct title layer as bold and subtitle as non-bold', () => {
    const analysis = createAnalysis();
    const design = analysisToDesign(analysis, { width: 1280, height: 720 });

    const textLayers = design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    // First text layer (title) should be bold
    expect(textLayers[0].bold).toBe(true);
    // Second text layer (subtitle) should not be bold
    if (textLayers.length > 1) {
      expect(textLayers[1].bold).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Color Palette Override
// ---------------------------------------------------------------------------

describe('style transfer — color palette override', () => {
  it('should merge partial color override into the palette', () => {
    const analysis = createAnalysis();
    const overriddenDominant = createPaletteColor(0, 200, 100, 'background', 0.7);

    const result = transferStyle({
      analysis,
      colorOverride: { dominant: overriddenDominant },
    });

    if (result.design.background.type === 'gradient') {
      expect(result.design.background.stops[0].color.r).toBe(0);
      expect(result.design.background.stops[0].color.g).toBe(200);
      expect(result.design.background.stops[0].color.b).toBe(100);
    }
  });

  it('should use original palette colors when override does not cover them', () => {
    const analysis = createAnalysis();
    // Override only contrastRatio, not colors
    const result = transferStyle({
      analysis,
      colorOverride: { contrastRatio: 20 },
    });

    // Text color should still be the original white
    const textLayers = result.design.layers.filter((l) => l.kind === 'text') as TextLayerDesign[];
    expect(textLayers.length).toBeGreaterThan(0);
    expect(textLayers[0].color.r).toBe(255);
    expect(textLayers[0].color.g).toBe(255);
    expect(textLayers[0].color.b).toBe(255);
  });
});
