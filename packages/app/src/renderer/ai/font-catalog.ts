/**
 * @module ai/font-catalog
 * Font metadata catalog for the AI font recommendation engine.
 *
 * Provides:
 * - `FontMetadata` interface describing each font's attributes
 * - `FontCategory` and `FontTag` union types for type-safe categorization
 * - `FONT_CATALOG`: 55 fonts with metadata (system, Japanese, Google Fonts popular)
 * - Each font tagged with Japanese/English attributes for mood/style matching
 *
 * Font categories:
 * - serif: 明朝系、セリフ体 (formal, elegant, traditional)
 * - sans: ゴシック系、サンセリフ体 (clean, modern, readable)
 * - display: ディスプレイ系 (impact, decorative, headline)
 * - handwriting: 手書き系 (casual, personal, warm)
 * - monospace: 等幅フォント (code, technical)
 *
 * @see AIFONT-001: フォント自動選択AI
 * @see {@link ./font-selector-ai.ts} — consumer of this catalog
 * @see {@link ../components/text-editor/FontSelector.tsx} — existing font system
 * @see {@link ../editor-actions/style-vocabulary.ts} — adjective vocabulary
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Font category classification. */
export type FontCategory = 'serif' | 'sans' | 'display' | 'handwriting' | 'monospace';

/**
 * Mood/style tags for font matching.
 * Bilingual: each tag has a canonical Japanese form used for matching.
 */
export type FontTag =
  | '力強い'
  | 'エレガント'
  | 'カジュアル'
  | 'ポップ'
  | 'フォーマル'
  | 'レトロ'
  | 'モダン'
  | '手書き風'
  | 'クール'
  | 'かわいい'
  | '読みやすい'
  | '太字'
  | '細字'
  | 'ニュース'
  | 'ビジネス'
  | 'デザイン'
  | 'インパクト'
  | '高級'
  | 'ナチュラル'
  | 'テクノ';

/** Metadata for a single font entry in the catalog. */
export interface FontMetadata {
  /** Font family name (matches CSS font-family). */
  family: string;
  /** Font category classification. */
  category: FontCategory;
  /** Available weight range: [min, max] (100-900 scale). */
  weight: readonly [number, number];
  /** Whether this font supports Japanese characters. */
  japaneseSupport: boolean;
  /** Mood/style tags for matching with adjective descriptions. */
  tags: readonly FontTag[];
  /** Popularity score (1-10, higher = more commonly used). */
  popularity: number;
}

// ---------------------------------------------------------------------------
// Tag-to-English mapping (for cross-language matching)
// ---------------------------------------------------------------------------

/**
 * Bidirectional mapping between Japanese FontTag values and English keywords.
 * Used by the recommendation engine to match English adjectives to Japanese tags.
 */
export const TAG_ENGLISH_MAP: ReadonlyMap<FontTag, readonly string[]> = new Map<FontTag, readonly string[]>([
  ['力強い', ['powerful', 'strong', 'bold', 'impactful']],
  ['エレガント', ['elegant', 'classy', 'sophisticated', 'graceful']],
  ['カジュアル', ['casual', 'relaxed', 'informal', 'friendly']],
  ['ポップ', ['pop', 'playful', 'fun', 'cute']],
  ['フォーマル', ['formal', 'professional', 'official', 'business']],
  ['レトロ', ['retro', 'vintage', 'classic', 'old-fashioned']],
  ['モダン', ['modern', 'contemporary', 'sleek', 'minimal']],
  ['手書き風', ['handwritten', 'handwriting', 'script', 'cursive']],
  ['クール', ['cool', 'stylish', 'sharp', 'edgy']],
  ['かわいい', ['cute', 'kawaii', 'adorable', 'sweet']],
  ['読みやすい', ['readable', 'legible', 'clear']],
  ['太字', ['bold', 'heavy', 'thick']],
  ['細字', ['thin', 'light', 'delicate', 'fine']],
  ['ニュース', ['news', 'breaking', 'headline', 'telop']],
  ['ビジネス', ['business', 'corporate', 'professional']],
  ['デザイン', ['design', 'decorative', 'artistic']],
  ['インパクト', ['impact', 'attention', 'striking']],
  ['高級', ['luxury', 'premium', 'high-end', 'upscale']],
  ['ナチュラル', ['natural', 'organic', 'warm']],
  ['テクノ', ['techno', 'tech', 'digital', 'futuristic']],
]);

// ---------------------------------------------------------------------------
// Font Catalog (55 fonts)
// ---------------------------------------------------------------------------

/**
 * Complete font catalog with metadata for AI-based recommendation.
 * Includes system fonts, popular Japanese fonts, and Google Fonts staples.
 *
 * Organized by:
 * 1. Japanese fonts (ゴシック, 明朝, 丸ゴシック, 手書き, デザイン)
 * 2. English sans-serif fonts
 * 3. English serif fonts
 * 4. Display/Impact fonts
 * 5. Handwriting/Script fonts
 * 6. Monospace fonts
 */
export const FONT_CATALOG: readonly FontMetadata[] = [
  // ── Japanese: ゴシック系 (Gothic / Sans) ──────────────────────────────────
  {
    family: 'Noto Sans JP',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: true,
    tags: ['モダン', '読みやすい', 'ビジネス'],
    popularity: 10,
  },
  {
    family: 'Hiragino Sans',
    category: 'sans',
    weight: [300, 900],
    japaneseSupport: true,
    tags: ['モダン', '読みやすい', 'クール'],
    popularity: 8,
  },
  {
    family: 'Yu Gothic',
    category: 'sans',
    weight: [400, 700],
    japaneseSupport: true,
    tags: ['モダン', 'ビジネス', '読みやすい'],
    popularity: 8,
  },
  {
    family: 'Meiryo',
    category: 'sans',
    weight: [400, 700],
    japaneseSupport: true,
    tags: ['読みやすい', 'ビジネス', 'モダン'],
    popularity: 7,
  },
  {
    family: 'M PLUS 1p',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: true,
    tags: ['モダン', 'カジュアル', '読みやすい'],
    popularity: 6,
  },
  {
    family: 'BIZ UDGothic',
    category: 'sans',
    weight: [400, 700],
    japaneseSupport: true,
    tags: ['ビジネス', '読みやすい', 'フォーマル'],
    popularity: 5,
  },
  {
    family: 'Zen Kaku Gothic New',
    category: 'sans',
    weight: [300, 900],
    japaneseSupport: true,
    tags: ['モダン', 'クール', '読みやすい'],
    popularity: 5,
  },

  // ── Japanese: 明朝系 (Mincho / Serif) ─────────────────────────────────────
  {
    family: 'Noto Serif JP',
    category: 'serif',
    weight: [200, 900],
    japaneseSupport: true,
    tags: ['エレガント', 'フォーマル', '高級'],
    popularity: 9,
  },
  {
    family: 'Yu Mincho',
    category: 'serif',
    weight: [400, 700],
    japaneseSupport: true,
    tags: ['エレガント', 'フォーマル', '高級'],
    popularity: 7,
  },
  {
    family: 'Hiragino Mincho ProN',
    category: 'serif',
    weight: [300, 600],
    japaneseSupport: true,
    tags: ['エレガント', '高級', 'フォーマル'],
    popularity: 7,
  },
  {
    family: 'Shippori Mincho',
    category: 'serif',
    weight: [400, 800],
    japaneseSupport: true,
    tags: ['エレガント', 'レトロ', '高級'],
    popularity: 5,
  },
  {
    family: 'BIZ UDMincho',
    category: 'serif',
    weight: [400, 700],
    japaneseSupport: true,
    tags: ['ビジネス', 'フォーマル', '読みやすい'],
    popularity: 5,
  },

  // ── Japanese: 丸ゴシック (Rounded Gothic) ─────────────────────────────────
  {
    family: 'M PLUS Rounded 1c',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: true,
    tags: ['かわいい', 'ポップ', 'カジュアル'],
    popularity: 7,
  },
  {
    family: 'Kosugi Maru',
    category: 'sans',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['かわいい', 'カジュアル', 'ナチュラル'],
    popularity: 5,
  },
  {
    family: 'Zen Maru Gothic',
    category: 'sans',
    weight: [300, 900],
    japaneseSupport: true,
    tags: ['かわいい', 'ポップ', 'ナチュラル'],
    popularity: 5,
  },

  // ── Japanese: 手書き / デザイン ───────────────────────────────────────────
  {
    family: 'Klee One',
    category: 'handwriting',
    weight: [400, 600],
    japaneseSupport: true,
    tags: ['手書き風', 'ナチュラル', 'かわいい'],
    popularity: 6,
  },
  {
    family: 'Zen Kurenaido',
    category: 'handwriting',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['手書き風', 'カジュアル', 'ナチュラル'],
    popularity: 4,
  },
  {
    family: 'Hachi Maru Pop',
    category: 'handwriting',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['手書き風', 'かわいい', 'ポップ'],
    popularity: 4,
  },
  {
    family: 'Dela Gothic One',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['力強い', 'インパクト', '太字'],
    popularity: 5,
  },
  {
    family: 'Reggae One',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['デザイン', 'カジュアル', 'ポップ'],
    popularity: 4,
  },
  {
    family: 'RocknRoll One',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['力強い', 'カジュアル', 'ポップ'],
    popularity: 4,
  },
  {
    family: 'DotGothic16',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['レトロ', 'テクノ', 'デザイン'],
    popularity: 4,
  },
  {
    family: 'Stick',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: true,
    tags: ['カジュアル', 'デザイン', 'ポップ'],
    popularity: 3,
  },

  // ── English: Sans-Serif ───────────────────────────────────────────────────
  {
    family: 'Arial',
    category: 'sans',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['読みやすい', 'ビジネス', 'モダン'],
    popularity: 9,
  },
  {
    family: 'Helvetica',
    category: 'sans',
    weight: [300, 700],
    japaneseSupport: false,
    tags: ['モダン', 'クール', 'ビジネス'],
    popularity: 9,
  },
  {
    family: 'Roboto',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: false,
    tags: ['モダン', '読みやすい', 'クール'],
    popularity: 10,
  },
  {
    family: 'Open Sans',
    category: 'sans',
    weight: [300, 800],
    japaneseSupport: false,
    tags: ['読みやすい', 'カジュアル', 'モダン'],
    popularity: 9,
  },
  {
    family: 'Inter',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: false,
    tags: ['モダン', '読みやすい', 'クール'],
    popularity: 8,
  },
  {
    family: 'Montserrat',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: false,
    tags: ['モダン', 'クール', 'デザイン'],
    popularity: 8,
  },
  {
    family: 'Lato',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: false,
    tags: ['読みやすい', 'ナチュラル', 'モダン'],
    popularity: 7,
  },
  {
    family: 'Poppins',
    category: 'sans',
    weight: [100, 900],
    japaneseSupport: false,
    tags: ['モダン', 'ポップ', 'カジュアル'],
    popularity: 8,
  },
  {
    family: 'Oswald',
    category: 'sans',
    weight: [200, 700],
    japaneseSupport: false,
    tags: ['力強い', 'インパクト', 'ニュース'],
    popularity: 7,
  },
  {
    family: 'Verdana',
    category: 'sans',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['読みやすい', 'ビジネス', 'カジュアル'],
    popularity: 6,
  },
  {
    family: 'Nunito',
    category: 'sans',
    weight: [200, 900],
    japaneseSupport: false,
    tags: ['かわいい', 'カジュアル', 'ポップ'],
    popularity: 6,
  },

  // ── English: Serif ────────────────────────────────────────────────────────
  {
    family: 'Georgia',
    category: 'serif',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['エレガント', 'フォーマル', '高級'],
    popularity: 8,
  },
  {
    family: 'Times New Roman',
    category: 'serif',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['フォーマル', 'レトロ', 'ビジネス'],
    popularity: 8,
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    weight: [400, 900],
    japaneseSupport: false,
    tags: ['エレガント', '高級', 'デザイン'],
    popularity: 7,
  },
  {
    family: 'Merriweather',
    category: 'serif',
    weight: [300, 900],
    japaneseSupport: false,
    tags: ['読みやすい', 'フォーマル', 'エレガント'],
    popularity: 7,
  },
  {
    family: 'Lora',
    category: 'serif',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['エレガント', 'ナチュラル', '読みやすい'],
    popularity: 6,
  },
  {
    family: 'Libre Baskerville',
    category: 'serif',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['フォーマル', 'エレガント', 'レトロ'],
    popularity: 5,
  },

  // ── Display / Impact ──────────────────────────────────────────────────────
  {
    family: 'Impact',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['力強い', 'インパクト', 'ニュース'],
    popularity: 9,
  },
  {
    family: 'Anton',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['力強い', 'インパクト', '太字'],
    popularity: 7,
  },
  {
    family: 'Bebas Neue',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['力強い', 'モダン', 'インパクト'],
    popularity: 7,
  },
  {
    family: 'Righteous',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['レトロ', 'デザイン', 'カジュアル'],
    popularity: 5,
  },
  {
    family: 'Fredoka One',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['ポップ', 'かわいい', 'カジュアル'],
    popularity: 5,
  },
  {
    family: 'Black Ops One',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['力強い', 'クール', 'テクノ'],
    popularity: 4,
  },
  {
    family: 'Bungee',
    category: 'display',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['インパクト', 'デザイン', 'ポップ'],
    popularity: 4,
  },

  // ── Handwriting / Script ──────────────────────────────────────────────────
  {
    family: 'Pacifico',
    category: 'handwriting',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['手書き風', 'カジュアル', 'ナチュラル'],
    popularity: 7,
  },
  {
    family: 'Dancing Script',
    category: 'handwriting',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['手書き風', 'エレガント', 'かわいい'],
    popularity: 6,
  },
  {
    family: 'Caveat',
    category: 'handwriting',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['手書き風', 'カジュアル', 'ナチュラル'],
    popularity: 5,
  },
  {
    family: 'Satisfy',
    category: 'handwriting',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['手書き風', 'エレガント', '高級'],
    popularity: 5,
  },
  {
    family: 'Indie Flower',
    category: 'handwriting',
    weight: [400, 400],
    japaneseSupport: false,
    tags: ['手書き風', 'カジュアル', 'かわいい'],
    popularity: 5,
  },

  // ── Monospace ─────────────────────────────────────────────────────────────
  {
    family: 'Courier New',
    category: 'monospace',
    weight: [400, 700],
    japaneseSupport: false,
    tags: ['レトロ', 'テクノ', 'フォーマル'],
    popularity: 6,
  },
  {
    family: 'Source Code Pro',
    category: 'monospace',
    weight: [200, 900],
    japaneseSupport: false,
    tags: ['テクノ', 'モダン', '読みやすい'],
    popularity: 6,
  },
  {
    family: 'JetBrains Mono',
    category: 'monospace',
    weight: [100, 800],
    japaneseSupport: false,
    tags: ['テクノ', 'モダン', 'クール'],
    popularity: 5,
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup Utilities
// ---------------------------------------------------------------------------

/**
 * Find fonts in the catalog that have a specific tag.
 * @param tag - The FontTag to filter by.
 * @returns Array of FontMetadata entries that contain the given tag.
 */
export function findFontsByTag(tag: FontTag): readonly FontMetadata[] {
  return FONT_CATALOG.filter((font) => font.tags.includes(tag));
}

/**
 * Find fonts in the catalog that support Japanese.
 * @returns Array of FontMetadata entries with japaneseSupport === true.
 */
export function findJapaneseFonts(): readonly FontMetadata[] {
  return FONT_CATALOG.filter((font) => font.japaneseSupport);
}

/**
 * Find fonts in the catalog by category.
 * @param category - The FontCategory to filter by.
 * @returns Array of FontMetadata entries in the given category.
 */
export function findFontsByCategory(category: FontCategory): readonly FontMetadata[] {
  return FONT_CATALOG.filter((font) => font.category === category);
}

/**
 * Look up a font's metadata by family name (case-insensitive).
 * @param family - Font family name to search for.
 * @returns The matching FontMetadata or undefined.
 */
export function lookupFont(family: string): FontMetadata | undefined {
  const normalized = family.toLowerCase();
  return FONT_CATALOG.find((font) => font.family.toLowerCase() === normalized);
}
