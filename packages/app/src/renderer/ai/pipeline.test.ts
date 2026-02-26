/**
 * @module ai/pipeline.test
 * Tests for the E2E thumbnail generation pipeline (PIPE-001).
 *
 * Covers:
 * - Full pipeline: instruction -> design + actions
 * - Font recommendation application
 * - Refinement (iterative modification)
 * - Edge cases and error handling
 * - Progress callback invocation
 *
 * @see PIPE-001: E2E自動生成パイプライン
 * @see {@link ./pipeline.ts} — pipeline module under test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateThumbnail,
  refineThumbnail,
  applyFontRecommendations,
} from './pipeline';
import type {
  PipelineOptions,
  PipelineProgress,
  PipelineStage,
} from './pipeline';
import type { ThumbnailDesign, TextLayerDesign } from './design-schema';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Create a basic pipeline options object for testing. */
function createTestOptions(overrides?: Partial<PipelineOptions>): PipelineOptions {
  return {
    instruction: '衝撃的なニュース系サムネ、タイトル「AIが弁護士を超えた日」',
    ...overrides,
  };
}

/** Find all text layers in a design. */
function getTextLayers(design: ThumbnailDesign): TextLayerDesign[] {
  return design.layers.filter((l): l is TextLayerDesign => l.kind === 'text');
}

// ---------------------------------------------------------------------------
// Full Pipeline Tests
// ---------------------------------------------------------------------------

describe('generateThumbnail', () => {
  it('generates a successful result from a Japanese instruction', async () => {
    const result = await generateThumbnail(createTestOptions());

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.design).toBeDefined();
    expect(result.design.canvas.width).toBeGreaterThan(0);
    expect(result.design.canvas.height).toBeGreaterThan(0);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('generates a design with the correct canvas dimensions for youtube', async () => {
    const result = await generateThumbnail(createTestOptions({ platform: 'youtube' }));

    expect(result.success).toBe(true);
    expect(result.design.canvas.width).toBe(1280);
    expect(result.design.canvas.height).toBe(720);
  });

  it('generates a design with custom canvas size', async () => {
    const result = await generateThumbnail(createTestOptions({
      canvasSize: { width: 1920, height: 1080 },
    }));

    expect(result.success).toBe(true);
    expect(result.design.canvas.width).toBe(1920);
    expect(result.design.canvas.height).toBe(1080);
  });

  it('generates a design for instagram platform', async () => {
    const result = await generateThumbnail(createTestOptions({ platform: 'instagram' }));

    expect(result.success).toBe(true);
    expect(result.design.canvas.width).toBe(1080);
    expect(result.design.canvas.height).toBe(1080);
  });

  it('generates a design for twitter platform', async () => {
    const result = await generateThumbnail(createTestOptions({ platform: 'twitter' }));

    expect(result.success).toBe(true);
    expect(result.design.canvas.width).toBe(1200);
    expect(result.design.canvas.height).toBe(675);
  });

  it('applies explicit title text override', async () => {
    const result = await generateThumbnail(createTestOptions({
      title: 'Explicit Title',
    }));

    expect(result.success).toBe(true);
    const textLayers = getTextLayers(result.design);
    const titleLayer = textLayers.find((l) => l.name.toLowerCase().includes('title') && !l.name.toLowerCase().includes('sub'));
    if (titleLayer) {
      expect(titleLayer.text).toBe('Explicit Title');
    }
  });

  it('applies explicit category override', async () => {
    const result = await generateThumbnail(createTestOptions({
      category: 'howto',
    }));

    expect(result.success).toBe(true);
    expect(result.design.metadata.category).toBe('howto');
  });

  it('includes font recommendations in the result', async () => {
    const result = await generateThumbnail(createTestOptions());

    expect(result.success).toBe(true);
    expect(result.fontRecommendations).toBeDefined();
    expect(Array.isArray(result.fontRecommendations)).toBe(true);

    // Each text layer should have a font recommendation
    const textLayers = getTextLayers(result.design);
    if (textLayers.length > 0) {
      expect(result.fontRecommendations!.length).toBeGreaterThan(0);
      for (const rec of result.fontRecommendations!) {
        expect(rec.layerName).toBeTruthy();
        expect(rec.fontFamily).toBeTruthy();
        expect(rec.score).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('generates actions that include background setup', async () => {
    const result = await generateThumbnail(createTestOptions());

    expect(result.success).toBe(true);
    // First action should be a background action (gradient or pattern)
    const bgAction = result.actions.find(
      (a) => a.type === 'addGradientBackground' || a.type === 'addPattern',
    );
    expect(bgAction).toBeDefined();
  });

  it('generates actions that include text layer creation', async () => {
    const result = await generateThumbnail(createTestOptions());

    expect(result.success).toBe(true);
    const textActions = result.actions.filter((a) => a.type === 'createTextLayer');
    expect(textActions.length).toBeGreaterThan(0);
  });

  it('generates actions with text property settings', async () => {
    const result = await generateThumbnail(createTestOptions());

    expect(result.success).toBe(true);
    const textPropActions = result.actions.filter((a) => a.type === 'setTextProperties');
    expect(textPropActions.length).toBeGreaterThan(0);
  });

  it('produces consistent results for the same input', async () => {
    const options = createTestOptions();
    const result1 = await generateThumbnail(options);
    const result2 = await generateThumbnail(options);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.design.canvas).toEqual(result2.design.canvas);
    expect(result1.design.metadata).toEqual(result2.design.metadata);
    expect(result1.actions.length).toBe(result2.actions.length);
  });
});

// ---------------------------------------------------------------------------
// Progress Callback Tests
// ---------------------------------------------------------------------------

describe('generateThumbnail progress', () => {
  it('calls progress callback for each stage', async () => {
    const stages: PipelineStage[] = [];
    const messages: string[] = [];
    const onProgress: PipelineProgress = (stage, message) => {
      stages.push(stage);
      messages.push(message);
    };

    const result = await generateThumbnail(createTestOptions(), onProgress);

    expect(result.success).toBe(true);
    expect(stages).toContain('design');
    expect(stages).toContain('fonts');
    expect(stages).toContain('actions');
    expect(messages.length).toBe(3);
    // Each message should be a non-empty string
    for (const msg of messages) {
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('does not call progress callback on validation error', async () => {
    const onProgress = vi.fn();

    const result = await generateThumbnail({ instruction: '' }, onProgress);

    expect(result.success).toBe(false);
    expect(onProgress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error Handling Tests
// ---------------------------------------------------------------------------

describe('generateThumbnail error handling', () => {
  it('returns error for empty instruction', async () => {
    const result = await generateThumbnail({ instruction: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Instruction is required');
    expect(result.actions).toEqual([]);
  });

  it('returns error for whitespace-only instruction', async () => {
    const result = await generateThumbnail({ instruction: '   ' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Instruction is required');
  });

  it('returns an empty design on error', async () => {
    const result = await generateThumbnail({ instruction: '' });

    expect(result.design).toBeDefined();
    expect(result.design.canvas.width).toBe(1280);
    expect(result.design.canvas.height).toBe(720);
    expect(result.design.layers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Refinement Tests
// ---------------------------------------------------------------------------

describe('refineThumbnail', () => {
  /** Helper: generate a base design for refinement. */
  async function generateBaseDesign(): Promise<ThumbnailDesign> {
    const result = await generateThumbnail(createTestOptions());
    expect(result.success).toBe(true);
    return result.design;
  }

  it('returns a successful result from a refinement instruction', async () => {
    const base = await generateBaseDesign();
    const result = await refineThumbnail('もう少し派手にして', base);

    expect(result.success).toBe(true);
    expect(result.design).toBeDefined();
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('increases font size with "文字を大きく"', async () => {
    const base = await generateBaseDesign();
    const originalTextLayers = getTextLayers(base);
    const originalSizes = originalTextLayers.map((l) => l.fontSize);

    const result = await refineThumbnail('文字を大きくして', base);

    expect(result.success).toBe(true);
    const refinedTextLayers = getTextLayers(result.design);
    for (let i = 0; i < refinedTextLayers.length && i < originalSizes.length; i++) {
      expect(refinedTextLayers[i].fontSize).toBeGreaterThan(originalSizes[i]);
    }
  });

  it('decreases font size with "文字を小さく"', async () => {
    const base = await generateBaseDesign();
    const originalTextLayers = getTextLayers(base);
    const originalSizes = originalTextLayers.map((l) => l.fontSize);

    const result = await refineThumbnail('文字を小さくして', base);

    expect(result.success).toBe(true);
    const refinedTextLayers = getTextLayers(result.design);
    for (let i = 0; i < refinedTextLayers.length && i < originalSizes.length; i++) {
      expect(refinedTextLayers[i].fontSize).toBeLessThan(originalSizes[i]);
    }
  });

  it('makes text bold with "太字に"', async () => {
    const base = await generateBaseDesign();
    const result = await refineThumbnail('太字にして', base);

    expect(result.success).toBe(true);
    const refinedTextLayers = getTextLayers(result.design);
    for (const layer of refinedTextLayers) {
      expect(layer.bold).toBe(true);
    }
  });

  it('does not mutate the original design', async () => {
    const base = await generateBaseDesign();
    const originalJSON = JSON.stringify(base);

    await refineThumbnail('文字を大きくして', base);

    expect(JSON.stringify(base)).toBe(originalJSON);
  });

  it('returns error for empty refinement instruction', async () => {
    const base = await generateBaseDesign();
    const result = await refineThumbnail('', base);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Refinement instruction is required');
  });

  it('handles "bigger" in English refinement instruction', async () => {
    const base = await generateBaseDesign();
    const originalTextLayers = getTextLayers(base);
    const originalSizes = originalTextLayers.map((l) => l.fontSize);

    const result = await refineThumbnail('make the text bigger', base);

    expect(result.success).toBe(true);
    const refinedTextLayers = getTextLayers(result.design);
    for (let i = 0; i < refinedTextLayers.length && i < originalSizes.length; i++) {
      expect(refinedTextLayers[i].fontSize).toBeGreaterThan(originalSizes[i]);
    }
  });

  it('preserves canvas dimensions after refinement', async () => {
    const base = await generateBaseDesign();
    const result = await refineThumbnail('もっと派手にして', base);

    expect(result.success).toBe(true);
    expect(result.design.canvas).toEqual(base.canvas);
  });

  it('preserves metadata category after refinement', async () => {
    const base = await generateBaseDesign();
    const result = await refineThumbnail('文字を大きくして', base);

    expect(result.success).toBe(true);
    expect(result.design.metadata.category).toBe(base.metadata.category);
  });
});

// ---------------------------------------------------------------------------
// Font Recommendation Application Tests
// ---------------------------------------------------------------------------

describe('applyFontRecommendations', () => {
  it('replaces fonts on text layers without mutating the original', async () => {
    const result = await generateThumbnail(createTestOptions());
    expect(result.success).toBe(true);

    const original = result.design;
    const originalJSON = JSON.stringify(original);

    const enriched = applyFontRecommendations(original);

    // Original should not be mutated
    expect(JSON.stringify(original)).toBe(originalJSON);

    // Enriched should have fonts set on text layers
    const textLayers = getTextLayers(enriched);
    for (const layer of textLayers) {
      expect(layer.fontFamily).toBeTruthy();
      expect(typeof layer.fontFamily).toBe('string');
    }
  });

  it('returns a design with the same structure', async () => {
    const result = await generateThumbnail(createTestOptions());
    expect(result.success).toBe(true);

    const enriched = applyFontRecommendations(result.design);

    expect(enriched.canvas).toEqual(result.design.canvas);
    expect(enriched.metadata).toEqual(result.design.metadata);
    expect(enriched.layers.length).toBe(result.design.layers.length);
  });

  it('does not modify non-text layers', async () => {
    const result = await generateThumbnail(createTestOptions());
    expect(result.success).toBe(true);

    const original = result.design;
    const enriched = applyFontRecommendations(original);

    const originalNonText = original.layers.filter((l) => l.kind !== 'text');
    const enrichedNonText = enriched.layers.filter((l) => l.kind !== 'text');

    expect(enrichedNonText.length).toBe(originalNonText.length);
    for (let i = 0; i < originalNonText.length; i++) {
      expect(enrichedNonText[i].kind).toBe(originalNonText[i].kind);
      expect(enrichedNonText[i].name).toBe(originalNonText[i].name);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('pipeline integration', () => {
  it('handles a how-to tutorial instruction', async () => {
    const result = await generateThumbnail({
      instruction: 'Photoshopの使い方チュートリアル、タイトル「初心者向けガイド」',
    });

    expect(result.success).toBe(true);
    expect(result.design.layers.length).toBeGreaterThan(0);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('handles a product review instruction', async () => {
    const result = await generateThumbnail({
      instruction: '商品レビューサムネイル、タイトル「最新iPhone徹底レビュー」',
    });

    expect(result.success).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('handles an English instruction', async () => {
    const result = await generateThumbnail({
      instruction: 'Gaming thumbnail, title: "Epic Win Compilation"',
    });

    expect(result.success).toBe(true);
    expect(result.design.layers.length).toBeGreaterThan(0);
  });

  it('generates then refines in sequence', async () => {
    // Step 1: Generate
    const gen = await generateThumbnail(createTestOptions());
    expect(gen.success).toBe(true);

    // Step 2: Refine
    const ref1 = await refineThumbnail('文字を大きくして', gen.design);
    expect(ref1.success).toBe(true);

    // Step 3: Refine again
    const ref2 = await refineThumbnail('太字にして', ref1.design);
    expect(ref2.success).toBe(true);

    // Verify cumulative effects
    const finalTextLayers = getTextLayers(ref2.design);
    for (const layer of finalTextLayers) {
      expect(layer.bold).toBe(true);
    }

    // Font sizes should be larger than original
    const originalTextLayers = getTextLayers(gen.design);
    for (let i = 0; i < finalTextLayers.length && i < originalTextLayers.length; i++) {
      expect(finalTextLayers[i].fontSize).toBeGreaterThan(originalTextLayers[i].fontSize);
    }
  });

  it('handles all supported platforms', async () => {
    const platforms = ['youtube', 'twitter', 'instagram', 'custom'] as const;
    for (const platform of platforms) {
      const result = await generateThumbnail(createTestOptions({ platform }));
      expect(result.success).toBe(true);
      expect(result.design.metadata.targetPlatform).toBe(platform);
    }
  });

  it('applies effect presets to text layers based on mood', async () => {
    const result = await generateThumbnail(createTestOptions());
    expect(result.success).toBe(true);

    const textLayers = getTextLayers(result.design);
    for (const layer of textLayers) {
      // Every text layer should now have effects from the preset system
      expect(layer.effects).toBeDefined();
      expect(layer.effects.length).toBeGreaterThanOrEqual(1);
      // Each effect should have a type
      for (const effect of layer.effects) {
        expect(effect.type).toBeDefined();
      }
    }
  });
});
