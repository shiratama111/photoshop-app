/**
 * @module editor-actions/style-vocabulary
 * Style vocabulary dictionary for bidirectional natural language <-> effect parameter conversion.
 *
 * Provides mappings for:
 * - Color names (Japanese + English) -> RGB values
 * - Adjective descriptors -> effect parameter modifiers
 * - Style names (preset aliases) -> preset IDs
 * - Effect type names (Japanese + English) -> EffectType discriminators
 *
 * @see STYLE-001: Style Analysis Engine
 * @see {@link ./style-analyzer.ts} — consumer of these vocabulary tables
 * @see {@link ../components/panels/text-style-presets.ts} — built-in presets referenced by style names
 */

import type { Color, EffectType } from '@photoshop-app/types';

// ---------------------------------------------------------------------------
// Color Name Mapping
// ---------------------------------------------------------------------------

/** A named color entry with Japanese aliases, English aliases, and RGB value. */
export interface NamedColor {
  /** Canonical English name (used as key). */
  name: string;
  /** Japanese aliases for this color. */
  ja: readonly string[];
  /** English aliases for this color. */
  en: readonly string[];
  /** RGB color value (alpha always 1). */
  color: Color;
}

/** Complete color vocabulary table. */
export const COLOR_VOCABULARY: readonly NamedColor[] = [
  { name: 'white', ja: ['白', '白色', 'しろ'], en: ['white'], color: { r: 255, g: 255, b: 255, a: 1 } },
  { name: 'black', ja: ['黒', '黒色', 'くろ'], en: ['black'], color: { r: 0, g: 0, b: 0, a: 1 } },
  { name: 'red', ja: ['赤', '赤色', 'あか', '赤い'], en: ['red'], color: { r: 255, g: 0, b: 0, a: 1 } },
  { name: 'blue', ja: ['青', '青色', 'あお', '青い'], en: ['blue'], color: { r: 0, g: 0, b: 255, a: 1 } },
  { name: 'green', ja: ['緑', '緑色', 'みどり'], en: ['green'], color: { r: 0, g: 128, b: 0, a: 1 } },
  { name: 'yellow', ja: ['黄色', '黄', 'きいろ'], en: ['yellow'], color: { r: 255, g: 255, b: 0, a: 1 } },
  { name: 'orange', ja: ['オレンジ', 'だいだい', '橙'], en: ['orange'], color: { r: 255, g: 165, b: 0, a: 1 } },
  { name: 'pink', ja: ['ピンク', '桃色'], en: ['pink'], color: { r: 255, g: 105, b: 180, a: 1 } },
  { name: 'purple', ja: ['紫', '紫色', 'むらさき'], en: ['purple'], color: { r: 128, g: 0, b: 128, a: 1 } },
  { name: 'gold', ja: ['金色', '金', 'ゴールド'], en: ['gold', 'golden'], color: { r: 212, g: 175, b: 55, a: 1 } },
  { name: 'silver', ja: ['銀色', '銀', 'シルバー'], en: ['silver'], color: { r: 192, g: 192, b: 192, a: 1 } },
  { name: 'neon-green', ja: ['ネオン', 'ネオングリーン'], en: ['neon', 'neon-green'], color: { r: 57, g: 255, b: 20, a: 1 } },
  { name: 'cyan', ja: ['シアン', '水色'], en: ['cyan', 'aqua'], color: { r: 0, g: 255, b: 255, a: 1 } },
  { name: 'brown', ja: ['茶色', '茶', 'ちゃいろ'], en: ['brown'], color: { r: 139, g: 69, b: 19, a: 1 } },
  { name: 'gray', ja: ['灰色', 'グレー', '灰'], en: ['gray', 'grey'], color: { r: 128, g: 128, b: 128, a: 1 } },
] as const;

// ---------------------------------------------------------------------------
// Adjective Mapping
// ---------------------------------------------------------------------------

/** Modifier applied by an adjective to style parameters. */
export interface AdjectiveModifier {
  /** Canonical English name. */
  name: string;
  /** Japanese keywords that trigger this modifier. */
  ja: readonly string[];
  /** English keywords that trigger this modifier. */
  en: readonly string[];
  /** What this modifier does (for describeEffects use). */
  description: { ja: string; en: string };
  /** Modifications to apply: function that mutates a style parameter bag. */
  apply: (params: StyleModifierBag) => void;
}

/** Mutable bag of style parameters that adjective modifiers can tweak. */
export interface StyleModifierBag {
  /** Stroke size override. */
  strokeSize?: number;
  /** Overall opacity override. */
  opacity?: number;
  /** Whether to add outer glow. */
  addOuterGlow?: boolean;
  /** Font size override. */
  fontSize?: number;
  /** Bold override. */
  bold?: boolean;
  /** Whether to use saturated colors. */
  saturated?: boolean;
}

/** Adjective vocabulary table. */
export const ADJECTIVE_VOCABULARY: readonly AdjectiveModifier[] = [
  {
    name: 'thick',
    ja: ['太い', '太め', '太く', '太字'],
    en: ['thick', 'bold', 'heavy'],
    description: { ja: '太い', en: 'thick' },
    apply: (p: StyleModifierBag): void => { p.strokeSize = 6; p.bold = true; p.fontSize = 80; },
  },
  {
    name: 'thin',
    ja: ['薄い', '細い', '細め', '繊細'],
    en: ['thin', 'light', 'subtle', 'delicate'],
    description: { ja: '薄い', en: 'thin' },
    apply: (p: StyleModifierBag): void => { p.strokeSize = 1; p.opacity = 0.6; },
  },
  {
    name: 'flashy',
    ja: ['派手', '派手な', '目立つ', 'ド派手'],
    en: ['flashy', 'vivid', 'eye-catching', 'loud'],
    description: { ja: '派手な', en: 'flashy' },
    apply: (p: StyleModifierBag): void => { p.addOuterGlow = true; p.saturated = true; p.bold = true; },
  },
  {
    name: 'large',
    ja: ['大きい', '大きな', 'でかい', 'デカい', '巨大'],
    en: ['large', 'big', 'huge'],
    description: { ja: '大きい', en: 'large' },
    apply: (p: StyleModifierBag): void => { p.fontSize = 96; },
  },
  {
    name: 'small',
    ja: ['小さい', '小さな', '小さめ'],
    en: ['small', 'tiny'],
    description: { ja: '小さい', en: 'small' },
    apply: (p: StyleModifierBag): void => { p.fontSize = 32; },
  },
] as const;

// ---------------------------------------------------------------------------
// Style Name Mapping (Natural Language -> Preset ID)
// ---------------------------------------------------------------------------

/** Maps natural language style names to built-in preset IDs. */
export interface StyleNameMapping {
  /** Built-in preset ID (matches TextStylePreset.id). */
  presetId: string;
  /** Japanese aliases. */
  ja: readonly string[];
  /** English aliases. */
  en: readonly string[];
}

/** Style name vocabulary table. */
export const STYLE_NAME_VOCABULARY: readonly StyleNameMapping[] = [
  {
    presetId: 'builtin-youtuber',
    ja: ['YouTuber風', 'ユーチューバー風', 'YouTuber定番', 'YouTube風', 'サムネ風'],
    en: ['youtuber', 'youtuber-style', 'youtube-style', 'thumbnail-style'],
  },
  {
    presetId: 'builtin-impact',
    ja: ['インパクト', 'インパクト文字', 'インパクトのある'],
    en: ['impact', 'impactful'],
  },
  {
    presetId: 'builtin-elegant',
    ja: ['エレガント', 'エレガントな', '上品', '上品な', 'おしゃれ'],
    en: ['elegant', 'classy', 'sophisticated'],
  },
  {
    presetId: 'builtin-pop',
    ja: ['ポップ', 'ポップな', 'かわいい', 'カワイイ'],
    en: ['pop', 'cute', 'playful'],
  },
  {
    presetId: 'builtin-breaking',
    ja: ['速報風', '速報', 'ニュース風', 'テロップ風', 'テロップ'],
    en: ['breaking', 'breaking-news', 'news-style', 'telop'],
  },
  {
    presetId: 'builtin-simple-black',
    ja: ['シンプル黒', 'シンプル', 'シンプルな'],
    en: ['simple-black', 'simple', 'plain'],
  },
  {
    presetId: 'builtin-gradient-text',
    ja: ['グラデ文字', 'グラデーション', 'グラデ'],
    en: ['gradient', 'gradient-text'],
  },
  {
    presetId: 'builtin-outlined',
    ja: ['縁取り', '縁取り文字', 'アウトライン'],
    en: ['outlined', 'outline'],
  },
] as const;

// ---------------------------------------------------------------------------
// Effect Type Name Mapping
// ---------------------------------------------------------------------------

/** Maps natural language effect names to EffectType discriminators. */
export interface EffectNameMapping {
  /** Effect type discriminator. */
  effectType: EffectType;
  /** Japanese names/aliases. */
  ja: readonly string[];
  /** English names/aliases. */
  en: readonly string[];
  /** Display name for description output. */
  displayName: { ja: string; en: string };
}

/** Effect name vocabulary table. */
export const EFFECT_NAME_VOCABULARY: readonly EffectNameMapping[] = [
  {
    effectType: 'stroke',
    ja: ['縁取り', 'ふちどり', 'フチドリ', 'アウトライン', '輪郭', '枠線', '境界線'],
    en: ['stroke', 'outline', 'border'],
    displayName: { ja: '縁取り', en: 'stroke' },
  },
  {
    effectType: 'drop-shadow',
    ja: ['影', 'ドロップシャドウ', 'シャドウ', '影付き', '落ち影'],
    en: ['shadow', 'drop-shadow', 'drop shadow'],
    displayName: { ja: '影', en: 'drop shadow' },
  },
  {
    effectType: 'outer-glow',
    ja: ['光彩', '外側光彩', 'グロー', '外側グロー', '発光', '光'],
    en: ['glow', 'outer-glow', 'outer glow'],
    displayName: { ja: '光彩', en: 'outer glow' },
  },
  {
    effectType: 'inner-shadow',
    ja: ['内側影', 'インナーシャドウ', '内部シャドウ'],
    en: ['inner-shadow', 'inner shadow', 'inset shadow'],
    displayName: { ja: '内側影', en: 'inner shadow' },
  },
  {
    effectType: 'inner-glow',
    ja: ['内側光彩', 'インナーグロー', '内部グロー', '内側発光'],
    en: ['inner-glow', 'inner glow'],
    displayName: { ja: '内側光彩', en: 'inner glow' },
  },
  {
    effectType: 'color-overlay',
    ja: ['カラーオーバーレイ', '色重ね', '色オーバーレイ'],
    en: ['color-overlay', 'color overlay'],
    displayName: { ja: 'カラーオーバーレイ', en: 'color overlay' },
  },
  {
    effectType: 'gradient-overlay',
    ja: ['グラデーションオーバーレイ', 'グラデーション', 'グラデ'],
    en: ['gradient-overlay', 'gradient overlay', 'gradient'],
    displayName: { ja: 'グラデーション', en: 'gradient overlay' },
  },
  {
    effectType: 'bevel-emboss',
    ja: ['ベベル', 'エンボス', 'ベベルエンボス', '立体', '立体感', '3D'],
    en: ['bevel', 'emboss', 'bevel-emboss', '3d'],
    displayName: { ja: 'ベベル・エンボス', en: 'bevel & emboss' },
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup Utilities
// ---------------------------------------------------------------------------

/**
 * Look up a color by name (Japanese or English, case-insensitive).
 * @param name - Color name to search for.
 * @returns The matching Color or undefined if not found.
 */
export function lookupColor(name: string): Color | undefined {
  const normalized = name.toLowerCase().trim();
  for (const entry of COLOR_VOCABULARY) {
    for (const alias of entry.ja) {
      if (alias === normalized || alias === name.trim()) return { ...entry.color };
    }
    for (const alias of entry.en) {
      if (alias.toLowerCase() === normalized) return { ...entry.color };
    }
  }
  return undefined;
}

/**
 * Find the closest named color for an RGB value.
 * Uses Euclidean distance in RGB space.
 * @param color - The color to match.
 * @returns The closest NamedColor entry.
 */
export function findClosestColorName(color: Color): NamedColor {
  let best: NamedColor = COLOR_VOCABULARY[0];
  let bestDist = Infinity;
  for (const entry of COLOR_VOCABULARY) {
    const dr = color.r - entry.color.r;
    const dg = color.g - entry.color.g;
    const db = color.b - entry.color.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

/**
 * Look up an EffectType by natural language name (Japanese or English).
 * @param name - Effect name to search for.
 * @returns The matching EffectType or undefined if not found.
 */
export function lookupEffectType(name: string): EffectType | undefined {
  const normalized = name.toLowerCase().trim();
  for (const entry of EFFECT_NAME_VOCABULARY) {
    for (const alias of entry.ja) {
      if (alias === normalized || alias === name.trim()) return entry.effectType;
    }
    for (const alias of entry.en) {
      if (alias.toLowerCase() === normalized) return entry.effectType;
    }
  }
  return undefined;
}

/**
 * Look up the display name for an EffectType.
 * @param effectType - The effect type discriminator.
 * @param lang - Language ('ja' or 'en').
 * @returns The display name string.
 */
export function getEffectDisplayName(effectType: EffectType, lang: 'ja' | 'en'): string {
  for (const entry of EFFECT_NAME_VOCABULARY) {
    if (entry.effectType === effectType) return entry.displayName[lang];
  }
  return effectType;
}

/**
 * Look up a preset ID by natural language style name.
 * @param name - Style name to search for.
 * @returns The matching preset ID or undefined.
 */
export function lookupPresetId(name: string): string | undefined {
  const normalized = name.toLowerCase().trim();
  for (const entry of STYLE_NAME_VOCABULARY) {
    for (const alias of entry.ja) {
      if (alias === normalized || alias === name.trim()) return entry.presetId;
    }
    for (const alias of entry.en) {
      if (alias.toLowerCase() === normalized) return entry.presetId;
    }
  }
  return undefined;
}

/**
 * Find adjective modifiers that match the given text.
 * @param text - Text to search for adjective keywords.
 * @returns Array of matching AdjectiveModifier entries.
 */
export function findAdjectives(text: string): readonly AdjectiveModifier[] {
  const normalized = text.toLowerCase();
  const matches: AdjectiveModifier[] = [];
  for (const entry of ADJECTIVE_VOCABULARY) {
    const found = entry.ja.some((alias) => normalized.includes(alias) || text.includes(alias))
      || entry.en.some((alias) => normalized.includes(alias.toLowerCase()));
    if (found) matches.push(entry);
  }
  return matches;
}

/**
 * Get the color name for display in the given language.
 * @param color - The color to describe.
 * @param lang - Language ('ja' or 'en').
 * @returns The color name string.
 */
export function getColorDisplayName(color: Color, lang: 'ja' | 'en'): string {
  const closest = findClosestColorName(color);
  return lang === 'ja' ? closest.ja[0] : closest.en[0];
}
