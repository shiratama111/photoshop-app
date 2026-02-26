/**
 * @module ai/effect-presets
 * Mood × FontCategory → Layer effect preset mapping.
 *
 * Provides automatic layer effect (stroke, shadow, glow) selection based on
 * the thumbnail's mood and the chosen font's category. Reuses the effect
 * constants defined in `design-patterns.ts`.
 *
 * Mood → Effect mapping matrix:
 * | Mood               | Category              | Effects                                |
 * |--------------------|-----------------------|----------------------------------------|
 * | urgent/exciting    | display, sans         | thick stroke + drop shadow + yellow glow |
 * | elegant/luxury     | serif                 | thin shadow only                       |
 * | casual/fun         | handwriting, display  | stroke + shadow                        |
 * | informative        | sans, serif           | black stroke + shadow                  |
 * | horror/dark        | display               | red glow + black shadow                |
 * | default            | any                   | black stroke + drop shadow             |
 *
 * @see {@link ./design-patterns.ts} — effect constants (STROKE_BLACK, etc.)
 * @see {@link ./pipeline.ts} — consumer
 * @see {@link ./font-catalog.ts} — FontCategory type
 */

import type { FontCategory } from './font-catalog';

// ---------------------------------------------------------------------------
// Effect constants (reused from design-patterns.ts conceptually)
// Defined here as plain objects to avoid circular dependencies.
// ---------------------------------------------------------------------------

/** Black stroke, size 4. */
const STROKE_BLACK: Record<string, unknown> = {
  type: 'stroke',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  size: 4,
  position: 'outside',
  opacity: 1,
};

/** Thick black stroke, size 6. */
const STROKE_BLACK_THICK: Record<string, unknown> = {
  type: 'stroke',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 1 },
  size: 6,
  position: 'outside',
  opacity: 1,
};

/** Standard drop shadow. */
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

/** Thin/subtle drop shadow for elegant styles. */
const DROP_SHADOW_THIN: Record<string, unknown> = {
  type: 'drop-shadow',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 0.4 },
  opacity: 0.4,
  angle: 135,
  distance: 2,
  blur: 4,
  spread: 0,
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

/** Red outer glow for horror/dark themes. */
const GLOW_RED: Record<string, unknown> = {
  type: 'outer-glow',
  enabled: true,
  color: { r: 200, g: 0, b: 0, a: 1 },
  opacity: 0.6,
  size: 10,
  spread: 0,
};

/** Heavy black drop shadow for dark themes. */
const DROP_SHADOW_DARK: Record<string, unknown> = {
  type: 'drop-shadow',
  enabled: true,
  color: { r: 0, g: 0, b: 0, a: 0.9 },
  opacity: 0.9,
  angle: 135,
  distance: 6,
  blur: 12,
  spread: 0,
};

// ---------------------------------------------------------------------------
// Mood normalization
// ---------------------------------------------------------------------------

/** Map of mood keywords → canonical mood. */
const MOOD_KEYWORDS: ReadonlyArray<{ mood: string; keywords: readonly string[] }> = [
  { mood: 'urgent', keywords: ['urgent', 'exciting', 'news', 'breaking', '速報', '衝撃', '緊急', 'exciting', 'competitive'] },
  { mood: 'elegant', keywords: ['elegant', 'luxury', 'premium', '高級', 'エレガント', '上品', 'sophisticated'] },
  { mood: 'casual', keywords: ['casual', 'fun', 'vlog', 'カジュアル', '楽しい', 'ポップ', 'educational'] },
  { mood: 'informative', keywords: ['informative', 'review', 'product', '商品', 'レビュー', '解説', 'howto', 'tutorial'] },
  { mood: 'horror', keywords: ['horror', 'dark', 'ホラー', 'ダーク', '恐怖', '怖い'] },
];

/**
 * Normalize a mood string to one of the canonical mood categories.
 * @param mood - Raw mood string (from design metadata).
 * @returns Canonical mood: 'urgent' | 'elegant' | 'casual' | 'informative' | 'horror' | 'default'.
 */
function normalizeMood(mood: string): string {
  const lower = mood.toLowerCase();
  for (const entry of MOOD_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return entry.mood;
      }
    }
  }
  return 'default';
}

// ---------------------------------------------------------------------------
// Preset matrix
// ---------------------------------------------------------------------------

/** Key for the effects lookup matrix. */
type EffectKey = `${string}:${string}`;

/** Effects lookup: "mood:category" -> effects array. */
const EFFECT_MATRIX: ReadonlyMap<EffectKey, ReadonlyArray<Record<string, unknown>>> = new Map([
  // Urgent/Exciting
  ['urgent:display', [STROKE_BLACK_THICK, DROP_SHADOW, GLOW_YELLOW]],
  ['urgent:sans', [STROKE_BLACK_THICK, DROP_SHADOW, GLOW_YELLOW]],
  ['urgent:serif', [STROKE_BLACK_THICK, DROP_SHADOW]],
  ['urgent:handwriting', [STROKE_BLACK, DROP_SHADOW]],

  // Elegant/Luxury
  ['elegant:serif', [DROP_SHADOW_THIN]],
  ['elegant:sans', [DROP_SHADOW_THIN]],
  ['elegant:display', [DROP_SHADOW_THIN]],
  ['elegant:handwriting', [DROP_SHADOW_THIN]],

  // Casual/Fun
  ['casual:handwriting', [STROKE_BLACK, DROP_SHADOW]],
  ['casual:display', [STROKE_BLACK, DROP_SHADOW]],
  ['casual:sans', [STROKE_BLACK, DROP_SHADOW]],
  ['casual:serif', [STROKE_BLACK, DROP_SHADOW]],

  // Informative
  ['informative:sans', [STROKE_BLACK, DROP_SHADOW]],
  ['informative:serif', [STROKE_BLACK, DROP_SHADOW]],
  ['informative:display', [STROKE_BLACK, DROP_SHADOW]],
  ['informative:handwriting', [STROKE_BLACK, DROP_SHADOW]],

  // Horror/Dark
  ['horror:display', [GLOW_RED, DROP_SHADOW_DARK]],
  ['horror:sans', [GLOW_RED, DROP_SHADOW_DARK]],
  ['horror:serif', [GLOW_RED, DROP_SHADOW_DARK]],
  ['horror:handwriting', [GLOW_RED, DROP_SHADOW_DARK]],
]);

/** Default effects when no specific mood+category combination matches. */
const DEFAULT_EFFECTS: ReadonlyArray<Record<string, unknown>> = [STROKE_BLACK, DROP_SHADOW];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the recommended layer effects for a given mood and font category.
 *
 * Looks up the mood × category matrix and returns a cloned array of effect
 * objects. Falls back to default effects (black stroke + drop shadow) if
 * no specific mapping exists.
 *
 * @param mood - Mood string from the design metadata (e.g. 'urgent', 'elegant').
 * @param category - Font category of the selected font.
 * @returns Array of effect objects suitable for `TextLayerDesign.effects`.
 */
export function getEffectsForMoodAndCategory(
  mood: string,
  category: FontCategory,
): ReadonlyArray<Record<string, unknown>> {
  const normalizedMood = normalizeMood(mood);
  const key: EffectKey = `${normalizedMood}:${category}`;
  const effects = EFFECT_MATRIX.get(key);
  if (effects) {
    // Return deep copies to prevent mutation
    return effects.map((e) => ({ ...e }));
  }
  return DEFAULT_EFFECTS.map((e) => ({ ...e }));
}
