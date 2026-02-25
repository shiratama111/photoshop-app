/**
 * @module i18n
 * Minimal i18n runtime for the Photoshop App.
 *
 * Usage:
 * ```ts
 * import { t, setLocale, getLocale } from '../renderer/i18n';
 *
 * setLocale('ja');          // switch to Japanese
 * t('menu.file');           // → 'ファイル'
 * t('missing.key');         // → 'missing.key' (fallback)
 * ```
 *
 * Design decisions:
 * - Pure functions with module-level state — no DOM or Electron dependency,
 *   so the module is usable from both main and renderer processes.
 * - Fallback chain: current locale → 'en' → raw key string.
 * - `setLocale` / `getLocale` allow runtime switching without restart.
 *
 * @see ./messages.ts for message catalogs
 */

import { en, localeCatalogs } from './messages';
import type { MessageCatalog } from './messages';

export type { MessageCatalog };

/** Currently active locale tag. */
let currentLocale = 'ja';

/**
 * Set the active locale.
 * @param locale - BCP-47 language tag (e.g. `'ja'`, `'en'`).
 * @throws {Error} If the locale has no registered catalog.
 */
export function setLocale(locale: string): void {
  if (!localeCatalogs[locale]) {
    throw new Error(`i18n: unknown locale "${locale}"`);
  }
  currentLocale = locale;
}

/** Return the currently active locale tag. */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Translate a message key.
 *
 * Lookup order:
 * 1. Current locale catalog
 * 2. English (`en`) fallback catalog
 * 3. The raw key string itself
 *
 * @param key - Dot-delimited message ID (e.g. `'menu.file.new'`).
 * @returns The translated string or the key if not found.
 */
export function t(key: string): string {
  const catalog: MessageCatalog | undefined = localeCatalogs[currentLocale];
  if (catalog && key in catalog) {
    return catalog[key];
  }
  // Fallback to English
  if (key in en) {
    return en[key];
  }
  // Ultimate fallback: return the key itself
  return key;
}
