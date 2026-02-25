/**
 * @module GoogleFontsBrowser
 * Modal/panel UI component for browsing, previewing, and downloading Google Fonts.
 *
 * Features:
 * - Category filter tabs (All / Sans-Serif / Serif / Display / Handwriting / Monospace)
 * - Text search by font name
 * - Customizable preview text
 * - Popularity / Date sort toggle
 * - Paginated font list with download buttons
 * - Download progress indicator per font
 *
 * @see google-fonts-store.ts — Zustand store backing this component
 * @see FontSelector.tsx — Parent integration point
 * @see FONT-001: Google Fonts integration
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useGoogleFontsStore } from './google-fonts-store';
import type { GoogleFontCategory, GoogleFontSortOrder } from './google-fonts-store';
import { t } from '../../i18n';

// ── Constants ────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ value: GoogleFontCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'display', label: 'Display' },
  { value: 'handwriting', label: 'Handwriting' },
  { value: 'monospace', label: 'Monospace' },
];

const SORT_OPTIONS: Array<{ value: GoogleFontSortOrder; label: string }> = [
  { value: 'popularity', label: 'Popular' },
  { value: 'date', label: 'Newest' },
];

// ── Styles ───────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 600,
    maxWidth: '90vw',
    height: 500,
    maxHeight: '80vh',
    background: 'var(--bg-secondary, #2d2d2d)',
    border: '1px solid var(--border-color, #555)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color, #555)',
    background: 'var(--bg-primary, #1e1e1e)',
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: 14,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: 18,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  toolbar: {
    padding: '6px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    borderBottom: '1px solid var(--border-color, #555)',
  },
  searchRow: {
    display: 'flex',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid var(--border-color, #555)',
    borderRadius: 3,
    background: 'var(--bg-primary, #1e1e1e)',
    color: 'inherit',
    fontSize: 12,
    outline: 'none',
  },
  filterRow: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  categoryBtn: (active: boolean) => ({
    padding: '2px 8px',
    fontSize: 11,
    border: '1px solid',
    borderColor: active ? 'var(--accent-color, #0078d4)' : 'var(--border-color, #555)',
    borderRadius: 3,
    background: active ? 'var(--accent-color, #0078d4)' : 'transparent',
    color: active ? '#fff' : 'inherit',
    cursor: 'pointer',
  }),
  sortBtn: (active: boolean) => ({
    padding: '2px 6px',
    fontSize: 11,
    border: 'none',
    background: active ? 'var(--accent-dim, #004080)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary, #aaa)',
    cursor: 'pointer',
    borderRadius: 2,
  }),
  previewInput: {
    flex: 1,
    padding: '3px 6px',
    fontSize: 11,
    border: '1px solid var(--border-color, #555)',
    borderRadius: 3,
    background: 'var(--bg-primary, #1e1e1e)',
    color: 'inherit',
    outline: 'none',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  fontItem: (isHighlight: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border-color, #333)',
    background: isHighlight ? 'var(--bg-hover, #383838)' : 'transparent',
  }),
  fontInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  fontFamily: {
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  fontPreview: (family: string) => ({
    fontSize: 14,
    fontFamily: `"${family}", sans-serif`,
    opacity: 0.8,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  categoryLabel: {
    fontSize: 10,
    opacity: 0.5,
    marginLeft: 4,
  },
  downloadBtn: {
    padding: '3px 10px',
    fontSize: 11,
    border: '1px solid var(--accent-color, #0078d4)',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--accent-color, #0078d4)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    marginLeft: 8,
  },
  downloadedBadge: {
    padding: '3px 10px',
    fontSize: 11,
    border: '1px solid var(--success-color, #4caf50)',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--success-color, #4caf50)',
    whiteSpace: 'nowrap' as const,
    marginLeft: 8,
  },
  downloadingBadge: {
    padding: '3px 10px',
    fontSize: 11,
    border: '1px solid var(--warning-color, #ff9800)',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--warning-color, #ff9800)',
    whiteSpace: 'nowrap' as const,
    marginLeft: 8,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    borderTop: '1px solid var(--border-color, #555)',
    fontSize: 11,
    color: 'var(--text-secondary, #aaa)',
  },
  pageBtn: (disabled: boolean) => ({
    padding: '2px 8px',
    fontSize: 11,
    border: '1px solid var(--border-color, #555)',
    borderRadius: 3,
    background: 'transparent',
    color: disabled ? 'var(--text-disabled, #666)' : 'inherit',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }),
  emptyState: {
    padding: 24,
    textAlign: 'center' as const,
    opacity: 0.6,
    fontSize: 13,
  },
  loadingState: {
    padding: 24,
    textAlign: 'center' as const,
    opacity: 0.6,
    fontSize: 13,
  },
};

// ── Props ────────────────────────────────────────────────────────────────

interface GoogleFontsBrowserProps {
  /** Callback when a font is downloaded and ready to use. */
  onFontDownloaded?: (family: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Google Fonts browser panel.
 * Renders as a modal overlay for searching, previewing, and downloading Google Fonts.
 */
export function GoogleFontsBrowser({ onFontDownloaded }: GoogleFontsBrowserProps): React.JSX.Element | null {
  const store = useGoogleFontsStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus search input when panel opens
  useEffect(() => {
    if (store.isOpen) {
      const timeoutId = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [store.isOpen]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!store.isOpen) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        store.close();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [store.isOpen, store.close]);

  /** Handle search input with debounce. */
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Update query immediately for display
      useGoogleFontsStore.setState({ query: value });
      // Debounce the actual search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        store.setQuery(value);
      }, 300);
    },
    [store],
  );

  /** Handle font download. */
  const handleDownload = useCallback(
    async (family: string) => {
      const result = await store.downloadFont(family);
      if (result && onFontDownloaded) {
        onFontDownloaded(result);
      }
    },
    [store, onFontDownloaded],
  );

  /** Handle overlay click (close if clicking outside panel). */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        store.close();
      }
    },
    [store],
  );

  if (!store.isOpen) return null;

  const currentPage = Math.floor(store.offset / store.pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(store.total / store.pageSize));
  const hasPrev = store.offset > 0;
  const hasNext = store.offset + store.pageSize < store.total;

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>{t('googleFonts.title')}</span>
          <button
            type="button"
            style={styles.closeBtn}
            onClick={store.close}
            title={t('googleFonts.close')}
          >
            x
          </button>
        </div>

        {/* Toolbar */}
        <div style={styles.toolbar}>
          {/* Search + Sort */}
          <div style={styles.searchRow}>
            <input
              ref={searchInputRef}
              type="text"
              style={styles.searchInput}
              placeholder={t('googleFonts.searchPlaceholder')}
              value={store.query}
              onChange={handleSearchChange}
            />
            <div style={{ display: 'flex', gap: 2 }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  style={styles.sortBtn(store.sort === opt.value)}
                  onClick={() => store.setSort(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category filters + Preview text */}
          <div style={styles.filterRow}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                style={styles.categoryBtn(store.category === cat.value)}
                onClick={() => store.setCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <input
              type="text"
              style={{ ...styles.previewInput, maxWidth: 160 }}
              value={store.previewText}
              onChange={(e) => store.setPreviewText(e.target.value)}
              placeholder={t('googleFonts.previewPlaceholder')}
            />
          </div>
        </div>

        {/* Font list */}
        <div style={styles.listContainer}>
          {store.isLoading && (
            <div style={styles.loadingState}>{t('googleFonts.loading')}</div>
          )}

          {!store.isLoading && store.error && (
            <div style={styles.emptyState}>{store.error}</div>
          )}

          {!store.isLoading && !store.error && store.fonts.length === 0 && (
            <div style={styles.emptyState}>{t('googleFonts.noResults')}</div>
          )}

          {!store.isLoading &&
            store.fonts.map((font) => {
              const isDownloading = store.downloadingFamilies.has(font.family);
              const isDownloaded = font.downloaded || store.downloadedFamilies.has(font.family);

              return (
                <div
                  key={font.family}
                  style={styles.fontItem(false)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      'var(--bg-hover, #383838)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  <div style={styles.fontInfo}>
                    <div style={styles.fontFamily}>
                      {font.family}
                      <span style={styles.categoryLabel}>{font.category}</span>
                    </div>
                    <div style={styles.fontPreview(isDownloaded ? font.family : 'sans-serif')}>
                      {store.previewText}
                    </div>
                  </div>

                  {isDownloading && (
                    <span style={styles.downloadingBadge}>
                      {t('googleFonts.downloading')}
                    </span>
                  )}

                  {!isDownloading && isDownloaded && (
                    <span style={styles.downloadedBadge}>
                      {t('googleFonts.downloaded')}
                    </span>
                  )}

                  {!isDownloading && !isDownloaded && (
                    <button
                      type="button"
                      style={styles.downloadBtn}
                      onClick={() => void handleDownload(font.family)}
                    >
                      {t('googleFonts.download')}
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {/* Footer with pagination */}
        <div style={styles.footer}>
          <span>
            {store.total > 0
              ? `${store.offset + 1}-${Math.min(store.offset + store.pageSize, store.total)} / ${store.total}`
              : t('googleFonts.noResults')}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              style={styles.pageBtn(!hasPrev)}
              disabled={!hasPrev}
              onClick={() => void store.prevPage()}
            >
              &lt;
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              style={styles.pageBtn(!hasNext)}
              disabled={!hasNext}
              onClick={() => void store.nextPage()}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
