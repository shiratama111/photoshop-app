/**
 * @module ai/font-selector-ai.test
 * Comprehensive tests for the AI font recommendation engine (AIFONT-001).
 *
 * Test coverage:
 * - Font catalog completeness (50+ fonts, all tagged)
 * - Language detection (Japanese vs English text)
 * - Mood/adjective -> tag resolution (Japanese and English)
 * - Recommendation engine scoring and ranking
 * - Japanese text -> Japanese font prioritization
 * - Category filtering
 * - Text length heuristics (short -> display, long -> readable)
 * - Edge cases (empty text, unknown adjectives, no mood)
 *
 * @see AIFONT-001: フォント自動選択AI
 * @see {@link ./font-selector-ai.ts}
 * @see {@link ./font-catalog.ts}
 */

import { describe, it, expect } from 'vitest';
import {
  FONT_CATALOG,
  TAG_ENGLISH_MAP,
  findFontsByTag,
  findJapaneseFonts,
  findFontsByCategory,
  lookupFont,
} from './font-catalog';
import type { FontTag, FontCategory } from './font-catalog';
import {
  detectLanguage,
  resolveMoodsToTags,
  recommendFonts,
} from './font-selector-ai';

// ---------------------------------------------------------------------------
// 1. Font Catalog Completeness Tests
// ---------------------------------------------------------------------------

describe('Font Catalog', () => {
  it('should contain at least 50 fonts', () => {
    expect(FONT_CATALOG.length).toBeGreaterThanOrEqual(50);
  });

  it('should have all fonts tagged with at least one tag', () => {
    for (const font of FONT_CATALOG) {
      expect(font.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have all fonts with valid category', () => {
    const validCategories: FontCategory[] = ['serif', 'sans', 'display', 'handwriting', 'monospace'];
    for (const font of FONT_CATALOG) {
      expect(validCategories).toContain(font.category);
    }
  });

  it('should have all fonts with valid weight range', () => {
    for (const font of FONT_CATALOG) {
      expect(font.weight[0]).toBeGreaterThanOrEqual(100);
      expect(font.weight[1]).toBeLessThanOrEqual(900);
      expect(font.weight[0]).toBeLessThanOrEqual(font.weight[1]);
    }
  });

  it('should have all fonts with popularity between 1 and 10', () => {
    for (const font of FONT_CATALOG) {
      expect(font.popularity).toBeGreaterThanOrEqual(1);
      expect(font.popularity).toBeLessThanOrEqual(10);
    }
  });

  it('should have unique font family names', () => {
    const families = FONT_CATALOG.map((f) => f.family.toLowerCase());
    const uniqueFamilies = new Set(families);
    expect(families.length).toBe(uniqueFamilies.size);
  });

  it('should include Japanese fonts with japaneseSupport=true', () => {
    const jaFonts = FONT_CATALOG.filter((f) => f.japaneseSupport);
    expect(jaFonts.length).toBeGreaterThanOrEqual(10);
  });

  it('should include English fonts with japaneseSupport=false', () => {
    const enFonts = FONT_CATALOG.filter((f) => !f.japaneseSupport);
    expect(enFonts.length).toBeGreaterThanOrEqual(20);
  });

  it('should cover all five categories', () => {
    const categories = new Set(FONT_CATALOG.map((f) => f.category));
    expect(categories.has('serif')).toBe(true);
    expect(categories.has('sans')).toBe(true);
    expect(categories.has('display')).toBe(true);
    expect(categories.has('handwriting')).toBe(true);
    expect(categories.has('monospace')).toBe(true);
  });

  it('TAG_ENGLISH_MAP should have entries for all expected tags', () => {
    const expectedTags: FontTag[] = [
      '力強い', 'エレガント', 'カジュアル', 'ポップ', 'フォーマル',
      'レトロ', 'モダン', '手書き風', 'クール', 'かわいい',
      '読みやすい', '太字', '細字', 'ニュース', 'ビジネス',
      'デザイン', 'インパクト', '高級', 'ナチュラル', 'テクノ',
    ];
    for (const tag of expectedTags) {
      expect(TAG_ENGLISH_MAP.has(tag)).toBe(true);
      const aliases = TAG_ENGLISH_MAP.get(tag);
      expect(aliases).toBeDefined();
      expect(aliases!.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Catalog Lookup Utility Tests
// ---------------------------------------------------------------------------

describe('Catalog Lookup Utilities', () => {
  describe('findFontsByTag', () => {
    it('should find fonts tagged with 力強い', () => {
      const fonts = findFontsByTag('力強い');
      expect(fonts.length).toBeGreaterThanOrEqual(3);
      for (const font of fonts) {
        expect(font.tags).toContain('力強い');
      }
    });

    it('should find fonts tagged with エレガント', () => {
      const fonts = findFontsByTag('エレガント');
      expect(fonts.length).toBeGreaterThanOrEqual(3);
      for (const font of fonts) {
        expect(font.tags).toContain('エレガント');
      }
    });
  });

  describe('findJapaneseFonts', () => {
    it('should return only fonts with japaneseSupport=true', () => {
      const jaFonts = findJapaneseFonts();
      for (const font of jaFonts) {
        expect(font.japaneseSupport).toBe(true);
      }
    });
  });

  describe('findFontsByCategory', () => {
    it('should find serif fonts', () => {
      const fonts = findFontsByCategory('serif');
      expect(fonts.length).toBeGreaterThanOrEqual(3);
      for (const font of fonts) {
        expect(font.category).toBe('serif');
      }
    });

    it('should find display fonts', () => {
      const fonts = findFontsByCategory('display');
      expect(fonts.length).toBeGreaterThanOrEqual(3);
      for (const font of fonts) {
        expect(font.category).toBe('display');
      }
    });
  });

  describe('lookupFont', () => {
    it('should find font by exact name', () => {
      const font = lookupFont('Impact');
      expect(font).toBeDefined();
      expect(font!.family).toBe('Impact');
    });

    it('should find font case-insensitively', () => {
      const font = lookupFont('noto sans jp');
      expect(font).toBeDefined();
      expect(font!.family).toBe('Noto Sans JP');
    });

    it('should return undefined for unknown font', () => {
      expect(lookupFont('NonExistentFont123')).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Language Detection Tests
// ---------------------------------------------------------------------------

describe('detectLanguage', () => {
  it('should detect Japanese text with hiragana', () => {
    expect(detectLanguage('こんにちは')).toBe('ja');
  });

  it('should detect Japanese text with katakana', () => {
    expect(detectLanguage('カタカナ')).toBe('ja');
  });

  it('should detect Japanese text with kanji', () => {
    expect(detectLanguage('衝撃の事実')).toBe('ja');
  });

  it('should detect Japanese text mixed with English', () => {
    expect(detectLanguage('Hello 世界')).toBe('ja');
  });

  it('should detect English text', () => {
    expect(detectLanguage('Hello World')).toBe('en');
  });

  it('should detect English for pure ASCII text', () => {
    expect(detectLanguage('The quick brown fox')).toBe('en');
  });

  it('should return "en" for empty text', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('should detect Japanese for full-width characters', () => {
    expect(detectLanguage('ＡＢＣ')).toBe('ja');
  });
});

// ---------------------------------------------------------------------------
// 4. Mood/Adjective -> Tag Resolution Tests
// ---------------------------------------------------------------------------

describe('resolveMoodsToTags', () => {
  it('should resolve Japanese mood directly', () => {
    const tags = resolveMoodsToTags(['力強い']);
    expect(tags).toContain('力強い');
  });

  it('should resolve English mood to Japanese tag', () => {
    const tags = resolveMoodsToTags(['elegant']);
    expect(tags).toContain('エレガント');
  });

  it('should resolve multiple moods', () => {
    const tags = resolveMoodsToTags(['力強い', 'elegant']);
    expect(tags).toContain('力強い');
    expect(tags).toContain('エレガント');
  });

  it('should handle case-insensitive English', () => {
    const tags = resolveMoodsToTags(['POWERFUL']);
    expect(tags).toContain('力強い');
  });

  it('should handle partial English matches', () => {
    const tags = resolveMoodsToTags(['bold']);
    // 'bold' maps to both '力強い' and '太字'
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for unknown moods', () => {
    const tags = resolveMoodsToTags(['xyzzy123']);
    expect(tags).toHaveLength(0);
  });

  it('should return empty for empty input', () => {
    const tags = resolveMoodsToTags([]);
    expect(tags).toHaveLength(0);
  });

  it('should skip whitespace-only entries', () => {
    const tags = resolveMoodsToTags(['  ', '']);
    expect(tags).toHaveLength(0);
  });

  it('should resolve カジュアル directly', () => {
    const tags = resolveMoodsToTags(['カジュアル']);
    expect(tags).toContain('カジュアル');
  });

  it('should resolve "cute" to かわいい', () => {
    const tags = resolveMoodsToTags(['cute']);
    expect(tags).toContain('かわいい');
  });
});

// ---------------------------------------------------------------------------
// 5. Recommendation Engine — Core Tests
// ---------------------------------------------------------------------------

describe('recommendFonts', () => {
  it('should return at most the requested number of results', () => {
    const recs = recommendFonts({ text: 'Test', limit: 3 });
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it('should return 5 results by default', () => {
    const recs = recommendFonts({ text: 'Test' });
    expect(recs.length).toBe(5);
  });

  it('should return at least 1 result even with limit=0', () => {
    const recs = recommendFonts({ text: 'Test', limit: 0 });
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });

  it('should return results sorted by score descending', () => {
    const recs = recommendFonts({ text: 'Test', mood: ['elegant'] });
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it('should include score and reasons for each recommendation', () => {
    const recs = recommendFonts({ text: 'Test', mood: ['powerful'] });
    for (const rec of recs) {
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.reasons.length).toBeGreaterThanOrEqual(1);
      expect(rec.font.family).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Japanese Text -> Japanese Font Prioritization
// ---------------------------------------------------------------------------

describe('recommendFonts — Japanese text prioritization', () => {
  it('should prioritize Japanese fonts for Japanese text', () => {
    const recs = recommendFonts({ text: '衝撃の事実' });
    // All top results should support Japanese
    const topFonts = recs.slice(0, 3);
    for (const rec of topFonts) {
      expect(rec.font.japaneseSupport).toBe(true);
    }
  });

  it('should prioritize non-Japanese fonts for English text', () => {
    const recs = recommendFonts({ text: 'Breaking News' });
    // Top results should be English-optimized
    const topFont = recs[0];
    expect(topFont.font.japaneseSupport).toBe(false);
  });

  it('should respect explicit language override', () => {
    const recs = recommendFonts({ text: 'test', language: 'ja' });
    const topFonts = recs.slice(0, 3);
    for (const rec of topFonts) {
      expect(rec.font.japaneseSupport).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Mood/Adjective Matching — Recommendation Validation
// ---------------------------------------------------------------------------

describe('recommendFonts — mood matching', () => {
  it('should rank 力強い fonts high for "力強い" mood', () => {
    const recs = recommendFonts({ text: '衝撃', mood: ['力強い'] });
    const topFont = recs[0];
    expect(topFont.font.tags).toContain('力強い');
  });

  it('should rank エレガント fonts high for "elegant" mood', () => {
    const recs = recommendFonts({ text: 'Luxury', mood: ['elegant'] });
    const topFont = recs[0];
    expect(topFont.font.tags).toContain('エレガント');
  });

  it('should rank ポップ fonts high for "playful" mood', () => {
    const recs = recommendFonts({ text: 'Fun!', mood: ['playful'] });
    const topFont = recs[0];
    const hasPopOrCute = topFont.font.tags.includes('ポップ') || topFont.font.tags.includes('かわいい');
    expect(hasPopOrCute).toBe(true);
  });

  it('should rank display/bold fonts for "impact" mood', () => {
    const recs = recommendFonts({ text: 'WOW', mood: ['impact'] });
    const topFont = recs[0];
    expect(topFont.font.tags).toContain('インパクト');
  });

  it('should rank handwriting fonts for "handwritten" mood', () => {
    const recs = recommendFonts({ text: 'Note', mood: ['handwritten'] });
    const topFont = recs[0];
    expect(topFont.font.tags).toContain('手書き風');
  });

  it('should rank formal fonts for "formal" mood', () => {
    const recs = recommendFonts({
      text: 'Dear Sir or Madam, I am writing to you regarding this formal matter of great importance to our business.',
      mood: ['formal', 'professional'],
    });
    const topFont = recs[0];
    expect(topFont.font.tags).toContain('フォーマル');
  });

  it('should handle multiple moods together', () => {
    const recs = recommendFonts({
      text: '限定セール',
      mood: ['力強い', 'インパクト'],
    });
    const topFont = recs[0];
    // Should have at least one of the requested tags
    const hasRelevant = topFont.font.tags.includes('力強い') || topFont.font.tags.includes('インパクト');
    expect(hasRelevant).toBe(true);
  });

  it('should rank Japanese 力強い fonts for Japanese text with powerful mood', () => {
    const recs = recommendFonts({
      text: '衝撃の事実',
      mood: ['力強い'],
    });
    const topFont = recs[0];
    expect(topFont.font.japaneseSupport).toBe(true);
    expect(topFont.font.tags).toContain('力強い');
  });

  it('should rank Japanese エレガント fonts for Japanese text with elegant mood', () => {
    const recs = recommendFonts({
      text: '美しい物語',
      mood: ['エレガント'],
    });
    const topFont = recs[0];
    expect(topFont.font.japaneseSupport).toBe(true);
    expect(topFont.font.tags).toContain('エレガント');
  });
});

// ---------------------------------------------------------------------------
// 8. Category Filtering Tests
// ---------------------------------------------------------------------------

describe('recommendFonts — category filtering', () => {
  it('should boost serif fonts when category=serif is specified', () => {
    const recs = recommendFonts({ text: 'Test', category: 'serif' });
    const topFont = recs[0];
    expect(topFont.font.category).toBe('serif');
  });

  it('should boost display fonts when category=display is specified', () => {
    const recs = recommendFonts({ text: 'Test', category: 'display' });
    const topFont = recs[0];
    expect(topFont.font.category).toBe('display');
  });

  it('should boost handwriting fonts when category=handwriting is specified', () => {
    const recs = recommendFonts({ text: 'Test', category: 'handwriting' });
    const topFont = recs[0];
    expect(topFont.font.category).toBe('handwriting');
  });
});

// ---------------------------------------------------------------------------
// 9. Text Length Heuristic Tests
// ---------------------------------------------------------------------------

describe('recommendFonts — text length heuristics', () => {
  it('should prefer display/bold fonts for short text (headlines)', () => {
    const recs = recommendFonts({ text: 'WOW' });
    // Short text should favor display/impact fonts
    const topFonts = recs.slice(0, 3);
    const hasDisplayOrBold = topFonts.some(
      (rec) =>
        rec.font.category === 'display' ||
        rec.font.tags.includes('力強い') ||
        rec.font.tags.includes('インパクト'),
    );
    expect(hasDisplayOrBold).toBe(true);
  });

  it('should prefer readable fonts for long text (body)', () => {
    const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(5);
    const recs = recommendFonts({ text: longText });
    const topFont = recs[0];
    const isReadable =
      topFont.font.tags.includes('読みやすい') ||
      topFont.font.category === 'sans' ||
      topFont.font.category === 'serif';
    expect(isReadable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Edge Cases
// ---------------------------------------------------------------------------

describe('recommendFonts — edge cases', () => {
  it('should handle empty text gracefully', () => {
    const recs = recommendFonts({ text: '' });
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle undefined text gracefully', () => {
    const recs = recommendFonts({});
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle unknown adjectives gracefully', () => {
    const recs = recommendFonts({
      text: 'Hello',
      mood: ['xyzzy', 'nonexistent', '存在しない形容詞'],
    });
    expect(recs.length).toBeGreaterThanOrEqual(1);
    // Should still return results based on other scoring factors
  });

  it('should handle empty mood array gracefully', () => {
    const recs = recommendFonts({ text: 'Hello', mood: [] });
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce 5 or more recommendations for Japanese text with adjective', () => {
    const recs = recommendFonts({
      text: '衝撃の事実',
      mood: ['力強い'],
      limit: 10,
    });
    expect(recs.length).toBeGreaterThanOrEqual(5);
  });

  it('should not crash when limit is very large', () => {
    const recs = recommendFonts({ text: 'Test', limit: 1000 });
    expect(recs.length).toBeLessThanOrEqual(FONT_CATALOG.length);
  });
});

// ---------------------------------------------------------------------------
// 11. Genre-based Recommendation Tests (Acceptance Criteria)
// ---------------------------------------------------------------------------

describe('recommendFonts — genre-based scenarios', () => {
  it('should recommend Impact/bold fonts for news-style content', () => {
    const recs = recommendFonts({
      text: 'BREAKING',
      mood: ['news', 'impact'],
    });
    const hasNewsSuitable = recs.some(
      (r) =>
        r.font.tags.includes('ニュース') ||
        r.font.tags.includes('インパクト') ||
        r.font.tags.includes('力強い'),
    );
    expect(hasNewsSuitable).toBe(true);
  });

  it('should recommend Georgia/Serif for elegant content', () => {
    const recs = recommendFonts({
      text: 'Elegant Showcase',
      mood: ['elegant', 'sophisticated'],
      category: 'serif',
    });
    const topFont = recs[0];
    expect(topFont.font.category).toBe('serif');
    expect(topFont.font.tags).toContain('エレガント');
  });

  it('should recommend Noto Sans JP Bold for Japanese news', () => {
    const recs = recommendFonts({
      text: '速報',
      mood: ['ニュース', '力強い'],
    });
    // Top results should be Japanese + powerful/news
    const topFont = recs[0];
    expect(topFont.font.japaneseSupport).toBe(true);
  });

  it('should recommend 游明朝/Noto Serif JP for Japanese elegant content', () => {
    const recs = recommendFonts({
      text: '優雅な時間',
      mood: ['エレガント', '高級'],
    });
    const topFont = recs[0];
    expect(topFont.font.japaneseSupport).toBe(true);
    expect(topFont.font.tags).toContain('エレガント');
  });
});
