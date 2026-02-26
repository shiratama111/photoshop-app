/**
 * @module ai/local-font-catalog.test
 * Tests for the local Japanese font catalog integration.
 *
 * Covers:
 * - Enriched catalog loading (776 fonts)
 * - Category distribution validation
 * - Tag extraction correctness
 * - FontMetadata interface conformance
 * - Path resolution for local fonts
 * - Merged catalog (55 built-in + 776 local, deduplicated)
 * - isLocalFont detection
 *
 * @see {@link ./local-font-catalog.ts}
 */

import { describe, it, expect } from 'vitest';
import {
  getLocalFontCatalog,
  getLocalFontPath,
  getMergedCatalog,
  isLocalFont,
} from './local-font-catalog';
import { FONT_CATALOG } from './font-catalog';
import type { FontCategory, FontTag } from './font-catalog';

// ---------------------------------------------------------------------------
// Valid value sets for assertions
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: FontCategory[] = ['serif', 'sans', 'display', 'handwriting', 'monospace'];

const VALID_TAGS: FontTag[] = [
  '力強い', 'エレガント', 'カジュアル', 'ポップ', 'フォーマル',
  'レトロ', 'モダン', '手書き風', 'クール', 'かわいい',
  '読みやすい', '太字', '細字', 'ニュース', 'ビジネス',
  'デザイン', 'インパクト', '高級', 'ナチュラル', 'テクノ',
];

// ---------------------------------------------------------------------------
// 1. Local Catalog Loading Tests
// ---------------------------------------------------------------------------

describe('getLocalFontCatalog', () => {
  const catalog = getLocalFontCatalog();

  it('should load 776 local fonts', () => {
    expect(catalog.length).toBe(776);
  });

  it('all fonts should have valid category', () => {
    for (const font of catalog) {
      expect(VALID_CATEGORIES).toContain(font.category);
    }
  });

  it('all fonts should have at least one valid tag', () => {
    for (const font of catalog) {
      expect(font.tags.length).toBeGreaterThanOrEqual(1);
      for (const tag of font.tags) {
        expect(VALID_TAGS).toContain(tag);
      }
    }
  });

  it('all fonts should have japaneseSupport = true', () => {
    for (const font of catalog) {
      expect(font.japaneseSupport).toBe(true);
    }
  });

  it('all fonts should have popularity between 1 and 10', () => {
    for (const font of catalog) {
      expect(font.popularity).toBeGreaterThanOrEqual(1);
      expect(font.popularity).toBeLessThanOrEqual(10);
    }
  });

  it('all fonts should have valid weight range', () => {
    for (const font of catalog) {
      expect(font.weight[0]).toBeGreaterThanOrEqual(100);
      expect(font.weight[1]).toBeLessThanOrEqual(900);
      expect(font.weight[0]).toBeLessThanOrEqual(font.weight[1]);
    }
  });

  it('all fonts should have non-empty family name', () => {
    for (const font of catalog) {
      expect(font.family.length).toBeGreaterThan(0);
    }
  });

  it('should have at least 100 display fonts', () => {
    const displayFonts = catalog.filter((f) => f.category === 'display');
    expect(displayFonts.length).toBeGreaterThanOrEqual(100);
  });

  it('should have at least 50 handwriting fonts', () => {
    const hwFonts = catalog.filter((f) => f.category === 'handwriting');
    expect(hwFonts.length).toBeGreaterThanOrEqual(50);
  });

  it('should have at least 50 sans fonts', () => {
    const sansFonts = catalog.filter((f) => f.category === 'sans');
    expect(sansFonts.length).toBeGreaterThanOrEqual(50);
  });

  it('should have at least 20 serif fonts', () => {
    const serifFonts = catalog.filter((f) => f.category === 'serif');
    expect(serifFonts.length).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 2. Tag Distribution Tests
// ---------------------------------------------------------------------------

describe('Local catalog tag distribution', () => {
  const catalog = getLocalFontCatalog();

  it('should have fonts tagged with デザイン', () => {
    const count = catalog.filter((f) => f.tags.includes('デザイン')).length;
    expect(count).toBeGreaterThan(100);
  });

  it('should have fonts tagged with インパクト', () => {
    const count = catalog.filter((f) => f.tags.includes('インパクト')).length;
    expect(count).toBeGreaterThan(50);
  });

  it('should have fonts tagged with かわいい', () => {
    const count = catalog.filter((f) => f.tags.includes('かわいい')).length;
    expect(count).toBeGreaterThan(30);
  });

  it('should have fonts tagged with 手書き風', () => {
    const count = catalog.filter((f) => f.tags.includes('手書き風')).length;
    expect(count).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// 3. Path Resolution Tests
// ---------------------------------------------------------------------------

describe('getLocalFontPath', () => {
  it('should resolve a known local font to a path', () => {
    const catalog = getLocalFontCatalog();
    const firstFont = catalog[0];
    const p = getLocalFontPath(firstFont.family);
    expect(p).toBeDefined();
    expect(typeof p).toBe('string');
    expect(p!.length).toBeGreaterThan(0);
  });

  it('should return undefined for a built-in font', () => {
    expect(getLocalFontPath('Arial')).toBeUndefined();
  });

  it('should return undefined for a non-existent font', () => {
    expect(getLocalFontPath('NonExistentFont123')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Merged Catalog Tests
// ---------------------------------------------------------------------------

describe('getMergedCatalog', () => {
  const merged = getMergedCatalog();

  it('should contain more fonts than either catalog alone', () => {
    expect(merged.length).toBeGreaterThan(FONT_CATALOG.length);
    expect(merged.length).toBeGreaterThan(getLocalFontCatalog().length);
  });

  it('should include all 55 built-in fonts', () => {
    for (const builtIn of FONT_CATALOG) {
      const found = merged.find((f) => f.family === builtIn.family);
      expect(found).toBeDefined();
    }
  });

  it('should deduplicate fonts with same family name', () => {
    const families = merged.map((f) => f.family.toLowerCase());
    const uniqueFamilies = new Set(families);
    expect(families.length).toBe(uniqueFamilies.size);
  });

  it('built-in fonts should take priority in deduplication', () => {
    // Noto Sans JP is in both catalogs — the built-in should win
    const noto = merged.find((f) => f.family === 'Noto Sans JP');
    if (noto) {
      // Built-in Noto Sans JP has popularity 10; local would have 3-7
      expect(noto.popularity).toBe(10);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. isLocalFont Tests
// ---------------------------------------------------------------------------

describe('isLocalFont', () => {
  it('should return true for a local font', () => {
    const catalog = getLocalFontCatalog();
    expect(isLocalFont(catalog[0].family)).toBe(true);
  });

  it('should return false for a system font', () => {
    expect(isLocalFont('Arial')).toBe(false);
  });

  it('should return false for unknown font', () => {
    expect(isLocalFont('NonExistent')).toBe(false);
  });
});
