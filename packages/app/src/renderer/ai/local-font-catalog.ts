/**
 * @module ai/local-font-catalog
 * Runtime loader for the enriched local Japanese font catalog (776 fonts).
 *
 * Reads `font-catalog-enriched.json` at import time and converts each entry
 * into the `FontMetadata` interface expected by the font recommendation engine.
 *
 * Provides:
 * - `LOCAL_FONT_CATALOG`: 776 local Japanese fonts as `FontMetadata[]`
 * - `getLocalFontCatalog()`: accessor for the local catalog
 * - `getLocalFontPath(family)`: resolve a family name to its local file path
 * - `getMergedCatalog()`: merged catalog (55 built-in + 776 local, deduped)
 *
 * @see {@link ./font-catalog.ts} — built-in 55-font catalog
 * @see {@link ./font-selector-ai.ts} — consumer (recommendation engine)
 * @see {@link ../../../../assets/fonts/japanese/font-catalog-enriched.json} — source data
 */

import type { FontMetadata, FontCategory, FontTag } from './font-catalog';
import { FONT_CATALOG } from './font-catalog';
import enrichedData from '../../../../../assets/fonts/japanese/font-catalog-enriched.json';

// ---------------------------------------------------------------------------
// Types for the JSON structure
// ---------------------------------------------------------------------------

/** Shape of a single entry in font-catalog-enriched.json. */
interface EnrichedFontEntry {
  name: string;
  fontFamily: string;
  localFile: string;
  category: string;
  tags: string[];
  weight: [number, number];
  popularity: number;
  description: string;
  sourceCount: number;
}

/** Shape of the top-level enriched catalog JSON. */
interface EnrichedCatalogJson {
  fonts: EnrichedFontEntry[];
}

// ---------------------------------------------------------------------------
// Valid values for type narrowing
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set<string>(['serif', 'sans', 'display', 'handwriting', 'monospace']);

const VALID_TAGS = new Set<string>([
  '力強い', 'エレガント', 'カジュアル', 'ポップ', 'フォーマル',
  'レトロ', 'モダン', '手書き風', 'クール', 'かわいい',
  '読みやすい', '太字', '細字', 'ニュース', 'ビジネス',
  'デザイン', 'インパクト', '高級', 'ナチュラル', 'テクノ',
]);

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an enriched JSON entry to a FontMetadata object.
 * Filters out invalid categories/tags and ensures type safety.
 */
function toFontMetadata(entry: EnrichedFontEntry): FontMetadata {
  const category: FontCategory = VALID_CATEGORIES.has(entry.category)
    ? (entry.category as FontCategory)
    : 'display';

  const tags: FontTag[] = entry.tags.filter(
    (t): t is FontTag => VALID_TAGS.has(t),
  );

  // Ensure at least one tag
  if (tags.length === 0) {
    tags.push('デザイン');
  }

  return {
    family: entry.fontFamily,
    category,
    weight: [entry.weight[0], entry.weight[1]] as const,
    japaneseSupport: true,
    tags: tags as readonly FontTag[],
    popularity: Math.max(1, Math.min(10, entry.popularity)),
  };
}

// ---------------------------------------------------------------------------
// Catalog instances (lazy-initialized singletons)
// ---------------------------------------------------------------------------

let _localCatalog: readonly FontMetadata[] | null = null;
let _mergedCatalog: readonly FontMetadata[] | null = null;
let _localPathMap: ReadonlyMap<string, string> | null = null;

/**
 * Build the local font catalog from enriched JSON.
 * Called once, then cached.
 */
function buildLocalCatalog(): readonly FontMetadata[] {
  const data = enrichedData as unknown as EnrichedCatalogJson;
  return data.fonts.map(toFontMetadata);
}

/**
 * Build a map of family name → local file path.
 */
function buildPathMap(): ReadonlyMap<string, string> {
  const data = enrichedData as unknown as EnrichedCatalogJson;
  const map = new Map<string, string>();
  for (const entry of data.fonts) {
    map.set(entry.fontFamily, entry.localFile);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the local Japanese font catalog (776 fonts).
 * @returns Readonly array of FontMetadata for all local fonts.
 */
export function getLocalFontCatalog(): readonly FontMetadata[] {
  if (!_localCatalog) {
    _localCatalog = buildLocalCatalog();
  }
  return _localCatalog;
}

/**
 * Resolve a font family name to its local file path (relative to assets/fonts/japanese/).
 * @param family - Font family name to look up.
 * @returns The relative path to the font file, or undefined if not found.
 */
export function getLocalFontPath(family: string): string | undefined {
  if (!_localPathMap) {
    _localPathMap = buildPathMap();
  }
  return _localPathMap.get(family);
}

/**
 * Get the merged catalog: built-in 55 fonts + 776 local fonts, deduplicated.
 *
 * Deduplication: if a built-in font and a local font share the same family name
 * (case-insensitive), the built-in entry takes priority (it has curated metadata).
 *
 * @returns Readonly array of FontMetadata for the combined catalog.
 */
export function getMergedCatalog(): readonly FontMetadata[] {
  if (!_mergedCatalog) {
    const seen = new Set(
      FONT_CATALOG.map((f) => f.family.toLowerCase()),
    );
    const dedupedLocal: FontMetadata[] = [];
    for (const f of getLocalFontCatalog()) {
      const key = f.family.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dedupedLocal.push(f);
      }
    }
    _mergedCatalog = [...FONT_CATALOG, ...dedupedLocal];
  }
  return _mergedCatalog;
}

/**
 * Check whether a given font family is a local font (not a built-in/system font).
 * @param family - Font family name.
 * @returns True if the family is in the local enriched catalog.
 */
export function isLocalFont(family: string): boolean {
  return getLocalFontPath(family) !== undefined;
}
