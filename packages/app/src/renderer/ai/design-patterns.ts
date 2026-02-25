/**
 * @module ai/design-patterns
 * Design pattern database for thumbnail generation.
 *
 * Contains category-specific templates with predefined:
 * - Background style (solid / gradient / pattern)
 * - Text layer positions, sizes, and styles
 * - Color palette (primary, secondary, accent, text)
 * - Recommended effects for text layers
 * - Color psychology rules
 *
 * Categories:
 *   1. News / Breaking  (ニュース系)
 *   2. How-To / Tutorial (How-To系)
 *   3. Vlog / Personal  (Vlog系)
 *   4. Product / Review  (商品紹介系)
 *   5. Gaming           (ゲーム実況系)
 *   6. Comparison / VS  (比較・対決系)
 *
 * @see THUMB-001: Thumbnail Architect
 * @see {@link ./design-schema.ts} — ThumbnailDesign type
 * @see {@link ./thumbnail-architect.ts} — consumer
 */

import type { Color } from '@photoshop-app/types';
import type { BackgroundDesign, TextLayerDesign } from './design-schema';

// ---------------------------------------------------------------------------
// Color Palettes
// ---------------------------------------------------------------------------

/** Named color palette for a design pattern. */
export interface ColorPalette {
  /** Primary / dominant color. */
  primary: Color;
  /** Secondary color (background accent). */
  secondary: Color;
  /** Accent / highlight color. */
  accent: Color;
  /** Main text color. */
  text: Color;
  /** Sub-text / secondary text color. */
  subText: Color;
}

// ---------------------------------------------------------------------------
// Text Layer Template
// ---------------------------------------------------------------------------

/** Template for a text layer within a design pattern (positions use 0-1 ratios). */
export interface TextLayerTemplate {
  /** Role of this text layer. */
  role: 'title' | 'subtitle' | 'accent' | 'label';
  /** Horizontal position ratio (0-1, fraction of canvas width). */
  xRatio: number;
  /** Vertical position ratio (0-1, fraction of canvas height). */
  yRatio: number;
  /** Font size in pixels (for 1280x720 canvas; scaled proportionally for other sizes). */
  fontSize: number;
  /** Font family suggestion. */
  fontFamily: string;
  /** Whether to render bold. */
  bold: boolean;
  /** Whether to render italic. */
  italic: boolean;
  /** Alignment. */
  alignment: 'left' | 'center' | 'right';
  /** Which palette color to use for the text. */
  colorKey: keyof ColorPalette;
  /** Effect templates to apply (as partial effect objects). */
  effects: ReadonlyArray<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Design Pattern
// ---------------------------------------------------------------------------

/** A complete design pattern template. */
export interface DesignPattern {
  /** Unique category ID. */
  id: string;
  /** Display name (Japanese). */
  nameJa: string;
  /** Display name (English). */
  nameEn: string;
  /** Mood / emotional tone. */
  mood: string;
  /** Background template. */
  background: BackgroundDesign;
  /** Color palette. */
  palette: ColorPalette;
  /** Text layer templates (ordered bottom to top). */
  textLayers: readonly TextLayerTemplate[];
  /** Whether to include concentration lines. */
  concentrationLines: boolean;
  /** Whether to include a border frame. */
  borderFrame: boolean;
}

// ---------------------------------------------------------------------------
// Color Psychology Rules
// ---------------------------------------------------------------------------

/** Color psychology mapping: emotion/concept -> recommended color. */
export interface ColorPsychologyRule {
  /** Keywords (Japanese + English) that trigger this rule. */
  keywords: readonly string[];
  /** Recommended color. */
  color: Color;
  /** Human-readable description. */
  description: string;
}

/**
 * Color psychology rules table.
 *
 * Used to override default palette colors when the user instruction
 * contains emotional or conceptual keywords.
 */
export const COLOR_PSYCHOLOGY_RULES: readonly ColorPsychologyRule[] = [
  {
    keywords: ['緊急', '速報', '危険', '警告', 'urgent', 'breaking', 'danger', 'alert', '衝撃'],
    color: { r: 220, g: 20, b: 20, a: 1 },
    description: 'Red conveys urgency, danger, and attention',
  },
  {
    keywords: ['信頼', '安心', '冷静', 'trust', 'reliable', 'calm', 'professional', 'ビジネス'],
    color: { r: 30, g: 80, b: 180, a: 1 },
    description: 'Blue conveys trust, professionalism, and calm',
  },
  {
    keywords: ['注目', '明るい', '楽しい', '元気', 'attention', 'bright', 'fun', 'cheerful', 'happy'],
    color: { r: 255, g: 210, b: 0, a: 1 },
    description: 'Yellow conveys attention, optimism, and energy',
  },
  {
    keywords: ['成長', '自然', '健康', 'エコ', 'growth', 'nature', 'health', 'eco', 'organic'],
    color: { r: 34, g: 139, b: 34, a: 1 },
    description: 'Green conveys growth, health, and nature',
  },
  {
    keywords: ['高級', '上品', 'エレガント', 'luxury', 'premium', 'elegant', 'sophisticated'],
    color: { r: 60, g: 20, b: 90, a: 1 },
    description: 'Purple conveys luxury, sophistication, and creativity',
  },
  {
    keywords: ['エネルギー', '情熱', '活力', 'energy', 'passion', 'vibrant', 'warm'],
    color: { r: 255, g: 120, b: 0, a: 1 },
    description: 'Orange conveys energy, enthusiasm, and warmth',
  },
  {
    keywords: ['シンプル', 'ミニマル', '洗練', 'simple', 'minimal', 'clean', 'modern'],
    color: { r: 245, g: 245, b: 245, a: 1 },
    description: 'White/light gray conveys simplicity and modernity',
  },
  {
    keywords: ['力強い', 'パワフル', '重厚', 'ダーク', 'powerful', 'strong', 'dark', 'bold'],
    color: { r: 20, g: 20, b: 20, a: 1 },
    description: 'Black conveys power, strength, and authority',
  },
] as const;

// ---------------------------------------------------------------------------
// Design Pattern Database
// ---------------------------------------------------------------------------

/** Default black stroke effect for high-visibility text. */
const STROKE_BLACK: Record<string, unknown> = {
  type: 'stroke',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  size: 4,
  position: 'outside',
  opacity: 1,
};

/** Thick black stroke for maximum impact. */
const STROKE_BLACK_THICK: Record<string, unknown> = {
  type: 'stroke',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  size: 6,
  position: 'outside',
  opacity: 1,
};

/** Default drop shadow for depth. */
const DROP_SHADOW: Record<string, unknown> = {
  type: 'drop-shadow',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 0.75 },
  opacity: 0.75,
  angle: 135,
  distance: 4,
  blur: 8,
  spread: 0,
};

/** White stroke for dark backgrounds. */
const STROKE_WHITE: Record<string, unknown> = {
  type: 'stroke',
  enabled: true,
  color: { r: 255, g: 255, b: 255, a: 1 },
  size: 3,
  position: 'outside',
  opacity: 1,
};

/** Yellow outer glow for attention. */
const GLOW_YELLOW: Record<string, unknown> = {
  type: 'outer-glow',
  enabled: true,
  color: { r: 255, g: 255, b: 0, a: 1 },
  opacity: 0.6,
  size: 12,
  spread: 0,
};

/**
 * Complete design pattern database.
 *
 * Each entry defines a category-specific layout template.
 * The thumbnail architect selects a pattern based on keyword matching
 * against the user instruction.
 */
export const DESIGN_PATTERNS: readonly DesignPattern[] = [
  // ── 1. News / Breaking ─────────────────────────────────────────
  {
    id: 'news',
    nameJa: 'ニュース・速報',
    nameEn: 'News / Breaking',
    mood: 'urgent',
    background: {
      type: 'gradient',
      gradientType: 'linear',
      angle: 180,
      stops: [
        { position: 0, color: { r: 180, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 40, g: 0, b: 0, a: 1 } },
      ],
    },
    palette: {
      primary: { r: 220, g: 20, b: 20, a: 1 },
      secondary: { r: 40, g: 0, b: 0, a: 1 },
      accent: { r: 255, g: 230, b: 0, a: 1 },
      text: { r: 255, g: 255, b: 255, a: 1 },
      subText: { r: 255, g: 230, b: 0, a: 1 },
    },
    textLayers: [
      {
        role: 'title',
        xRatio: 0.5,
        yRatio: 0.45,
        fontSize: 72,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'text',
        effects: [STROKE_BLACK_THICK, DROP_SHADOW],
      },
      {
        role: 'label',
        xRatio: 0.5,
        yRatio: 0.12,
        fontSize: 36,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'accent',
        effects: [STROKE_BLACK],
      },
    ],
    concentrationLines: true,
    borderFrame: true,
  },

  // ── 2. How-To / Tutorial ───────────────────────────────────────
  {
    id: 'howto',
    nameJa: 'How-To・チュートリアル',
    nameEn: 'How-To / Tutorial',
    mood: 'educational',
    background: {
      type: 'solid',
      color: { r: 240, g: 245, b: 250, a: 1 },
    },
    palette: {
      primary: { r: 30, g: 120, b: 220, a: 1 },
      secondary: { r: 240, g: 245, b: 250, a: 1 },
      accent: { r: 255, g: 165, b: 0, a: 1 },
      text: { r: 33, g: 33, b: 33, a: 1 },
      subText: { r: 100, g: 100, b: 100, a: 1 },
    },
    textLayers: [
      {
        role: 'title',
        xRatio: 0.5,
        yRatio: 0.40,
        fontSize: 60,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'text',
        effects: [STROKE_WHITE, DROP_SHADOW],
      },
      {
        role: 'subtitle',
        xRatio: 0.5,
        yRatio: 0.70,
        fontSize: 32,
        fontFamily: 'Noto Sans JP',
        bold: false,
        italic: false,
        alignment: 'center',
        colorKey: 'subText',
        effects: [],
      },
    ],
    concentrationLines: false,
    borderFrame: false,
  },

  // ── 3. Vlog / Personal ─────────────────────────────────────────
  {
    id: 'vlog',
    nameJa: 'Vlog・日常系',
    nameEn: 'Vlog / Personal',
    mood: 'casual',
    background: {
      type: 'gradient',
      gradientType: 'linear',
      angle: 135,
      stops: [
        { position: 0, color: { r: 255, g: 200, b: 150, a: 1 } },
        { position: 1, color: { r: 255, g: 130, b: 100, a: 1 } },
      ],
    },
    palette: {
      primary: { r: 255, g: 150, b: 100, a: 1 },
      secondary: { r: 255, g: 220, b: 180, a: 1 },
      accent: { r: 255, g: 80, b: 120, a: 1 },
      text: { r: 255, g: 255, b: 255, a: 1 },
      subText: { r: 255, g: 240, b: 220, a: 1 },
    },
    textLayers: [
      {
        role: 'title',
        xRatio: 0.5,
        yRatio: 0.50,
        fontSize: 56,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'text',
        effects: [STROKE_BLACK, DROP_SHADOW],
      },
      {
        role: 'subtitle',
        xRatio: 0.5,
        yRatio: 0.78,
        fontSize: 28,
        fontFamily: 'Noto Sans JP',
        bold: false,
        italic: false,
        alignment: 'center',
        colorKey: 'subText',
        effects: [STROKE_BLACK],
      },
    ],
    concentrationLines: false,
    borderFrame: false,
  },

  // ── 4. Product / Review ────────────────────────────────────────
  {
    id: 'product',
    nameJa: '商品紹介・レビュー',
    nameEn: 'Product / Review',
    mood: 'informative',
    background: {
      type: 'gradient',
      gradientType: 'radial',
      angle: 0,
      stops: [
        { position: 0, color: { r: 250, g: 250, b: 250, a: 1 } },
        { position: 1, color: { r: 200, g: 200, b: 210, a: 1 } },
      ],
    },
    palette: {
      primary: { r: 50, g: 50, b: 60, a: 1 },
      secondary: { r: 230, g: 230, b: 235, a: 1 },
      accent: { r: 255, g: 90, b: 50, a: 1 },
      text: { r: 33, g: 33, b: 33, a: 1 },
      subText: { r: 120, g: 120, b: 130, a: 1 },
    },
    textLayers: [
      {
        role: 'title',
        xRatio: 0.5,
        yRatio: 0.25,
        fontSize: 54,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'text',
        effects: [DROP_SHADOW],
      },
      {
        role: 'accent',
        xRatio: 0.5,
        yRatio: 0.80,
        fontSize: 40,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'accent',
        effects: [STROKE_BLACK, GLOW_YELLOW],
      },
    ],
    concentrationLines: false,
    borderFrame: true,
  },

  // ── 5. Gaming ──────────────────────────────────────────────────
  {
    id: 'gaming',
    nameJa: 'ゲーム実況',
    nameEn: 'Gaming',
    mood: 'exciting',
    background: {
      type: 'gradient',
      gradientType: 'linear',
      angle: 160,
      stops: [
        { position: 0, color: { r: 20, g: 0, b: 60, a: 1 } },
        { position: 0.5, color: { r: 40, g: 0, b: 80, a: 1 } },
        { position: 1, color: { r: 10, g: 0, b: 30, a: 1 } },
      ],
    },
    palette: {
      primary: { r: 100, g: 0, b: 200, a: 1 },
      secondary: { r: 20, g: 0, b: 50, a: 1 },
      accent: { r: 0, g: 255, b: 180, a: 1 },
      text: { r: 255, g: 255, b: 255, a: 1 },
      subText: { r: 0, g: 255, b: 180, a: 1 },
    },
    textLayers: [
      {
        role: 'title',
        xRatio: 0.5,
        yRatio: 0.40,
        fontSize: 68,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'text',
        effects: [STROKE_BLACK_THICK, DROP_SHADOW, GLOW_YELLOW],
      },
      {
        role: 'label',
        xRatio: 0.5,
        yRatio: 0.85,
        fontSize: 30,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'subText',
        effects: [STROKE_BLACK],
      },
    ],
    concentrationLines: true,
    borderFrame: true,
  },

  // ── 6. Comparison / VS ─────────────────────────────────────────
  {
    id: 'comparison',
    nameJa: '比較・対決',
    nameEn: 'Comparison / VS',
    mood: 'competitive',
    background: {
      type: 'gradient',
      gradientType: 'linear',
      angle: 90,
      stops: [
        { position: 0, color: { r: 200, g: 30, b: 30, a: 1 } },
        { position: 0.45, color: { r: 150, g: 20, b: 20, a: 1 } },
        { position: 0.55, color: { r: 20, g: 20, b: 150, a: 1 } },
        { position: 1, color: { r: 30, g: 30, b: 200, a: 1 } },
      ],
    },
    palette: {
      primary: { r: 200, g: 30, b: 30, a: 1 },
      secondary: { r: 30, g: 30, b: 200, a: 1 },
      accent: { r: 255, g: 230, b: 0, a: 1 },
      text: { r: 255, g: 255, b: 255, a: 1 },
      subText: { r: 255, g: 230, b: 0, a: 1 },
    },
    textLayers: [
      {
        role: 'title',
        xRatio: 0.5,
        yRatio: 0.45,
        fontSize: 80,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: true,
        alignment: 'center',
        colorKey: 'accent',
        effects: [STROKE_BLACK_THICK, DROP_SHADOW],
      },
      {
        role: 'subtitle',
        xRatio: 0.5,
        yRatio: 0.75,
        fontSize: 32,
        fontFamily: 'Noto Sans JP',
        bold: true,
        italic: false,
        alignment: 'center',
        colorKey: 'text',
        effects: [STROKE_BLACK],
      },
    ],
    concentrationLines: true,
    borderFrame: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup Utilities
// ---------------------------------------------------------------------------

/** Keyword-to-category mapping for pattern selection. */
const CATEGORY_KEYWORDS: ReadonlyArray<{ patternId: string; keywords: readonly string[] }> = [
  {
    patternId: 'news',
    keywords: [
      'ニュース', '速報', '衝撃', '緊急', '事件', '告知', '発表', '暴露',
      'news', 'breaking', 'urgent', 'alert', 'shocking', 'announce',
    ],
  },
  {
    patternId: 'howto',
    keywords: [
      'やり方', '方法', '手順', 'チュートリアル', '解説', '講座', '入門', '初心者', '使い方', 'コツ',
      'how-to', 'howto', 'tutorial', 'guide', 'tips', 'beginner', 'learn',
    ],
  },
  {
    patternId: 'vlog',
    keywords: [
      'vlog', '日常', '日記', 'ルーティン', '旅', '旅行', '1日',
      'vlog', 'daily', 'routine', 'travel', 'life', 'day-in',
    ],
  },
  {
    patternId: 'product',
    keywords: [
      'レビュー', '商品', '紹介', 'おすすめ', '購入', 'コスパ', '開封', 'ランキング',
      'review', 'product', 'recommend', 'unboxing', 'buy', 'ranking', 'best',
    ],
  },
  {
    patternId: 'gaming',
    keywords: [
      'ゲーム', '実況', 'プレイ', '攻略', 'ゲーミング', 'eスポーツ', '対戦',
      'game', 'gaming', 'gameplay', 'play', 'walkthrough', 'esports',
    ],
  },
  {
    patternId: 'comparison',
    keywords: [
      '比較', 'VS', 'vs', '対決', '対', 'どっち', 'どちら', '違い',
      'comparison', 'versus', 'vs', 'battle', 'which',
    ],
  },
] as const;

/**
 * Find the best matching design pattern for a given instruction.
 *
 * Scores each category by counting keyword matches in the instruction text.
 * Returns the pattern with the highest score, or the default ('news') if
 * no keywords match.
 *
 * @param instruction - User instruction text.
 * @returns The best matching DesignPattern.
 */
export function findPatternForInstruction(instruction: string): DesignPattern {
  const lower = instruction.toLowerCase();
  let bestId = 'news';
  let bestScore = 0;

  for (const entry of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = entry.patternId;
    }
  }

  return DESIGN_PATTERNS.find((p) => p.id === bestId) ?? DESIGN_PATTERNS[0];
}

/**
 * Look up a design pattern by its ID.
 *
 * @param id - Pattern ID (e.g. 'news', 'howto').
 * @returns The matching pattern, or undefined if not found.
 */
export function getPatternById(id: string): DesignPattern | undefined {
  return DESIGN_PATTERNS.find((p) => p.id === id);
}

/**
 * Apply color psychology to override a palette based on instruction keywords.
 *
 * Scans the instruction for emotional/conceptual keywords and returns an
 * accent color override if found. Returns undefined if no match.
 *
 * @param instruction - User instruction text.
 * @returns A recommended accent color, or undefined.
 */
export function findPsychologyColor(instruction: string): Color | undefined {
  const lower = instruction.toLowerCase();
  for (const rule of COLOR_PSYCHOLOGY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { ...rule.color };
      }
    }
  }
  return undefined;
}

/**
 * Resolve a text layer template into a concrete `TextLayerDesign`.
 *
 * Converts ratio-based positions to absolute pixel positions and
 * applies the palette color for the specified `colorKey`.
 *
 * @param template - Text layer template from the pattern.
 * @param palette - Color palette to resolve color keys.
 * @param canvasWidth - Canvas width in pixels.
 * @param canvasHeight - Canvas height in pixels.
 * @param textOverride - Optional text content override.
 * @returns A fully resolved TextLayerDesign.
 */
export function resolveTextLayer(
  template: TextLayerTemplate,
  palette: ColorPalette,
  canvasWidth: number,
  canvasHeight: number,
  textOverride?: string,
): TextLayerDesign {
  const refWidth = 1280;
  const scale = canvasWidth / refWidth;
  const scaledFontSize = Math.round(template.fontSize * scale);

  return {
    kind: 'text',
    name: `${template.role} text`,
    text: textOverride ?? '',
    x: Math.round(template.xRatio * canvasWidth),
    y: Math.round(template.yRatio * canvasHeight),
    fontSize: scaledFontSize,
    fontFamily: template.fontFamily,
    color: { ...palette[template.colorKey] },
    bold: template.bold,
    italic: template.italic,
    alignment: template.alignment,
    effects: template.effects.map((e) => ({ ...e })),
  };
}
