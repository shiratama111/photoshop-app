/**
 * @module ai/font-selector-ai
 * AI-powered font recommendation engine for automatic font selection.
 *
 * Suggests fonts based on:
 * - Text content (language detection, length analysis)
 * - Mood/adjective descriptors ('力強い', 'エレガント', 'casual', etc.)
 * - Font category preferences (serif, sans, display, handwriting)
 * - Language requirements (Japanese text -> Japanese-capable fonts)
 *
 * Scoring weights:
 * - Tag match: +10 per matching tag
 * - Language fit: +20 for correct language support
 * - Category match: +15 for requested category
 * - Text length heuristic: +5 for appropriate font type
 * - Popularity bonus: +3 scaled by popularity (0.3 * popularity)
 *
 * @see AIFONT-001: フォント自動選択AI
 * @see {@link ./font-catalog.ts} — font metadata catalog
 * @see {@link ../editor-actions/style-vocabulary.ts} — adjective vocabulary reference
 * @see {@link ../components/text-editor/FontSelector.tsx} — existing font UI
 */

import type { FontCategory, FontMetadata, FontTag } from './font-catalog';
import { TAG_ENGLISH_MAP } from './font-catalog';
import { getMergedCatalog } from './local-font-catalog';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Options for the font recommendation engine. */
export interface FontSelectionOptions {
  /** The text content to display (used for language detection and length analysis). */
  text?: string;
  /** Mood/style descriptors — Japanese or English adjectives. */
  mood?: readonly string[];
  /** Preferred font category. */
  category?: FontCategory;
  /** Override detected language. */
  language?: 'ja' | 'en';
  /** Maximum number of recommendations to return (default: 5). */
  limit?: number;
  /** Custom font catalog to score against. Defaults to getMergedCatalog() (55 built-in + 776 local). */
  catalog?: readonly FontMetadata[];
}

/** A single font recommendation with score breakdown. */
export interface FontRecommendation {
  /** The recommended font metadata. */
  font: FontMetadata;
  /** Total score (higher = better match). */
  score: number;
  /** Breakdown of how the score was calculated. */
  reasons: readonly string[];
}

// ---------------------------------------------------------------------------
// Scoring Constants
// ---------------------------------------------------------------------------

/** Points awarded per matching tag. */
const SCORE_TAG_MATCH = 10;

/** Points awarded when the font supports the required language. */
const SCORE_LANGUAGE_FIT = 20;

/** Points awarded when the font matches the requested category. */
const SCORE_CATEGORY_MATCH = 15;

/** Points awarded for text-length heuristic (appropriate font type for content). */
const SCORE_TEXT_LENGTH = 5;

/** Multiplier for popularity bonus (score = SCORE_POPULARITY_FACTOR * popularity). */
const SCORE_POPULARITY_FACTOR = 0.3;

/** Default number of recommendations to return. */
const DEFAULT_LIMIT = 5;

/** Threshold: text length <= this is considered "short" (headline/title). */
const SHORT_TEXT_THRESHOLD = 10;

/** Threshold: text length >= this is considered "long" (body/paragraph). */
const LONG_TEXT_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Language Detection
// ---------------------------------------------------------------------------

/**
 * Regex pattern for CJK Unified Ideographs, Hiragana, and Katakana ranges.
 * Covers the main Japanese character blocks.
 */
const JAPANESE_CHAR_PATTERN = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/;

/**
 * Detect the primary language of the given text.
 *
 * Heuristic: if any Japanese characters (hiragana, katakana, CJK ideographs,
 * full-width forms) are found, the text is classified as Japanese.
 *
 * @param text - The text to analyze.
 * @returns 'ja' for Japanese text, 'en' for everything else.
 */
export function detectLanguage(text: string): 'ja' | 'en' {
  if (!text) return 'en';
  return JAPANESE_CHAR_PATTERN.test(text) ? 'ja' : 'en';
}

// ---------------------------------------------------------------------------
// Mood/Adjective -> Tag Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve mood/adjective strings to FontTag values.
 *
 * Handles:
 * - Direct Japanese tag matches ('力強い' -> '力強い')
 * - English keyword lookups ('elegant' -> 'エレガント')
 * - Partial matching for flexibility
 *
 * @param moods - Array of mood/adjective strings to resolve.
 * @returns Array of unique FontTag values.
 */
export function resolveMoodsToTags(moods: readonly string[]): readonly FontTag[] {
  const tags = new Set<FontTag>();

  for (const mood of moods) {
    const normalized = mood.toLowerCase().trim();
    if (!normalized) continue;

    // Direct Japanese tag match
    for (const [tag, englishAliases] of TAG_ENGLISH_MAP) {
      // Check if mood matches the Japanese tag
      if (normalized === tag || mood.trim() === tag) {
        tags.add(tag);
        continue;
      }
      // Check if mood matches any English alias
      for (const alias of englishAliases) {
        if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
          tags.add(tag);
          break;
        }
      }
    }
  }

  return [...tags];
}

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

/**
 * Score a single font against the given selection criteria.
 *
 * @param font - The font to evaluate.
 * @param resolvedTags - Tags resolved from mood/adjective descriptors.
 * @param language - Target language ('ja' or 'en').
 * @param category - Preferred font category (if any).
 * @param textLength - Length of the text content (for heuristic scoring).
 * @returns A FontRecommendation with score and reasons.
 */
function scoreFont(
  font: FontMetadata,
  resolvedTags: readonly FontTag[],
  language: 'ja' | 'en',
  category: FontCategory | undefined,
  textLength: number,
): FontRecommendation {
  let score = 0;
  const reasons: string[] = [];

  // 1. Tag matching: +SCORE_TAG_MATCH per matching tag
  let tagMatchCount = 0;
  for (const tag of resolvedTags) {
    if (font.tags.includes(tag)) {
      tagMatchCount++;
      score += SCORE_TAG_MATCH;
    }
  }
  if (tagMatchCount > 0) {
    reasons.push(`tag match: ${tagMatchCount}x (+${tagMatchCount * SCORE_TAG_MATCH})`);
  }

  // 2. Language fit: +SCORE_LANGUAGE_FIT for correct language support
  if (language === 'ja') {
    if (font.japaneseSupport) {
      score += SCORE_LANGUAGE_FIT;
      reasons.push(`Japanese support (+${SCORE_LANGUAGE_FIT})`);
    }
  } else {
    // English text: all fonts work, but slight bonus for non-Japanese fonts
    // (Japanese fonts may have suboptimal Latin letterforms)
    if (!font.japaneseSupport) {
      score += SCORE_LANGUAGE_FIT;
      reasons.push(`English-optimized (+${SCORE_LANGUAGE_FIT})`);
    }
  }

  // 3. Category match: +SCORE_CATEGORY_MATCH for requested category
  if (category && font.category === category) {
    score += SCORE_CATEGORY_MATCH;
    reasons.push(`category match: ${category} (+${SCORE_CATEGORY_MATCH})`);
  }

  // 4. Text length heuristic: +SCORE_TEXT_LENGTH for appropriate font type
  if (textLength > 0) {
    if (textLength <= SHORT_TEXT_THRESHOLD) {
      // Short text (headline/title): prefer display and bold fonts
      if (font.category === 'display' || font.tags.includes('力強い') || font.tags.includes('インパクト')) {
        score += SCORE_TEXT_LENGTH;
        reasons.push(`short text → display/bold preferred (+${SCORE_TEXT_LENGTH})`);
      }
    } else if (textLength >= LONG_TEXT_THRESHOLD) {
      // Long text (body): prefer readable sans/serif fonts
      if (font.tags.includes('読みやすい') || font.category === 'sans' || font.category === 'serif') {
        score += SCORE_TEXT_LENGTH;
        reasons.push(`long text → readable preferred (+${SCORE_TEXT_LENGTH})`);
      }
    }
  }

  // 5. Popularity bonus: SCORE_POPULARITY_FACTOR * popularity
  const popularityBonus = SCORE_POPULARITY_FACTOR * font.popularity;
  score += popularityBonus;
  reasons.push(`popularity: ${font.popularity}/10 (+${popularityBonus.toFixed(1)})`);

  return { font, score, reasons };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Recommend fonts based on text content, mood, and preferences.
 *
 * Returns a ranked list of font recommendations with scores and explanations.
 * Japanese text automatically prioritizes Japanese-capable fonts.
 * Mood descriptors are matched against font tags in both Japanese and English.
 *
 * @param options - Font selection criteria.
 * @returns Ranked array of FontRecommendation objects (highest score first).
 *
 * @example
 * ```ts
 * // Japanese headline with powerful mood
 * const recs = recommendFonts({
 *   text: '衝撃の事実',
 *   mood: ['力強い', 'インパクト'],
 * });
 *
 * // English body text, elegant style
 * const recs = recommendFonts({
 *   text: 'The quick brown fox jumps over the lazy dog.',
 *   mood: ['elegant', 'sophisticated'],
 *   category: 'serif',
 * });
 * ```
 */
export function recommendFonts(options: FontSelectionOptions): FontRecommendation[] {
  const {
    text = '',
    mood = [],
    category,
    limit = DEFAULT_LIMIT,
    catalog,
  } = options;

  // Determine language
  const language = options.language ?? detectLanguage(text);

  // Resolve moods to tags
  const resolvedTags = resolveMoodsToTags(mood);

  // Use provided catalog, or merged catalog (55 built-in + 776 local)
  const fontList = catalog ?? getMergedCatalog();

  // Score all fonts
  const scored = fontList.map((font) =>
    scoreFont(font, resolvedTags, language, category, text.length),
  );

  // Sort by score (descending), then by popularity (descending) for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.font.popularity - a.font.popularity;
  });

  // Return top N
  return scored.slice(0, Math.max(1, limit));
}
