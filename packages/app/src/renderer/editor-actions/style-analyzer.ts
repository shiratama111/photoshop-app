/**
 * @module editor-actions/style-analyzer
 * Bidirectional conversion between layer effect parameters and natural language descriptions.
 *
 * Core functions:
 * - `describeEffects()` — LayerEffect[] -> natural language description (ja/en)
 * - `parseStyleDescription()` — natural language -> ParsedStyle (effects + text properties)
 * - `describeLayerStyle()` — full layer style description including font, size, color, effects
 *
 * Uses rule-based parsing with vocabulary lookups from style-vocabulary.ts.
 * Designed for Phase 3 extension to AI inference.
 *
 * @see STYLE-001: Style Analysis Engine
 * @see {@link ./style-vocabulary.ts} — vocabulary tables for color/adjective/effect names
 * @see {@link ../components/panels/text-style-presets.ts} — built-in presets (test data)
 * @see {@link ../../packages/types/src/effects.ts} — LayerEffect type definitions
 */

import type {
  Color,
  LayerEffect,
  StrokeEffect,
  DropShadowEffect,
  OuterGlowEffect,
  InnerShadowEffect,
  InnerGlowEffect,
  ColorOverlayEffect,
  GradientOverlayEffect,
  BevelEmbossEffect,
  EffectType,
} from '@photoshop-app/types';

import {
  lookupColor,
  getColorDisplayName,
  getEffectDisplayName,
  lookupPresetId,
  findAdjectives,
  COLOR_VOCABULARY,
  EFFECT_NAME_VOCABULARY,
  type StyleModifierBag,
} from './style-vocabulary';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Text style properties that can be extracted from/applied to a text layer. */
export interface TextStyleProps {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: Color;
  letterSpacing?: number;
  lineHeight?: number;
}

/** Result of parsing a natural language style description. */
export interface ParsedStyle {
  /** Extracted text properties (font, size, color, etc.). */
  textProps: TextStyleProps;
  /** Generated layer effects. */
  effects: LayerEffect[];
  /** If a built-in preset was matched, its ID. */
  matchedPresetId?: string;
  /** Original description that was parsed. */
  originalDescription: string;
}

/** Language option for description output. */
export type DescriptionLang = 'ja' | 'en';

// ---------------------------------------------------------------------------
// Effects -> Natural Language
// ---------------------------------------------------------------------------

/**
 * Convert a list of layer effects (and optional text properties) into a natural language description.
 *
 * @param effects - Array of LayerEffect objects to describe.
 * @param textProps - Optional text properties (color, font, etc.) for context.
 * @param lang - Output language ('ja' or 'en'). Defaults to 'ja'.
 * @returns A human-readable description of the style.
 *
 * @example
 * ```ts
 * describeEffects([stroke(black, 4px), dropShadow], { color: white }, 'ja')
 * // => "白文字に黒の縁取り＋影"
 * ```
 */
export function describeEffects(
  effects: LayerEffect[],
  textProps?: TextStyleProps,
  lang: DescriptionLang = 'ja',
): string {
  const enabledEffects = effects.filter((e) => e.enabled);
  const parts: string[] = [];

  // Text color prefix
  if (textProps?.color) {
    const colorName = getColorDisplayName(textProps.color, lang);
    if (lang === 'ja') {
      parts.push(`${colorName}文字`);
    } else {
      parts.push(`${colorName} text`);
    }
  }

  // Describe each effect
  for (const effect of enabledEffects) {
    parts.push(describeSingleEffect(effect, lang));
  }

  if (parts.length === 0) {
    return lang === 'ja' ? 'エフェクトなし' : 'no effects';
  }

  if (lang === 'ja') {
    // Join: first item, then append with "に" or "＋"
    if (parts.length === 1) return parts[0];
    // "白文字に黒の縁取り＋影" pattern
    return parts[0] + 'に' + parts.slice(1).join('＋');
  }
  // English: "white text with black stroke + drop shadow"
  if (parts.length === 1) return parts[0];
  return parts[0] + ' with ' + parts.slice(1).join(' + ');
}

/**
 * Generate a full description of a layer's style including font, size, color, and effects.
 *
 * @param layer - Object with text properties and effects.
 * @param lang - Output language ('ja' or 'en'). Defaults to 'ja'.
 * @returns A complete human-readable style description.
 *
 * @example
 * ```ts
 * describeLayerStyle({ fontFamily: 'Impact', fontSize: 72, bold: true, color: white, effects: [...] })
 * // => "Impact 72px 太字 白文字に黒の縁取り＋影"
 * ```
 */
export function describeLayerStyle(
  layer: TextStyleProps & { effects: LayerEffect[] },
  lang: DescriptionLang = 'ja',
): string {
  const fontParts: string[] = [];

  if (layer.fontFamily) {
    fontParts.push(layer.fontFamily);
  }
  if (layer.fontSize) {
    fontParts.push(`${layer.fontSize}px`);
  }
  if (layer.bold) {
    fontParts.push(lang === 'ja' ? '太字' : 'bold');
  }
  if (layer.italic) {
    fontParts.push(lang === 'ja' ? 'イタリック' : 'italic');
  }

  const effectDesc = describeEffects(layer.effects, { color: layer.color }, lang);

  if (fontParts.length === 0) return effectDesc;
  return fontParts.join(' ') + ' ' + effectDesc;
}

// ---------------------------------------------------------------------------
// Natural Language -> Effects
// ---------------------------------------------------------------------------

/**
 * Parse a natural language style description into effect parameters and text properties.
 *
 * Supports Japanese and English input. Uses rule-based parsing with vocabulary lookups.
 *
 * @param description - Natural language style description.
 * @returns ParsedStyle with extracted text properties and effects.
 *
 * @example
 * ```ts
 * parseStyleDescription("白文字に黒縁取り")
 * // => { textProps: { color: white }, effects: [stroke(black, 4px)] }
 *
 * parseStyleDescription("YouTuber風")
 * // => { matchedPresetId: "builtin-youtuber", ... }
 * ```
 */
export function parseStyleDescription(description: string): ParsedStyle {
  const result: ParsedStyle = {
    textProps: {},
    effects: [],
    originalDescription: description,
  };

  // 1. Check for preset name match first
  const presetId = lookupPresetId(description.trim());
  if (presetId) {
    result.matchedPresetId = presetId;
    // Still continue parsing to extract what we can
  }

  // 2. Extract text color
  const textColor = extractTextColor(description);
  if (textColor) {
    result.textProps.color = textColor;
  }

  // 3. Extract effects from description
  const parsedEffects = extractEffects(description);
  result.effects = parsedEffects;

  // 4. Apply adjective modifiers
  const adjectives = findAdjectives(description);
  const modBag: StyleModifierBag = {};
  for (const adj of adjectives) {
    adj.apply(modBag);
  }

  // Apply modifier bag to text props
  if (modBag.fontSize !== undefined) {
    result.textProps.fontSize = modBag.fontSize;
  }
  if (modBag.bold !== undefined) {
    result.textProps.bold = modBag.bold;
  }

  // Apply modifier bag to effects
  if (modBag.strokeSize !== undefined) {
    for (const effect of result.effects) {
      if (effect.type === 'stroke') {
        (effect as StrokeEffect).size = modBag.strokeSize;
      }
    }
  }
  if (modBag.opacity !== undefined) {
    for (const effect of result.effects) {
      if ('opacity' in effect) {
        (effect as StrokeEffect).opacity = modBag.opacity;
      }
    }
  }
  if (modBag.addOuterGlow && !result.effects.some((e) => e.type === 'outer-glow')) {
    const glowColor = result.textProps.color
      ? { ...result.textProps.color }
      : { r: 255, g: 255, b: 0, a: 1 };
    result.effects.push(createDefaultOuterGlow(glowColor));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal: Describe a Single Effect
// ---------------------------------------------------------------------------

/**
 * Describe a single layer effect in natural language.
 * @param effect - The effect to describe.
 * @param lang - Output language.
 * @returns A human-readable description fragment.
 */
function describeSingleEffect(effect: LayerEffect, lang: DescriptionLang): string {
  switch (effect.type) {
    case 'stroke':
      return describeStroke(effect, lang);
    case 'drop-shadow':
      return describeDropShadow(effect, lang);
    case 'outer-glow':
      return describeOuterGlow(effect, lang);
    case 'inner-shadow':
      return describeInnerShadow(effect, lang);
    case 'inner-glow':
      return describeInnerGlow(effect, lang);
    case 'color-overlay':
      return describeColorOverlay(effect, lang);
    case 'gradient-overlay':
      return describeGradientOverlay(effect, lang);
    case 'bevel-emboss':
      return describeBevelEmboss(effect, lang);
  }
}

/** Describe a stroke effect. */
function describeStroke(effect: StrokeEffect, lang: DescriptionLang): string {
  const colorName = getColorDisplayName(effect.color, lang);
  const sizeDesc = describeSizeAdjective(effect.size, lang);
  const effectName = getEffectDisplayName('stroke', lang);
  if (lang === 'ja') {
    return sizeDesc ? `${colorName}の${sizeDesc}${effectName}` : `${colorName}の${effectName}`;
  }
  return sizeDesc ? `${sizeDesc} ${colorName} ${effectName}` : `${colorName} ${effectName}`;
}

/** Describe a drop shadow effect. */
function describeDropShadow(_effect: DropShadowEffect, lang: DescriptionLang): string {
  return getEffectDisplayName('drop-shadow', lang);
}

/** Describe an outer glow effect. */
function describeOuterGlow(effect: OuterGlowEffect, lang: DescriptionLang): string {
  const colorName = getColorDisplayName(effect.color, lang);
  const effectName = getEffectDisplayName('outer-glow', lang);
  if (lang === 'ja') {
    return `${colorName}の${effectName}`;
  }
  return `${colorName} ${effectName}`;
}

/** Describe an inner shadow effect. */
function describeInnerShadow(_effect: InnerShadowEffect, lang: DescriptionLang): string {
  return getEffectDisplayName('inner-shadow', lang);
}

/** Describe an inner glow effect. */
function describeInnerGlow(effect: InnerGlowEffect, lang: DescriptionLang): string {
  const colorName = getColorDisplayName(effect.color, lang);
  const effectName = getEffectDisplayName('inner-glow', lang);
  if (lang === 'ja') {
    return `${colorName}の${effectName}`;
  }
  return `${colorName} ${effectName}`;
}

/** Describe a color overlay effect. */
function describeColorOverlay(effect: ColorOverlayEffect, lang: DescriptionLang): string {
  const colorName = getColorDisplayName(effect.color, lang);
  const effectName = getEffectDisplayName('color-overlay', lang);
  if (lang === 'ja') {
    return `${colorName}の${effectName}`;
  }
  return `${colorName} ${effectName}`;
}

/** Describe a gradient overlay effect. */
function describeGradientOverlay(effect: GradientOverlayEffect, lang: DescriptionLang): string {
  const effectName = getEffectDisplayName('gradient-overlay', lang);

  // Handle both stops-based and startColor/endColor-based gradients
  const gradientEffect = effect as GradientOverlayEffect & {
    startColor?: Color;
    endColor?: Color;
  };

  let startColor: Color | undefined;
  let endColor: Color | undefined;

  if (gradientEffect.startColor && gradientEffect.endColor) {
    startColor = gradientEffect.startColor;
    endColor = gradientEffect.endColor;
  } else if (gradientEffect.stops && gradientEffect.stops.length >= 2) {
    startColor = gradientEffect.stops[0].color;
    endColor = gradientEffect.stops[gradientEffect.stops.length - 1].color;
  }

  if (startColor && endColor) {
    const startName = getColorDisplayName(startColor, lang);
    const endName = getColorDisplayName(endColor, lang);
    if (lang === 'ja') {
      return `${startName}→${endName}の${effectName}`;
    }
    return `${startName} to ${endName} ${effectName}`;
  }

  return effectName;
}

/** Describe a bevel & emboss effect. */
function describeBevelEmboss(_effect: BevelEmbossEffect, lang: DescriptionLang): string {
  return getEffectDisplayName('bevel-emboss', lang);
}

/**
 * Describe a stroke size as an adjective.
 * @param size - Stroke size in pixels.
 * @param lang - Output language.
 * @returns Size adjective or empty string for normal sizes.
 */
function describeSizeAdjective(size: number, lang: DescriptionLang): string {
  if (size >= 5) return lang === 'ja' ? '太い' : 'thick';
  if (size <= 1) return lang === 'ja' ? '細い' : 'thin';
  return '';
}

// ---------------------------------------------------------------------------
// Internal: Extract Text Color from Description
// ---------------------------------------------------------------------------

/**
 * Extract a text color from a natural language description.
 * Looks for patterns like "白文字", "white text", "赤い文字", etc.
 * Builds a regex from known color vocabulary to avoid false matches.
 * @param desc - The description to parse.
 * @returns The extracted Color or undefined.
 */
function extractTextColor(desc: string): Color | undefined {
  // Japanese: build pattern from known color aliases + "文字"
  // Check each known color alias followed by optional connectors + "文字"
  for (const entry of COLOR_VOCABULARY) {
    for (const alias of entry.ja) {
      // Match: alias + optional(色/い/の) + 文字
      const pattern = new RegExp(escapeRegex(alias) + '(?:色)?(?:い|の)?文字');
      if (pattern.test(desc)) {
        return { ...entry.color };
      }
    }
  }

  // English patterns: "white text", "red text"
  const enTextColorRegex = /(\w+)\s+text/i;
  const enMatch = desc.match(enTextColorRegex);
  if (enMatch) {
    const color = lookupColor(enMatch[1]);
    if (color) return color;
  }

  return undefined;
}

/**
 * Escape special regex characters in a string.
 * @param str - The string to escape.
 * @returns The escaped string safe for use in RegExp constructor.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Internal: Extract Effects from Description
// ---------------------------------------------------------------------------

/**
 * Extract layer effects from a natural language description.
 * Uses pattern matching for Japanese and English effect names with optional color prefixes.
 * @param desc - The description to parse.
 * @returns Array of extracted LayerEffect objects.
 */
function extractEffects(desc: string): LayerEffect[] {
  const effects: LayerEffect[] = [];

  // Try to extract strokes: "黒の縁取り", "黒縁取り", "赤い太い縁取り", "black stroke"
  const strokeEffect = extractStrokeFromDesc(desc);
  if (strokeEffect) effects.push(strokeEffect);

  // Try to extract drop shadows: "影", "影付き", "shadow", "drop shadow"
  if (hasEffectMention(desc, 'drop-shadow')) {
    effects.push(createDefaultDropShadow());
  }

  // Try to extract outer glow: "光彩", "glow"
  const glowEffect = extractOuterGlowFromDesc(desc);
  if (glowEffect) effects.push(glowEffect);

  // Try to extract inner shadow: "内側影", "inner shadow"
  if (hasEffectMention(desc, 'inner-shadow')) {
    effects.push(createDefaultInnerShadow());
  }

  // Try to extract inner glow: "内側光彩", "inner glow"
  if (hasEffectMention(desc, 'inner-glow')) {
    effects.push(createDefaultInnerGlow());
  }

  // Try to extract color overlay: "カラーオーバーレイ", "color overlay"
  const overlayEffect = extractColorOverlayFromDesc(desc);
  if (overlayEffect) effects.push(overlayEffect);

  // Try to extract gradient overlay: "グラデーション", "gradient"
  const gradientEffect = extractGradientOverlayFromDesc(desc);
  if (gradientEffect) effects.push(gradientEffect);

  // Try to extract bevel-emboss: "ベベル", "エンボス", "立体", "bevel"
  if (hasEffectMention(desc, 'bevel-emboss')) {
    effects.push(createDefaultBevelEmboss());
  }

  return effects;
}

/**
 * Check if the description mentions a specific effect type.
 * @param desc - The description to search.
 * @param effectType - The effect type to check for.
 * @returns True if the effect is mentioned.
 */
function hasEffectMention(desc: string, effectType: EffectType): boolean {
  const normalized = desc.toLowerCase();
  for (const entry of EFFECT_NAME_VOCABULARY) {
    if (entry.effectType !== effectType) continue;
    for (const alias of entry.ja) {
      if (desc.includes(alias)) return true;
    }
    for (const alias of entry.en) {
      if (normalized.includes(alias.toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * Extract a stroke effect from description, with optional color prefix.
 * Patterns: "黒の縁取り", "黒縁取り", "red stroke", "black outline"
 */
function extractStrokeFromDesc(desc: string): StrokeEffect | undefined {
  if (!hasEffectMention(desc, 'stroke')) return undefined;

  // Try to find color before the stroke keyword
  let strokeColor: Color = { r: 0, g: 0, b: 0, a: 1 }; // default black

  // Japanese: "(色)の縁取り" or "(色)縁取り"
  const jaStrokePattern = /([^\s、。に＋+]+?)(?:色)?(?:の)?(?:太い|細い|太め)?(?:縁取り|ふちどり|フチドリ|アウトライン|輪郭|枠線|境界線)/;
  const jaMatch = desc.match(jaStrokePattern);
  if (jaMatch) {
    const color = lookupColor(jaMatch[1]);
    if (color) strokeColor = color;
  }

  // English: "black stroke", "red outline"
  const enStrokePattern = /(\w+)\s+(?:stroke|outline|border)/i;
  const enMatch = desc.match(enStrokePattern);
  if (enMatch) {
    const color = lookupColor(enMatch[1]);
    if (color) strokeColor = color;
  }

  return {
    type: 'stroke',
    enabled: true,
    color: strokeColor,
    size: 4,
    position: 'outside',
    opacity: 1,
  };
}

/**
 * Extract an outer glow effect from description, with optional color.
 */
function extractOuterGlowFromDesc(desc: string): OuterGlowEffect | undefined {
  if (!hasEffectMention(desc, 'outer-glow')) return undefined;

  let glowColor: Color = { r: 255, g: 255, b: 0, a: 1 }; // default yellow

  // Japanese color prefix
  const jaGlowPattern = /([^\s、。に＋+]+?)(?:色)?(?:の)?(?:光彩|外側光彩|グロー|外側グロー|発光|光)/;
  const jaMatch = desc.match(jaGlowPattern);
  if (jaMatch) {
    const color = lookupColor(jaMatch[1]);
    if (color) glowColor = color;
  }

  // English color prefix
  const enGlowPattern = /(\w+)\s+(?:glow|outer[- ]?glow)/i;
  const enMatch = desc.match(enGlowPattern);
  if (enMatch) {
    const color = lookupColor(enMatch[1]);
    if (color) glowColor = color;
  }

  return createDefaultOuterGlow(glowColor);
}

/**
 * Extract a color overlay from description.
 */
function extractColorOverlayFromDesc(desc: string): ColorOverlayEffect | undefined {
  if (!hasEffectMention(desc, 'color-overlay')) return undefined;

  return {
    type: 'color-overlay',
    enabled: true,
    color: { r: 255, g: 0, b: 0, a: 1 },
    opacity: 0.8,
  };
}

/**
 * Extract a gradient overlay from description.
 * Note: We avoid matching when "グラデ" appears as part of a preset name like "グラデ文字"
 * unless the description explicitly requests a gradient overlay effect.
 */
function extractGradientOverlayFromDesc(desc: string): GradientOverlayEffect | undefined {
  // Only match explicit gradient overlay keywords, not general "グラデ" which could be a preset name
  const explicitJaKeywords = ['グラデーションオーバーレイ'];
  const explicitEnKeywords = ['gradient-overlay', 'gradient overlay'];
  const normalized = desc.toLowerCase();

  const hasExplicitMention =
    explicitJaKeywords.some((kw) => desc.includes(kw)) ||
    explicitEnKeywords.some((kw) => normalized.includes(kw));

  if (!hasExplicitMention) return undefined;

  return {
    type: 'gradient-overlay',
    enabled: true,
    opacity: 1,
    angle: 90,
    gradientType: 'linear',
    stops: [
      { position: 0, color: { r: 255, g: 215, b: 0, a: 1 } },
      { position: 1, color: { r: 255, g: 69, b: 0, a: 1 } },
    ],
    reverse: false,
    scale: 100,
  };
}

// ---------------------------------------------------------------------------
// Default Effect Factories
// ---------------------------------------------------------------------------

/** Create a default outer glow effect with the given color. */
function createDefaultOuterGlow(color: Color): OuterGlowEffect {
  return {
    type: 'outer-glow',
    enabled: true,
    color,
    opacity: 0.6,
    size: 10,
    spread: 0,
  };
}

/** Create a default drop shadow effect. */
function createDefaultDropShadow(): DropShadowEffect {
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

/** Create a default inner shadow effect. */
function createDefaultInnerShadow(): InnerShadowEffect {
  return {
    type: 'inner-shadow',
    enabled: true,
    color: { r: 0, g: 0, b: 0, a: 0.5 },
    opacity: 0.5,
    angle: 135,
    distance: 3,
    blur: 5,
    choke: 0,
  };
}

/** Create a default inner glow effect. */
function createDefaultInnerGlow(): InnerGlowEffect {
  return {
    type: 'inner-glow',
    enabled: true,
    color: { r: 255, g: 255, b: 255, a: 1 },
    opacity: 0.5,
    size: 10,
    choke: 0,
    source: 'edge',
  };
}

/** Create a default bevel & emboss effect. */
function createDefaultBevelEmboss(): BevelEmbossEffect {
  return {
    type: 'bevel-emboss',
    enabled: true,
    style: 'inner-bevel',
    depth: 100,
    direction: 'up',
    size: 5,
    soften: 0,
    angle: 120,
    altitude: 30,
    highlightColor: { r: 255, g: 255, b: 255, a: 1 },
    highlightOpacity: 0.75,
    shadowColor: { r: 0, g: 0, b: 0, a: 1 },
    shadowOpacity: 0.75,
  };
}

// ---------------------------------------------------------------------------
// Utility: Compare Effects for Roundtrip Testing
// ---------------------------------------------------------------------------

/**
 * Check if two effects are semantically equivalent (same type, similar parameters).
 * Used primarily for roundtrip testing.
 *
 * @param a - First effect.
 * @param b - Second effect.
 * @returns True if the effects are semantically equivalent.
 */
export function effectsEquivalent(a: LayerEffect, b: LayerEffect): boolean {
  if (a.type !== b.type) return false;
  if (a.enabled !== b.enabled) return false;

  switch (a.type) {
    case 'stroke': {
      const bs = b as StrokeEffect;
      const as_ = a as StrokeEffect;
      return colorsClose(as_.color, bs.color) && as_.position === bs.position;
    }
    case 'drop-shadow':
      return true; // type match is sufficient for roundtrip
    case 'outer-glow': {
      const ao = a as OuterGlowEffect;
      const bo = b as OuterGlowEffect;
      return colorsClose(ao.color, bo.color);
    }
    case 'inner-shadow':
      return true;
    case 'inner-glow':
      return true;
    case 'color-overlay': {
      const ac = a as ColorOverlayEffect;
      const bc = b as ColorOverlayEffect;
      return colorsClose(ac.color, bc.color);
    }
    case 'gradient-overlay':
      return true; // type match sufficient
    case 'bevel-emboss':
      return true;
  }
}

/**
 * Check if two colors are close enough (within tolerance in each RGB channel).
 * @param a - First color.
 * @param b - Second color.
 * @param tolerance - Maximum per-channel difference (default: 50).
 * @returns True if the colors are close.
 */
function colorsClose(a: Color, b: Color, tolerance = 50): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance
  );
}
