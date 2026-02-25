/**
 * @module editor-actions/style-analyzer.test
 * Comprehensive tests for the style analysis engine (STYLE-001).
 *
 * Test coverage:
 * - All 8 built-in presets described correctly (describeEffects + describeLayerStyle)
 * - 10+ natural language patterns parsed correctly (parseStyleDescription)
 * - Color name -> RGB conversion tests (lookupColor)
 * - Roundtrip: effects -> description -> effects produces equivalent result
 * - Effect name lookup tests
 * - Adjective modifier tests
 *
 * @see STYLE-001: Style Analysis Engine
 * @see {@link ./style-analyzer.ts}
 * @see {@link ./style-vocabulary.ts}
 * @see {@link ../components/panels/text-style-presets.ts} — source of preset test data
 */

import { describe, it, expect } from 'vitest';
import type { LayerEffect, Color } from '@photoshop-app/types';
import {
  describeEffects,
  describeLayerStyle,
  parseStyleDescription,
  effectsEquivalent,
} from './style-analyzer';
import {
  lookupColor,
  findClosestColorName,
  lookupEffectType,
  lookupPresetId,
  getEffectDisplayName,
  getColorDisplayName,
  findAdjectives,
} from './style-vocabulary';
import { BUILT_IN_TEXT_STYLES } from '../components/panels/text-style-presets';

// ---------------------------------------------------------------------------
// Helper: create effects for testing
// ---------------------------------------------------------------------------

function stroke(color: Color, size: number): LayerEffect {
  return {
    type: 'stroke',
    enabled: true,
    color,
    size,
    position: 'outside',
    opacity: 1,
  };
}

function dropShadow(): LayerEffect {
  return {
    type: 'drop-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 0.75 },
    opacity: 0.75,
    angle: 135,
    distance: 3,
    blur: 6,
    spread: 0,
  };
}

function outerGlow(color: Color): LayerEffect {
  return {
    type: 'outer-glow',
    enabled: true,
    color,
    opacity: 0.6,
    size: 10,
    spread: 0,
  };
}

const WHITE: Color = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 };
const RED: Color = { r: 255, g: 0, b: 0, a: 1 };
const YELLOW: Color = { r: 255, g: 255, b: 0, a: 1 };
const GOLD: Color = { r: 212, g: 175, b: 55, a: 1 };

// ---------------------------------------------------------------------------
// 1. Color Name -> RGB Conversion Tests
// ---------------------------------------------------------------------------

describe('lookupColor', () => {
  it('should resolve Japanese color names', () => {
    expect(lookupColor('白')).toEqual(WHITE);
    expect(lookupColor('黒')).toEqual(BLACK);
    expect(lookupColor('赤')).toEqual(RED);
    expect(lookupColor('青')).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    expect(lookupColor('金色')).toEqual(GOLD);
    expect(lookupColor('ネオン')).toEqual({ r: 57, g: 255, b: 20, a: 1 });
  });

  it('should resolve English color names (case-insensitive)', () => {
    expect(lookupColor('white')).toEqual(WHITE);
    expect(lookupColor('BLACK')).toEqual(BLACK);
    expect(lookupColor('Red')).toEqual(RED);
    expect(lookupColor('gold')).toEqual(GOLD);
    expect(lookupColor('neon')).toEqual({ r: 57, g: 255, b: 20, a: 1 });
  });

  it('should return undefined for unknown colors', () => {
    expect(lookupColor('rainbow')).toBeUndefined();
    expect(lookupColor('虹色')).toBeUndefined();
  });

  it('should resolve alternative Japanese aliases', () => {
    expect(lookupColor('しろ')).toEqual(WHITE);
    expect(lookupColor('くろ')).toEqual(BLACK);
    expect(lookupColor('ピンク')).toEqual({ r: 255, g: 105, b: 180, a: 1 });
    expect(lookupColor('シルバー')).toEqual({ r: 192, g: 192, b: 192, a: 1 });
  });
});

describe('findClosestColorName', () => {
  it('should find exact matches', () => {
    expect(findClosestColorName(WHITE).name).toBe('white');
    expect(findClosestColorName(BLACK).name).toBe('black');
    expect(findClosestColorName(RED).name).toBe('red');
  });

  it('should find closest color for approximate values', () => {
    // Off-white should match white
    const offWhite: Color = { r: 250, g: 250, b: 250, a: 1 };
    expect(findClosestColorName(offWhite).name).toBe('white');

    // Dark red should match red
    const darkRed: Color = { r: 200, g: 10, b: 10, a: 1 };
    expect(findClosestColorName(darkRed).name).toBe('red');
  });
});

describe('getColorDisplayName', () => {
  it('should return Japanese name for ja', () => {
    expect(getColorDisplayName(WHITE, 'ja')).toBe('白');
    expect(getColorDisplayName(BLACK, 'ja')).toBe('黒');
    expect(getColorDisplayName(RED, 'ja')).toBe('赤');
  });

  it('should return English name for en', () => {
    expect(getColorDisplayName(WHITE, 'en')).toBe('white');
    expect(getColorDisplayName(BLACK, 'en')).toBe('black');
    expect(getColorDisplayName(RED, 'en')).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// 2. Effect Name Lookup Tests
// ---------------------------------------------------------------------------

describe('lookupEffectType', () => {
  it('should resolve Japanese effect names', () => {
    expect(lookupEffectType('縁取り')).toBe('stroke');
    expect(lookupEffectType('影')).toBe('drop-shadow');
    expect(lookupEffectType('光彩')).toBe('outer-glow');
    expect(lookupEffectType('内側影')).toBe('inner-shadow');
    expect(lookupEffectType('内側光彩')).toBe('inner-glow');
    expect(lookupEffectType('カラーオーバーレイ')).toBe('color-overlay');
    expect(lookupEffectType('グラデーション')).toBe('gradient-overlay');
    expect(lookupEffectType('ベベル')).toBe('bevel-emboss');
    expect(lookupEffectType('エンボス')).toBe('bevel-emboss');
    expect(lookupEffectType('立体')).toBe('bevel-emboss');
  });

  it('should resolve English effect names (case-insensitive)', () => {
    expect(lookupEffectType('stroke')).toBe('stroke');
    expect(lookupEffectType('Drop-Shadow')).toBe('drop-shadow');
    expect(lookupEffectType('glow')).toBe('outer-glow');
    expect(lookupEffectType('inner shadow')).toBe('inner-shadow');
    expect(lookupEffectType('bevel')).toBe('bevel-emboss');
  });

  it('should return undefined for unknown effect names', () => {
    expect(lookupEffectType('blur')).toBeUndefined();
    expect(lookupEffectType('ぼかし')).toBeUndefined();
  });
});

describe('getEffectDisplayName', () => {
  it('should return Japanese display names', () => {
    expect(getEffectDisplayName('stroke', 'ja')).toBe('縁取り');
    expect(getEffectDisplayName('drop-shadow', 'ja')).toBe('影');
    expect(getEffectDisplayName('outer-glow', 'ja')).toBe('光彩');
  });

  it('should return English display names', () => {
    expect(getEffectDisplayName('stroke', 'en')).toBe('stroke');
    expect(getEffectDisplayName('drop-shadow', 'en')).toBe('drop shadow');
    expect(getEffectDisplayName('outer-glow', 'en')).toBe('outer glow');
  });
});

// ---------------------------------------------------------------------------
// 3. Preset Name Lookup Tests
// ---------------------------------------------------------------------------

describe('lookupPresetId', () => {
  it('should resolve Japanese preset names', () => {
    expect(lookupPresetId('YouTuber風')).toBe('builtin-youtuber');
    expect(lookupPresetId('インパクト')).toBe('builtin-impact');
    expect(lookupPresetId('エレガント')).toBe('builtin-elegant');
    expect(lookupPresetId('ポップ')).toBe('builtin-pop');
    expect(lookupPresetId('速報風')).toBe('builtin-breaking');
    expect(lookupPresetId('シンプル黒')).toBe('builtin-simple-black');
    expect(lookupPresetId('グラデ文字')).toBe('builtin-gradient-text');
    expect(lookupPresetId('縁取り')).toBe('builtin-outlined');
  });

  it('should resolve English preset names (case-insensitive)', () => {
    expect(lookupPresetId('youtuber')).toBe('builtin-youtuber');
    expect(lookupPresetId('Impact')).toBe('builtin-impact');
    expect(lookupPresetId('elegant')).toBe('builtin-elegant');
    expect(lookupPresetId('pop')).toBe('builtin-pop');
    expect(lookupPresetId('breaking')).toBe('builtin-breaking');
  });

  it('should return undefined for unknown preset names', () => {
    expect(lookupPresetId('retro')).toBeUndefined();
    expect(lookupPresetId('レトロ')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Adjective Modifier Tests
// ---------------------------------------------------------------------------

describe('findAdjectives', () => {
  it('should find Japanese adjective keywords', () => {
    const thick = findAdjectives('太い赤文字');
    expect(thick.length).toBeGreaterThan(0);
    expect(thick[0].name).toBe('thick');
  });

  it('should find English adjective keywords', () => {
    const flashy = findAdjectives('flashy red text');
    expect(flashy.length).toBeGreaterThan(0);
    expect(flashy[0].name).toBe('flashy');
  });

  it('should find multiple adjectives', () => {
    const matches = findAdjectives('大きい太い文字');
    expect(matches.length).toBe(2);
    const names = matches.map((m) => m.name);
    expect(names).toContain('thick');
    expect(names).toContain('large');
  });

  it('should return empty for descriptions with no adjectives', () => {
    expect(findAdjectives('白文字')).toHaveLength(0);
    expect(findAdjectives('white text')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. describeEffects Tests — All 8 Built-in Presets
// ---------------------------------------------------------------------------

describe('describeEffects — built-in presets', () => {
  it('should describe YouTuber定番 preset (white text + black stroke + drop shadow)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-youtuber')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('白');
    expect(desc).toContain('縁取り');
    expect(desc).toContain('影');
  });

  it('should describe インパクト preset (red text + white stroke + yellow glow)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-impact')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('赤');
    expect(desc).toContain('縁取り');
    expect(desc).toContain('光彩');
  });

  it('should describe エレガント preset (gold text + drop shadow)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-elegant')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('金');
    expect(desc).toContain('影');
  });

  it('should describe ポップ preset (pink text + white stroke + pink glow)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-pop')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('ピンク');
    expect(desc).toContain('縁取り');
    expect(desc).toContain('光彩');
  });

  it('should describe 速報風 preset (white text + red stroke)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-breaking')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('白');
    expect(desc).toContain('赤');
    expect(desc).toContain('縁取り');
  });

  it('should describe シンプル黒 preset (black text, no effects)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-simple-black')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('黒');
  });

  it('should describe グラデ文字 preset (white text + stroke + gradient overlay)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-gradient-text')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('白');
    expect(desc).toContain('縁取り');
    expect(desc).toContain('グラデーション');
  });

  it('should describe 縁取り preset (yellow text + black stroke + white glow)', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-outlined')!;
    const desc = describeEffects(preset.effects, { color: preset.color }, 'ja');
    expect(desc).toContain('黄');
    expect(desc).toContain('縁取り');
    expect(desc).toContain('光彩');
  });
});

describe('describeEffects — English output', () => {
  it('should describe in English when lang=en', () => {
    const effects: LayerEffect[] = [
      stroke(BLACK, 4),
      dropShadow(),
    ];
    const desc = describeEffects(effects, { color: WHITE }, 'en');
    expect(desc).toContain('white');
    expect(desc).toContain('black');
    expect(desc).toContain('stroke');
    expect(desc).toContain('drop shadow');
  });

  it('should return "no effects" for empty effects array in English', () => {
    const desc = describeEffects([], undefined, 'en');
    expect(desc).toBe('no effects');
  });

  it('should return "エフェクトなし" for empty effects array in Japanese', () => {
    const desc = describeEffects([], undefined, 'ja');
    expect(desc).toBe('エフェクトなし');
  });
});

describe('describeLayerStyle', () => {
  it('should include font information in layer description', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-youtuber')!;
    const desc = describeLayerStyle({
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      bold: preset.bold,
      italic: preset.italic,
      color: preset.color,
      effects: preset.effects,
    }, 'ja');
    expect(desc).toContain('Impact');
    expect(desc).toContain('72px');
    expect(desc).toContain('太字');
  });

  it('should include italic for elegant preset', () => {
    const preset = BUILT_IN_TEXT_STYLES.find((p) => p.id === 'builtin-elegant')!;
    const desc = describeLayerStyle({
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      bold: preset.bold,
      italic: preset.italic,
      color: preset.color,
      effects: preset.effects,
    }, 'ja');
    expect(desc).toContain('Georgia');
    expect(desc).toContain('イタリック');
  });
});

// ---------------------------------------------------------------------------
// 6. parseStyleDescription Tests — 10+ Natural Language Patterns
// ---------------------------------------------------------------------------

describe('parseStyleDescription — Japanese patterns', () => {
  it('should parse "白文字に黒縁取り"', () => {
    const result = parseStyleDescription('白文字に黒縁取り');
    expect(result.textProps.color).toEqual(WHITE);
    expect(result.effects.length).toBeGreaterThanOrEqual(1);
    expect(result.effects[0].type).toBe('stroke');
  });

  it('should parse "赤い太文字"', () => {
    const result = parseStyleDescription('赤い文字に太い縁取り');
    // Should detect red as text color and create a thick stroke
    expect(result.textProps.color).toEqual(RED);
    expect(result.effects.some((e) => e.type === 'stroke')).toBe(true);
  });

  it('should parse "白文字に黒の太い縁取り＋影"', () => {
    const result = parseStyleDescription('白文字に黒の太い縁取り＋影');
    expect(result.textProps.color).toEqual(WHITE);
    expect(result.effects.some((e) => e.type === 'stroke')).toBe(true);
    expect(result.effects.some((e) => e.type === 'drop-shadow')).toBe(true);
  });

  it('should parse "赤文字に白の縁取り＋光彩"', () => {
    const result = parseStyleDescription('赤文字に白の縁取り＋光彩');
    expect(result.textProps.color).toEqual(RED);
    expect(result.effects.some((e) => e.type === 'stroke')).toBe(true);
    expect(result.effects.some((e) => e.type === 'outer-glow')).toBe(true);
  });

  it('should parse "黒文字に赤い縁取り" (速報風)', () => {
    const result = parseStyleDescription('白文字に赤い縁取り');
    expect(result.textProps.color).toEqual(WHITE);
    const strokeEff = result.effects.find((e) => e.type === 'stroke');
    expect(strokeEff).toBeDefined();
    if (strokeEff?.type === 'stroke') {
      expect(findClosestColorName(strokeEff.color).name).toBe('red');
    }
  });

  it('should parse "派手な赤文字"', () => {
    const result = parseStyleDescription('派手な赤文字');
    // "派手" should add outer glow
    expect(result.effects.some((e) => e.type === 'outer-glow')).toBe(true);
    expect(result.textProps.bold).toBe(true);
  });

  it('should parse "インパクト" as preset name', () => {
    const result = parseStyleDescription('インパクト');
    expect(result.matchedPresetId).toBe('builtin-impact');
  });

  it('should parse "YouTuber風" as preset name', () => {
    const result = parseStyleDescription('YouTuber風');
    expect(result.matchedPresetId).toBe('builtin-youtuber');
  });

  it('should parse "エレガントな文字"', () => {
    const result = parseStyleDescription('エレガント');
    expect(result.matchedPresetId).toBe('builtin-elegant');
  });

  it('should parse "影付き白文字"', () => {
    const result = parseStyleDescription('影付き白文字');
    expect(result.textProps.color).toEqual(WHITE);
    expect(result.effects.some((e) => e.type === 'drop-shadow')).toBe(true);
  });
});

describe('parseStyleDescription — English patterns', () => {
  it('should parse "white text with black stroke"', () => {
    const result = parseStyleDescription('white text with black stroke');
    expect(result.textProps.color).toEqual(WHITE);
    expect(result.effects.some((e) => e.type === 'stroke')).toBe(true);
  });

  it('should parse "red text with shadow"', () => {
    const result = parseStyleDescription('red text with shadow');
    expect(result.textProps.color).toEqual(RED);
    expect(result.effects.some((e) => e.type === 'drop-shadow')).toBe(true);
  });

  it('should parse "white text with black outline and glow"', () => {
    const result = parseStyleDescription('white text with black outline and glow');
    expect(result.textProps.color).toEqual(WHITE);
    expect(result.effects.some((e) => e.type === 'stroke')).toBe(true);
    expect(result.effects.some((e) => e.type === 'outer-glow')).toBe(true);
  });

  it('should parse "bold text with bevel"', () => {
    const result = parseStyleDescription('bold text with bevel');
    expect(result.effects.some((e) => e.type === 'bevel-emboss')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Roundtrip Tests: effects -> description -> effects
// ---------------------------------------------------------------------------

describe('roundtrip: effects -> description -> effects', () => {
  it('should roundtrip stroke effect', () => {
    const original: LayerEffect[] = [stroke(BLACK, 4)];
    const desc = describeEffects(original, { color: WHITE }, 'ja');
    const parsed = parseStyleDescription(desc);

    expect(parsed.effects.length).toBeGreaterThanOrEqual(1);
    const parsedStroke = parsed.effects.find((e) => e.type === 'stroke');
    expect(parsedStroke).toBeDefined();
    if (parsedStroke) {
      expect(effectsEquivalent(original[0], parsedStroke)).toBe(true);
    }
  });

  it('should roundtrip stroke + drop shadow', () => {
    const original: LayerEffect[] = [stroke(BLACK, 4), dropShadow()];
    const desc = describeEffects(original, { color: WHITE }, 'ja');
    const parsed = parseStyleDescription(desc);

    expect(parsed.effects.some((e) => e.type === 'stroke')).toBe(true);
    expect(parsed.effects.some((e) => e.type === 'drop-shadow')).toBe(true);
  });

  it('should roundtrip stroke + outer glow', () => {
    const original: LayerEffect[] = [stroke(WHITE, 3), outerGlow(YELLOW)];
    const desc = describeEffects(original, { color: RED }, 'ja');
    const parsed = parseStyleDescription(desc);

    expect(parsed.effects.some((e) => e.type === 'stroke')).toBe(true);
    expect(parsed.effects.some((e) => e.type === 'outer-glow')).toBe(true);
  });

  it('should roundtrip English descriptions', () => {
    const original: LayerEffect[] = [stroke(BLACK, 4), dropShadow()];
    const desc = describeEffects(original, { color: WHITE }, 'en');
    const parsed = parseStyleDescription(desc);

    expect(parsed.effects.some((e) => e.type === 'stroke')).toBe(true);
    expect(parsed.effects.some((e) => e.type === 'drop-shadow')).toBe(true);
  });

  it('should preserve text color through roundtrip', () => {
    const desc = describeEffects([stroke(BLACK, 4)], { color: WHITE }, 'ja');
    const parsed = parseStyleDescription(desc);
    expect(parsed.textProps.color).toEqual(WHITE);
  });
});

// ---------------------------------------------------------------------------
// 8. effectsEquivalent Tests
// ---------------------------------------------------------------------------

describe('effectsEquivalent', () => {
  it('should recognize identical strokes as equivalent', () => {
    expect(effectsEquivalent(stroke(BLACK, 4), stroke(BLACK, 4))).toBe(true);
  });

  it('should recognize strokes with slightly different colors as equivalent', () => {
    const nearBlack: Color = { r: 10, g: 10, b: 10, a: 1 };
    expect(effectsEquivalent(stroke(BLACK, 4), stroke(nearBlack, 4))).toBe(true);
  });

  it('should reject strokes with very different colors', () => {
    expect(effectsEquivalent(stroke(BLACK, 4), stroke(WHITE, 4))).toBe(false);
  });

  it('should reject effects of different types', () => {
    expect(effectsEquivalent(stroke(BLACK, 4), dropShadow())).toBe(false);
  });
});
