/**
 * @module ai/thumbnail-architect.test
 * Tests for the Thumbnail Architect (THUMB-001).
 *
 * Covers:
 * - Design schema validation (valid + invalid cases)
 * - Design pattern database completeness
 * - Pattern selection by keyword matching
 * - Text extraction from instructions
 * - Design generation (generateDesign)
 * - Design-to-action conversion (designToActions)
 * - Color psychology overrides
 *
 * @see THUMB-001: Thumbnail Architect
 */

import { describe, it, expect } from 'vitest';
import {
  validateThumbnailDesign,
  DesignValidationError,
  type ThumbnailDesign,
} from './design-schema';
import {
  DESIGN_PATTERNS,
  COLOR_PSYCHOLOGY_RULES,
  findPatternForInstruction,
  getPatternById,
  findPsychologyColor,
  resolveTextLayer,
} from './design-patterns';
import {
  generateDesign,
  designToActions,
  extractTextFromInstruction,
} from './thumbnail-architect';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid ThumbnailDesign for test use. */
function buildMinimalDesign(): ThumbnailDesign {
  return {
    canvas: { width: 1280, height: 720 },
    background: {
      type: 'solid',
      color: { r: 0, g: 0, b: 0, a: 1 },
    },
    layers: [
      {
        kind: 'text',
        name: 'Title',
        text: 'Hello',
        x: 100,
        y: 200,
        fontSize: 48,
        fontFamily: 'Noto Sans JP',
        color: { r: 255, g: 255, b: 255, a: 1 },
        bold: true,
        italic: false,
        alignment: 'center',
        effects: [],
      },
    ],
    metadata: {
      category: 'news',
      mood: 'urgent',
      targetPlatform: 'youtube',
    },
  };
}

// ===========================================================================
// 1. Design Schema Validation
// ===========================================================================

describe('design-schema validation', () => {
  it('accepts a valid minimal design', () => {
    const design = buildMinimalDesign();
    const result = validateThumbnailDesign(design);
    expect(result).toBe(design);
  });

  it('accepts a design with gradient background', () => {
    const design = buildMinimalDesign();
    design.background = {
      type: 'gradient',
      gradientType: 'linear',
      angle: 90,
      stops: [
        { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 255, a: 1 } },
      ],
    };
    expect(() => validateThumbnailDesign(design)).not.toThrow();
  });

  it('accepts a design with pattern background', () => {
    const design = buildMinimalDesign();
    design.background = {
      type: 'pattern',
      pattern: 'dots',
      color: { r: 100, g: 100, b: 100, a: 1 },
      spacing: 20,
      size: 4,
      opacity: 0.5,
    };
    expect(() => validateThumbnailDesign(design)).not.toThrow();
  });

  it('accepts a design with image layer', () => {
    const design = buildMinimalDesign();
    design.layers.push({
      kind: 'image',
      name: 'Subject',
      x: 100,
      y: 100,
      width: 400,
      height: 500,
      description: 'Test image',
    });
    expect(() => validateThumbnailDesign(design)).not.toThrow();
  });

  it('accepts a design with shape layer', () => {
    const design = buildMinimalDesign();
    design.layers.push({
      kind: 'shape',
      name: 'Lines',
      shapeType: 'concentration-lines',
      params: { lineCount: 40 },
    });
    expect(() => validateThumbnailDesign(design)).not.toThrow();
  });

  it('rejects null', () => {
    expect(() => validateThumbnailDesign(null)).toThrow(DesignValidationError);
  });

  it('rejects non-object', () => {
    expect(() => validateThumbnailDesign('string')).toThrow(DesignValidationError);
  });

  it('rejects missing canvas', () => {
    const design = buildMinimalDesign();
    delete (design as Record<string, unknown>).canvas;
    expect(() => validateThumbnailDesign(design)).toThrow('canvas');
  });

  it('rejects canvas with zero width', () => {
    const design = buildMinimalDesign();
    design.canvas.width = 0;
    expect(() => validateThumbnailDesign(design)).toThrow('positive');
  });

  it('rejects unknown background type', () => {
    const design = buildMinimalDesign();
    (design.background as Record<string, unknown>).type = 'image';
    expect(() => validateThumbnailDesign(design)).toThrow('Unknown background type');
  });

  it('rejects gradient with less than 2 stops', () => {
    const design = buildMinimalDesign();
    design.background = {
      type: 'gradient',
      gradientType: 'linear',
      angle: 0,
      stops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }],
    };
    expect(() => validateThumbnailDesign(design)).toThrow('at least 2');
  });

  it('rejects layer with unknown kind', () => {
    const design = buildMinimalDesign();
    (design.layers[0] as Record<string, unknown>).kind = 'video';
    expect(() => validateThumbnailDesign(design)).toThrow('unknown kind');
  });

  it('rejects text layer with missing fontSize', () => {
    const design = buildMinimalDesign();
    delete (design.layers[0] as Record<string, unknown>).fontSize;
    expect(() => validateThumbnailDesign(design)).toThrow('fontSize');
  });

  it('rejects image layer with zero width', () => {
    const design: ThumbnailDesign = {
      ...buildMinimalDesign(),
      layers: [{
        kind: 'image',
        name: 'Img',
        x: 0,
        y: 0,
        width: 0,
        height: 100,
        description: 'bad',
      }],
    };
    expect(() => validateThumbnailDesign(design)).toThrow('positive');
  });

  it('rejects missing metadata', () => {
    const design = buildMinimalDesign();
    delete (design as Record<string, unknown>).metadata;
    expect(() => validateThumbnailDesign(design)).toThrow('metadata');
  });

  it('rejects metadata with missing category', () => {
    const design = buildMinimalDesign();
    delete (design.metadata as Record<string, unknown>).category;
    expect(() => validateThumbnailDesign(design)).toThrow('category');
  });
});

// ===========================================================================
// 2. Design Pattern Database Completeness
// ===========================================================================

describe('design-patterns database', () => {
  it('contains at least 5 categories', () => {
    expect(DESIGN_PATTERNS.length).toBeGreaterThanOrEqual(5);
  });

  it('each pattern has a unique ID', () => {
    const ids = DESIGN_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each pattern has required fields', () => {
    for (const pattern of DESIGN_PATTERNS) {
      expect(typeof pattern.id).toBe('string');
      expect(typeof pattern.nameJa).toBe('string');
      expect(typeof pattern.nameEn).toBe('string');
      expect(typeof pattern.mood).toBe('string');
      expect(pattern.background).toBeDefined();
      expect(pattern.palette).toBeDefined();
      expect(pattern.textLayers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each pattern palette has all required keys', () => {
    for (const pattern of DESIGN_PATTERNS) {
      const p = pattern.palette;
      expect(typeof p.primary.r).toBe('number');
      expect(typeof p.secondary.r).toBe('number');
      expect(typeof p.accent.r).toBe('number');
      expect(typeof p.text.r).toBe('number');
      expect(typeof p.subText.r).toBe('number');
    }
  });

  it('each pattern has at least a title text layer template', () => {
    for (const pattern of DESIGN_PATTERNS) {
      const hasTitle = pattern.textLayers.some((t) => t.role === 'title');
      expect(hasTitle).toBe(true);
    }
  });

  it('color psychology rules is non-empty', () => {
    expect(COLOR_PSYCHOLOGY_RULES.length).toBeGreaterThan(0);
  });

  it('getPatternById returns pattern for valid ID', () => {
    const pattern = getPatternById('news');
    expect(pattern).toBeDefined();
    expect(pattern!.id).toBe('news');
  });

  it('getPatternById returns undefined for invalid ID', () => {
    expect(getPatternById('nonexistent')).toBeUndefined();
  });
});

// ===========================================================================
// 3. Pattern Selection (keyword matching)
// ===========================================================================

describe('findPatternForInstruction', () => {
  it('selects news pattern for Japanese news keywords', () => {
    const pattern = findPatternForInstruction('衝撃的なニュース系サムネ');
    expect(pattern.id).toBe('news');
  });

  it('selects howto pattern for tutorial keywords', () => {
    const pattern = findPatternForInstruction('初心者向けチュートリアル');
    expect(pattern.id).toBe('howto');
  });

  it('selects vlog pattern for vlog keywords', () => {
    const pattern = findPatternForInstruction('今日のvlog 旅行の日常');
    expect(pattern.id).toBe('vlog');
  });

  it('selects product pattern for review keywords', () => {
    const pattern = findPatternForInstruction('商品レビューのサムネ');
    expect(pattern.id).toBe('product');
  });

  it('selects gaming pattern for game keywords', () => {
    const pattern = findPatternForInstruction('ゲーム実況のサムネイル');
    expect(pattern.id).toBe('gaming');
  });

  it('selects comparison pattern for VS keywords', () => {
    const pattern = findPatternForInstruction('iPhone VS Android 比較');
    expect(pattern.id).toBe('comparison');
  });

  it('defaults to news when no keywords match', () => {
    const pattern = findPatternForInstruction('random text with no keywords');
    expect(pattern.id).toBe('news');
  });

  it('handles English keywords', () => {
    const pattern = findPatternForInstruction('breaking news alert');
    expect(pattern.id).toBe('news');
  });
});

// ===========================================================================
// 4. Text Extraction
// ===========================================================================

describe('extractTextFromInstruction', () => {
  it('extracts title from "タイトル: ..." pattern', () => {
    const result = extractTextFromInstruction('ニュース系サムネ、タイトル: AIが弁護士を超えた日');
    expect(result.title).toBe('AIが弁護士を超えた日');
  });

  it('extracts title from bracket pattern "タイトル「...」"', () => {
    const result = extractTextFromInstruction('タイトル「衝撃の事実」');
    expect(result.title).toBe('衝撃の事実');
  });

  it('extracts title from quoted string as fallback', () => {
    const result = extractTextFromInstruction('速報系サムネ「AIが世界を変える」');
    expect(result.title).toBe('AIが世界を変える');
  });

  it('extracts subtitle from "サブタイトル: ..." pattern', () => {
    const result = extractTextFromInstruction('タイトル: メイン、サブタイトル: 補足テキスト');
    expect(result.subtitle).toBe('補足テキスト');
  });

  it('returns empty strings when no title/subtitle found', () => {
    const result = extractTextFromInstruction('ニュース系のサムネを作って');
    expect(result.title).toBe('');
    expect(result.subtitle).toBe('');
  });

  it('handles English title pattern', () => {
    const result = extractTextFromInstruction('Title: The Future of AI');
    expect(result.title).toBe('The Future of AI');
  });
});

// ===========================================================================
// 5. Color Psychology
// ===========================================================================

describe('findPsychologyColor', () => {
  it('returns red for urgency keywords', () => {
    const color = findPsychologyColor('緊急ニュース');
    expect(color).toBeDefined();
    expect(color!.r).toBeGreaterThan(200);
  });

  it('returns blue for trust keywords', () => {
    const color = findPsychologyColor('信頼できるビジネス');
    expect(color).toBeDefined();
    expect(color!.b).toBeGreaterThan(100);
  });

  it('returns undefined for no matching keywords', () => {
    const color = findPsychologyColor('no emotional keywords here xyz');
    expect(color).toBeUndefined();
  });
});

// ===========================================================================
// 6. resolveTextLayer
// ===========================================================================

describe('resolveTextLayer', () => {
  it('converts ratio positions to absolute pixels', () => {
    const template = DESIGN_PATTERNS[0].textLayers[0];
    const palette = DESIGN_PATTERNS[0].palette;
    const resolved = resolveTextLayer(template, palette, 1280, 720, 'Test');
    expect(resolved.x).toBe(Math.round(template.xRatio * 1280));
    expect(resolved.y).toBe(Math.round(template.yRatio * 720));
    expect(resolved.text).toBe('Test');
    expect(resolved.kind).toBe('text');
  });

  it('scales font size for different canvas widths', () => {
    const template = DESIGN_PATTERNS[0].textLayers[0];
    const palette = DESIGN_PATTERNS[0].palette;
    const resolved640 = resolveTextLayer(template, palette, 640, 360, 'Test');
    const resolved1280 = resolveTextLayer(template, palette, 1280, 720, 'Test');
    expect(resolved640.fontSize).toBe(Math.round(template.fontSize * 0.5));
    expect(resolved1280.fontSize).toBe(template.fontSize);
  });

  it('applies palette color for the specified colorKey', () => {
    const template = DESIGN_PATTERNS[0].textLayers[0]; // colorKey = 'text'
    const palette = DESIGN_PATTERNS[0].palette;
    const resolved = resolveTextLayer(template, palette, 1280, 720, 'Test');
    expect(resolved.color).toEqual(palette.text);
  });
});

// ===========================================================================
// 7. generateDesign
// ===========================================================================

describe('generateDesign', () => {
  it('generates a valid design for a Japanese news instruction', () => {
    const design = generateDesign('衝撃的なニュース系サムネ、タイトル: AIが弁護士を超えた日');
    expect(design.metadata.category).toBe('news');
    expect(design.canvas.width).toBe(1280);
    expect(design.canvas.height).toBe(720);

    // Validate the design
    expect(() => validateThumbnailDesign(design)).not.toThrow();

    // Should have title text
    const titleLayer = design.layers.find(
      (l) => l.kind === 'text' && l.name.includes('title'),
    );
    expect(titleLayer).toBeDefined();
    expect((titleLayer as { text: string }).text).toBe('AIが弁護士を超えた日');
  });

  it('respects explicit category override', () => {
    const design = generateDesign('何かのサムネ', { category: 'gaming' });
    expect(design.metadata.category).toBe('gaming');
  });

  it('respects explicit title and subtitle', () => {
    const design = generateDesign('サムネ作って', {
      title: 'Custom Title',
      subtitle: 'Custom Sub',
    });
    const titleLayer = design.layers.find(
      (l) => l.kind === 'text' && (l as { text: string }).text === 'Custom Title',
    );
    expect(titleLayer).toBeDefined();
  });

  it('uses YouTube dimensions by default', () => {
    const design = generateDesign('テストサムネ');
    expect(design.canvas.width).toBe(1280);
    expect(design.canvas.height).toBe(720);
  });

  it('uses Instagram dimensions when specified', () => {
    const design = generateDesign('テストサムネ', { platform: 'instagram' });
    expect(design.canvas.width).toBe(1080);
    expect(design.canvas.height).toBe(1080);
  });

  it('respects explicit canvas size overrides', () => {
    const design = generateDesign('テストサムネ', { width: 1920, height: 1080 });
    expect(design.canvas.width).toBe(1920);
    expect(design.canvas.height).toBe(1080);
  });

  it('includes concentration lines for news pattern', () => {
    const design = generateDesign('衝撃ニュース速報');
    const hasConcentrationLines = design.layers.some(
      (l) => l.kind === 'shape' && (l as ShapeDesignLike).shapeType === 'concentration-lines',
    );
    expect(hasConcentrationLines).toBe(true);
  });

  it('includes border frame for applicable patterns', () => {
    const design = generateDesign('衝撃ニュース速報');
    const hasBorder = design.layers.some(
      (l) => l.kind === 'shape' && (l as ShapeDesignLike).shapeType === 'border-frame',
    );
    expect(hasBorder).toBe(true);
  });

  it('includes image placeholder', () => {
    const design = generateDesign('テストサムネ');
    const hasImage = design.layers.some((l) => l.kind === 'image');
    expect(hasImage).toBe(true);
  });

  it('applies color psychology override', () => {
    const designUrgent = generateDesign('緊急速報ニュース、タイトル: テスト');
    // Psychology color should be set (red for urgency)
    expect(designUrgent.metadata.category).toBe('news');
    // Verify the design is still valid
    expect(() => validateThumbnailDesign(designUrgent)).not.toThrow();
  });

  it('skips subtitle layer when no subtitle text', () => {
    // The howto pattern has a subtitle template, but it should be skipped
    const designHowTo = generateDesign('チュートリアルのサムネ、タイトル: テスト');
    const subtitleLayers = designHowTo.layers.filter(
      (l) => l.kind === 'text' && l.name.includes('subtitle'),
    );
    expect(subtitleLayers.length).toBe(0);
  });

  it('generates valid design for all pattern categories', () => {
    const instructions: Record<string, string> = {
      news: '衝撃ニュース、タイトル: テスト',
      howto: 'やり方チュートリアル、タイトル: テスト',
      vlog: '今日のvlog、タイトル: テスト',
      product: '商品レビュー、タイトル: テスト',
      gaming: 'ゲーム実況、タイトル: テスト',
      comparison: 'VS比較、タイトル: テスト',
    };

    for (const [category, instruction] of Object.entries(instructions)) {
      const design = generateDesign(instruction);
      expect(design.metadata.category).toBe(category);
      expect(() => validateThumbnailDesign(design)).not.toThrow();
    }
  });
});

// Helper type for shape layer assertion
interface ShapeDesignLike {
  kind: 'shape';
  shapeType: string;
}

// ===========================================================================
// 8. designToActions Conversion
// ===========================================================================

describe('designToActions', () => {
  it('generates actions for a minimal design', () => {
    const design = buildMinimalDesign();
    const actions = designToActions(design);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('generates gradient background action for solid background', () => {
    const design = buildMinimalDesign();
    const actions = designToActions(design);
    const bgAction = actions.find((a) => a.type === 'addGradientBackground');
    expect(bgAction).toBeDefined();
  });

  it('generates gradient background action for gradient background', () => {
    const design = buildMinimalDesign();
    design.background = {
      type: 'gradient',
      gradientType: 'linear',
      angle: 90,
      stops: [
        { position: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 255, a: 1 } },
      ],
    };
    const actions = designToActions(design);
    const bgAction = actions.find((a) => a.type === 'addGradientBackground');
    expect(bgAction).toBeDefined();
    if (bgAction && bgAction.type === 'addGradientBackground') {
      expect(bgAction.params.stops).toHaveLength(2);
      expect(bgAction.params.gradientType).toBe('linear');
    }
  });

  it('generates pattern action for pattern background', () => {
    const design = buildMinimalDesign();
    design.background = {
      type: 'pattern',
      pattern: 'dots',
      color: { r: 100, g: 100, b: 100, a: 1 },
      spacing: 20,
      size: 4,
      opacity: 0.5,
    };
    const actions = designToActions(design);
    const patternAction = actions.find((a) => a.type === 'addPattern');
    expect(patternAction).toBeDefined();
  });

  it('generates createTextLayer + setTextProperties for text layers', () => {
    const design = buildMinimalDesign();
    const actions = designToActions(design);
    const createText = actions.filter((a) => a.type === 'createTextLayer');
    const setProps = actions.filter((a) => a.type === 'setTextProperties');
    expect(createText.length).toBe(1);
    expect(setProps.length).toBe(1);
  });

  it('generates setLayerEffects when text layer has effects', () => {
    const design = buildMinimalDesign();
    (design.layers[0] as { effects: Record<string, unknown>[] }).effects = [
      { type: 'stroke', enabled: true, color: { r: 0, g: 0, b: 0, a: 1 }, size: 4, position: 'outside', opacity: 1 },
    ];
    const actions = designToActions(design);
    const effectsAction = actions.find((a) => a.type === 'setLayerEffects');
    expect(effectsAction).toBeDefined();
  });

  it('generates addConcentrationLines for shape layers', () => {
    const design = buildMinimalDesign();
    design.layers.push({
      kind: 'shape',
      name: 'Lines',
      shapeType: 'concentration-lines',
      params: {
        centerX: 640,
        centerY: 360,
        lineCount: 60,
        color: { r: 0, g: 0, b: 0, a: 128 },
        innerRadius: 150,
        lineWidth: 2,
      },
    });
    const actions = designToActions(design);
    const linesAction = actions.find((a) => a.type === 'addConcentrationLines');
    expect(linesAction).toBeDefined();
  });

  it('generates addBorderFrame for border shape layers', () => {
    const design = buildMinimalDesign();
    design.layers.push({
      kind: 'shape',
      name: 'Frame',
      shapeType: 'border-frame',
      params: {
        borderWidth: 6,
        color: { r: 255, g: 255, b: 255, a: 255 },
        cornerRadius: 0,
        style: 'solid',
      },
    });
    const actions = designToActions(design);
    const frameAction = actions.find((a) => a.type === 'addBorderFrame');
    expect(frameAction).toBeDefined();
  });

  it('generates no actions for image placeholder layers', () => {
    const design: ThumbnailDesign = {
      canvas: { width: 1280, height: 720 },
      background: { type: 'solid', color: { r: 0, g: 0, b: 0, a: 1 } },
      layers: [{
        kind: 'image',
        name: 'Subject',
        x: 100,
        y: 100,
        width: 400,
        height: 500,
        description: 'placeholder',
      }],
      metadata: { category: 'test', mood: 'test', targetPlatform: 'youtube' },
    };
    const actions = designToActions(design);
    // Should only have background action, no layer-specific actions
    expect(actions.every((a) => a.type === 'addGradientBackground')).toBe(true);
  });

  it('produces valid action types only', () => {
    const design = generateDesign('衝撃的なニュース系サムネ、タイトル: テスト');
    const actions = designToActions(design);

    const validTypes = new Set([
      'createTextLayer', 'createRasterLayer', 'createLayerGroup',
      'removeLayer', 'duplicateLayer', 'selectLayer', 'reorderLayer',
      'setLayerPosition', 'setLayerOpacity', 'setLayerBlendMode',
      'setLayerVisibility', 'renameLayer', 'resizeLayer',
      'setTextProperties', 'addLayerEffect', 'removeLayerEffect',
      'updateLayerEffect', 'setLayerEffects', 'applyFilter',
      'addGradientBackground', 'addPattern', 'addConcentrationLines',
      'addBorderFrame', 'applyGradientMask', 'addImageAsLayer',
      'undo', 'redo', 'getDocumentInfo', 'getLayerInfo', 'getCanvasSnapshot',
    ]);

    for (const action of actions) {
      expect(validTypes.has(action.type)).toBe(true);
    }
  });

  it('end-to-end: instruction -> design -> actions', () => {
    const design = generateDesign('衝撃的なニュース系サムネ、タイトル: AIが弁護士を超えた日');
    expect(() => validateThumbnailDesign(design)).not.toThrow();

    const actions = designToActions(design);
    expect(actions.length).toBeGreaterThan(0);

    // Should have at least: background + text create + text props
    const hasBackground = actions.some((a) => a.type === 'addGradientBackground');
    const hasTextCreate = actions.some((a) => a.type === 'createTextLayer');
    const hasTextProps = actions.some((a) => a.type === 'setTextProperties');

    expect(hasBackground).toBe(true);
    expect(hasTextCreate).toBe(true);
    expect(hasTextProps).toBe(true);
  });
});
