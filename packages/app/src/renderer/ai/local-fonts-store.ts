/**
 * @module ai/local-fonts-store
 * Zustand store for lazy-loading local Japanese fonts into the browser runtime.
 *
 * Follows the same pattern as `google-fonts-store.ts` — fonts are loaded
 * on-demand via IPC and registered using the FontFace API.
 *
 * The pipeline calls `ensureFontLoaded(family)` after font selection but
 * before rendering, so the font is available for canvas/CSS rendering.
 *
 * @see {@link ./local-font-catalog.ts} — catalog and path resolution
 * @see {@link ../../main/font-list.ts} — IPC handler (font:loadLocalFont)
 * @see {@link ../../preload/index.ts} — bridge (loadLocalFont)
 * @see {@link ../../renderer/components/text-editor/google-fonts-store.ts} — similar pattern
 */

import { create } from 'zustand';
import { getLocalFontPath, isLocalFont } from './local-font-catalog';

// ---------------------------------------------------------------------------
// Electron API access
// ---------------------------------------------------------------------------

/** Shape of the electronAPI local font method. */
interface LocalFontElectronAPI {
  loadLocalFont?: (relativePath: string) => Promise<{ data: ArrayBuffer; name: string } | null>;
}

/**
 * Get the electronAPI object from the window, safely typed.
 */
function getElectronAPI(): LocalFontElectronAPI {
  if (typeof window === 'undefined') return {};
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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** State shape for the local fonts store. */
export interface LocalFontsState {
  /** Families that have been registered in the browser. */
  registeredFamilies: Set<string>;
  /** Families currently being loaded. */
  loadingFamilies: Set<string>;
  /** Families that failed to load. */
  failedFamilies: Set<string>;
}

/** Actions available on the local fonts store. */
export interface LocalFontsActions {
  /**
   * Ensure a local font is loaded and registered in the browser.
   * No-op if the font is already registered, not a local font, or currently loading.
   * @param family - Font family name.
   * @returns True if the font was successfully loaded (or was already loaded).
   */
  ensureFontLoaded: (family: string) => Promise<boolean>;

  /**
   * Ensure multiple fonts are loaded in parallel.
   * @param families - Array of font family names.
   * @returns Array of booleans indicating success for each font.
   */
  ensureFontsLoaded: (families: string[]) => Promise<boolean[]>;

  /**
   * Check if a font family is registered in the browser.
   * @param family - Font family name.
   */
  isFontRegistered: (family: string) => boolean;
}

export const useLocalFontsStore = create<LocalFontsState & LocalFontsActions>((set, get) => ({
  // State
  registeredFamilies: new Set(),
  loadingFamilies: new Set(),
  failedFamilies: new Set(),

  // Actions
  ensureFontLoaded: async (family: string): Promise<boolean> => {
    const state = get();

    // Already registered
    if (state.registeredFamilies.has(family)) return true;

    // Not a local font — nothing to do (it's a system/Google font)
    if (!isLocalFont(family)) return true;

    // Already loading
    if (state.loadingFamilies.has(family)) return false;

    // Previously failed
    if (state.failedFamilies.has(family)) return false;

    // Resolve path
    const relativePath = getLocalFontPath(family);
    if (!relativePath) return false;

    // Mark as loading
    const newLoading = new Set(state.loadingFamilies);
    newLoading.add(family);
    set({ loadingFamilies: newLoading });

    try {
      const api = getElectronAPI();
      if (!api.loadLocalFont) {
        // No IPC available (e.g. in tests) — mark as failed
        const failLoading = new Set(get().loadingFamilies);
        failLoading.delete(family);
        const newFailed = new Set(get().failedFamilies);
        newFailed.add(family);
        set({ loadingFamilies: failLoading, failedFamilies: newFailed });
        return false;
      }

      const result = await api.loadLocalFont(relativePath);
      if (!result) {
        const failLoading = new Set(get().loadingFamilies);
        failLoading.delete(family);
        const newFailed = new Set(get().failedFamilies);
        newFailed.add(family);
        set({ loadingFamilies: failLoading, failedFamilies: newFailed });
        return false;
      }

      // Register in browser
      await registerFontFace(family, result.data);

      // Update state
      const doneLoading = new Set(get().loadingFamilies);
      doneLoading.delete(family);
      const newRegistered = new Set(get().registeredFamilies);
      newRegistered.add(family);
      set({ loadingFamilies: doneLoading, registeredFamilies: newRegistered });

      return true;
    } catch {
      const failLoading = new Set(get().loadingFamilies);
      failLoading.delete(family);
      const newFailed = new Set(get().failedFamilies);
      newFailed.add(family);
      set({ loadingFamilies: failLoading, failedFamilies: newFailed });
      return false;
    }
  },

  ensureFontsLoaded: async (families: string[]): Promise<boolean[]> => {
    const { ensureFontLoaded } = get();
    return Promise.all(families.map((f) => ensureFontLoaded(f)));
  },

  isFontRegistered: (family: string): boolean => {
    return get().registeredFamilies.has(family);
  },
}));
