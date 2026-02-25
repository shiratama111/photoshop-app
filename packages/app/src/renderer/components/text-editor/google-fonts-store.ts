/**
 * @module google-fonts-store
 * Zustand store for Google Fonts browser state in the renderer process.
 *
 * Manages:
 * - Font search results (query, category, sort, pagination)
 * - Download state tracking (downloading, downloaded families)
 * - Runtime FontFace registration for downloaded Google Fonts
 * - Rehydration of previously downloaded fonts on startup
 *
 * @see GoogleFontsBrowser.tsx — UI component
 * @see google-fonts.ts — Main process IPC handlers
 * @see FONT-001: Google Fonts integration
 */

import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────────

/** A Google Font entry returned from the main process search. */
export interface GoogleFontEntry {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  lastModified: string;
  downloaded: boolean;
}

/** Search result from the main process. */
export interface GoogleFontSearchResult {
  fonts: GoogleFontEntry[];
  total: number;
  offset: number;
  limit: number;
}

/** Supported Google Fonts category values. */
export type GoogleFontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace';

/** Sort order for font search. */
export type GoogleFontSortOrder = 'popularity' | 'date';

/** Downloaded font metadata from the main process. */
interface DownloadedFontMeta {
  family: string;
  category: string;
  variant: string;
  downloadedAt: string;
  fileName: string;
}

// ── Electron API access ──────────────────────────────────────────────────

/** Shape of the electronAPI Google Fonts methods. */
interface GoogleFontsElectronAPI {
  searchGoogleFonts?: (
    query: string,
    category: string,
    sort: string,
    offset: number,
    limit: number,
  ) => Promise<GoogleFontSearchResult>;
  downloadGoogleFont?: (
    family: string,
    variant?: string,
  ) => Promise<{ filePath: string; data: ArrayBuffer } | null>;
  getDownloadedGoogleFonts?: () => Promise<DownloadedFontMeta[]>;
  loadGoogleFontFile?: (
    family: string,
  ) => Promise<{ family: string; data: ArrayBuffer } | null>;
}

/**
 * Get the electronAPI object from the window, safely typed.
 * @returns The Google Fonts portion of the electronAPI.
 */
function getElectronAPI(): GoogleFontsElectronAPI {
  return (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI ?? {};
}

/**
 * Register a font in the browser runtime using the FontFace API.
 * @param familyName - The CSS font-family name.
 * @param data - The font file data as ArrayBuffer.
 */
async function registerFontFace(familyName: string, data: ArrayBuffer): Promise<void> {
  const fontFace = new FontFace(familyName, data);
  await fontFace.load();
  document.fonts.add(fontFace);
}

// ── Type guards ──────────────────────────────────────────────────────────

/**
 * Type guard for GoogleFontSearchResult.
 * @param value - The value to check.
 * @returns True if value matches the expected shape.
 */
function isSearchResult(value: unknown): value is GoogleFontSearchResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.fonts) &&
    typeof obj.total === 'number' &&
    typeof obj.offset === 'number' &&
    typeof obj.limit === 'number'
  );
}

/**
 * Type guard for DownloadedFontMeta.
 * @param value - The value to check.
 * @returns True if value is a valid DownloadedFontMeta.
 */
function isDownloadedFontMeta(value: unknown): value is DownloadedFontMeta {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.family === 'string' &&
    typeof obj.category === 'string' &&
    typeof obj.variant === 'string' &&
    typeof obj.downloadedAt === 'string' &&
    typeof obj.fileName === 'string'
  );
}

// ── Store ────────────────────────────────────────────────────────────────

/** State shape for the Google Fonts store. */
export interface GoogleFontsState {
  /** Whether the browser panel is open. */
  isOpen: boolean;
  /** Current search query. */
  query: string;
  /** Current category filter. */
  category: GoogleFontCategory | 'all';
  /** Current sort order. */
  sort: GoogleFontSortOrder;
  /** Preview text for font samples. */
  previewText: string;
  /** Search results (current page). */
  fonts: GoogleFontEntry[];
  /** Total count of matching fonts. */
  total: number;
  /** Current pagination offset. */
  offset: number;
  /** Page size. */
  pageSize: number;
  /** Whether a search is in progress. */
  isLoading: boolean;
  /** Families currently being downloaded. */
  downloadingFamilies: Set<string>;
  /** All downloaded family names (for badge display). */
  downloadedFamilies: Set<string>;
  /** Whether initial rehydration has completed. */
  rehydrated: boolean;
  /** Error message, if any. */
  error: string | null;
}

/** Actions available on the Google Fonts store. */
export interface GoogleFontsActions {
  /** Open the Google Fonts browser panel. */
  open: () => void;
  /** Close the Google Fonts browser panel. */
  close: () => void;
  /** Set the search query and trigger a search. */
  setQuery: (query: string) => void;
  /** Set the category filter and trigger a search. */
  setCategory: (category: GoogleFontCategory | 'all') => void;
  /** Set the sort order and trigger a search. */
  setSort: (sort: GoogleFontSortOrder) => void;
  /** Set the preview text. */
  setPreviewText: (text: string) => void;
  /** Execute a search with current parameters. */
  search: () => Promise<void>;
  /** Load the next page of results. */
  nextPage: () => Promise<void>;
  /** Load the previous page of results. */
  prevPage: () => Promise<void>;
  /** Download a font by family name. Returns the family name on success. */
  downloadFont: (family: string) => Promise<string | null>;
  /** Rehydrate downloaded fonts (register them in the browser on startup). */
  rehydrate: () => Promise<void>;
  /** Get list of downloaded font family names. */
  getDownloadedFamilyNames: () => string[];
}

const DEFAULT_PAGE_SIZE = 50;
let latestSearchRequestId = 0;

export const useGoogleFontsStore = create<GoogleFontsState & GoogleFontsActions>((set, get) => ({
  // State
  isOpen: false,
  query: '',
  category: 'all',
  sort: 'popularity',
  previewText: 'The quick brown fox jumps over the lazy dog',
  fonts: [],
  total: 0,
  offset: 0,
  pageSize: DEFAULT_PAGE_SIZE,
  isLoading: false,
  downloadingFamilies: new Set(),
  downloadedFamilies: new Set(),
  rehydrated: false,
  error: null,

  // Actions
  open: (): void => {
    set({ isOpen: true });
    const state = get();
    if (state.fonts.length === 0 && !state.isLoading) {
      void state.search();
    }
  },

  close: (): void => {
    latestSearchRequestId += 1;
    set({ isOpen: false, isLoading: false });
  },

  setQuery: (query: string): void => {
    set({ query, offset: 0 });
    void get().search();
  },

  setCategory: (category: GoogleFontCategory | 'all'): void => {
    set({ category, offset: 0 });
    void get().search();
  },

  setSort: (sort: GoogleFontSortOrder): void => {
    set({ sort, offset: 0 });
    void get().search();
  },

  setPreviewText: (text: string): void => {
    set({ previewText: text });
  },

  search: async (): Promise<void> => {
    const { query, category, sort, offset, pageSize } = get();
    const api = getElectronAPI();
    if (!api.searchGoogleFonts) {
      set({ error: 'Google Fonts API not available' });
      return;
    }

    const requestId = ++latestSearchRequestId;
    set({ isLoading: true, error: null });
    try {
      const result: unknown = await api.searchGoogleFonts(
        query,
        category,
        sort,
        offset,
        pageSize,
      );
      if (requestId !== latestSearchRequestId) {
        return;
      }
      if (isSearchResult(result)) {
        // Mark fonts as downloaded if they're in our set
        const downloaded = get().downloadedFamilies;
        const fonts = result.fonts.map((f) => ({
          ...f,
          downloaded: f.downloaded || downloaded.has(f.family),
        }));
        set({
          fonts,
          total: result.total,
          offset: result.offset,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, error: 'Invalid search response' });
      }
    } catch {
      if (requestId !== latestSearchRequestId) {
        return;
      }
      set({ isLoading: false, error: 'Search failed' });
    }
  },

  nextPage: async (): Promise<void> => {
    const { offset, pageSize, total } = get();
    const nextOffset = offset + pageSize;
    if (nextOffset >= total) return;
    set({ offset: nextOffset });
    await get().search();
  },

  prevPage: async (): Promise<void> => {
    const { offset, pageSize } = get();
    const prevOffset = Math.max(0, offset - pageSize);
    if (prevOffset === offset) return;
    set({ offset: prevOffset });
    await get().search();
  },

  downloadFont: async (family: string): Promise<string | null> => {
    const api = getElectronAPI();
    if (!api.downloadGoogleFont) return null;
    if (get().downloadingFamilies.has(family)) return null;

    // Mark as downloading
    const downloading = new Set(get().downloadingFamilies);
    downloading.add(family);
    set({ downloadingFamilies: downloading });

    try {
      const result: unknown = await api.downloadGoogleFont(family);
      if (
        result !== null &&
        typeof result === 'object' &&
        'data' in (result as Record<string, unknown>)
      ) {
        const typed = result as { filePath: string; data: ArrayBuffer };
        // Register in browser runtime
        await registerFontFace(family, typed.data);

        // Update state
        const newDownloading = new Set(get().downloadingFamilies);
        newDownloading.delete(family);
        const newDownloaded = new Set(get().downloadedFamilies);
        newDownloaded.add(family);

        // Update font list to reflect download
        const updatedFonts = get().fonts.map((f) =>
          f.family === family ? { ...f, downloaded: true } : f,
        );

        set({
          downloadingFamilies: newDownloading,
          downloadedFamilies: newDownloaded,
          fonts: updatedFonts,
        });

        return family;
      }

      // Download failed
      const failedDownloading = new Set(get().downloadingFamilies);
      failedDownloading.delete(family);
      set({ downloadingFamilies: failedDownloading });
      return null;
    } catch {
      const failedDownloading = new Set(get().downloadingFamilies);
      failedDownloading.delete(family);
      set({ downloadingFamilies: failedDownloading });
      return null;
    }
  },

  rehydrate: async (): Promise<void> => {
    if (get().rehydrated) return;
    set({ rehydrated: true });

    const api = getElectronAPI();
    if (!api.getDownloadedGoogleFonts || !api.loadGoogleFontFile) return;

    try {
      const rawList: unknown = await api.getDownloadedGoogleFonts();
      if (!Array.isArray(rawList)) return;

      const validEntries = rawList.filter(isDownloadedFontMeta);
      const families = new Set<string>();

      for (const entry of validEntries) {
        try {
          const rawResult: unknown = await api.loadGoogleFontFile(entry.family);
          if (
            rawResult !== null &&
            typeof rawResult === 'object' &&
            'data' in (rawResult as Record<string, unknown>)
          ) {
            const typed = rawResult as { family: string; data: ArrayBuffer };
            await registerFontFace(typed.family, typed.data);
            families.add(entry.family);
          }
        } catch {
          // Skip broken entries
        }
      }

      set({ downloadedFamilies: families });
    } catch {
      // Rehydration failed — non-critical
    }
  },

  getDownloadedFamilyNames: (): string[] => {
    return Array.from(get().downloadedFamilies);
  },
}));
