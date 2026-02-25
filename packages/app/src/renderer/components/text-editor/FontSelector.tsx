/**
 * @module components/text-editor/FontSelector
 * Searchable font dropdown with live font-name preview and custom font import.
 *
 * Features:
 * - System font enumeration via IPC
 * - Custom font loading via FontFace API (.ttf/.otf/.woff2)
 * - Drag-drop font files onto the selector
 * - localStorage persistence for custom fonts (Base64)
 * - Custom fonts displayed at top with badge
 *
 * @see font-list.ts (main process handler)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';

// ── Custom font persistence ──────────────────────────────────────────────

const CUSTOM_FONTS_STORAGE_KEY = 'photoshop-app:customFonts';

interface PersistedCustomFont {
  familyName: string;
  dataUrl: string;
}

/** Custom fonts currently registered in the runtime. */
let customFontNames: string[] = [];

function loadPersistedCustomFonts(): PersistedCustomFont[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FONTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PersistedCustomFont[];
  } catch {
    return [];
  }
}

function savePersistedCustomFonts(fonts: PersistedCustomFont[]): void {
  try {
    localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(fonts));
  } catch {
    // quota exceeded
  }
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getMimeForFont(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'otf') return 'font/otf';
  if (ext === 'woff2') return 'font/woff2';
  if (ext === 'woff') return 'font/woff';
  return 'font/ttf';
}

async function registerFontFace(familyName: string, buffer: ArrayBuffer): Promise<void> {
  const fontFace = new FontFace(familyName, buffer);
  await fontFace.load();
  document.fonts.add(fontFace);
}

/** Register a custom font from a File object. Returns the family name. */
async function registerCustomFontFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const familyName = `Custom: ${baseName}`;

  await registerFontFace(familyName, buffer);

  // Persist
  const dataUrl = arrayBufferToDataUrl(buffer, getMimeForFont(file.name));
  const persisted = loadPersistedCustomFonts();
  if (!persisted.some((f) => f.familyName === familyName)) {
    persisted.push({ familyName, dataUrl });
    savePersistedCustomFonts(persisted);
  }

  if (!customFontNames.includes(familyName)) {
    customFontNames = [...customFontNames, familyName];
  }

  return familyName;
}

/** Remove a custom font from persistence and runtime list. */
function removeCustomFont(familyName: string): void {
  const persisted = loadPersistedCustomFonts().filter((f) => f.familyName !== familyName);
  savePersistedCustomFonts(persisted);
  customFontNames = customFontNames.filter((n) => n !== familyName);
  // Note: FontFace cannot be removed from document.fonts by name easily,
  // but it will be gone on next app restart.
}

/** Re-register all persisted custom fonts on startup. */
let rehydrated = false;
async function rehydrateCustomFonts(): Promise<void> {
  if (rehydrated) return;
  rehydrated = true;
  const persisted = loadPersistedCustomFonts();
  for (const entry of persisted) {
    try {
      const buffer = dataUrlToArrayBuffer(entry.dataUrl);
      await registerFontFace(entry.familyName, buffer);
      if (!customFontNames.includes(entry.familyName)) {
        customFontNames = [...customFontNames, entry.familyName];
      }
    } catch {
      // skip broken entries
    }
  }
}

// ── System font fetching ─────────────────────────────────────────────────

/** Cached font list shared across all FontSelector instances. */
let fontCache: string[] | null = null;
let fontCachePromise: Promise<string[]> | null = null;

/** Fallback fonts used while system fonts are loading. */
const FALLBACK_FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Impact',
];

function getElectronAPI(): {
  getSystemFonts?: () => Promise<string[]>;
} {
  return (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI ?? {};
}

async function fetchSystemFonts(): Promise<string[]> {
  if (fontCache) return fontCache;
  if (fontCachePromise) return fontCachePromise;

  fontCachePromise = (async () => {
    try {
      const api = getElectronAPI();
      if (api.getSystemFonts) {
        const fonts = await api.getSystemFonts();
        if (Array.isArray(fonts) && fonts.length > 0) {
          fontCache = fonts;
          return fonts;
        }
      }
    } catch {
      // Fall through to fallback
    }
    fontCache = FALLBACK_FONTS;
    return FALLBACK_FONTS;
  })();

  return fontCachePromise;
}

// ── Component ────────────────────────────────────────────────────────────

const FONT_FILE_ACCEPT = '.ttf,.otf,.woff2,.woff';

interface FontSelectorProps {
  value: string;
  onChange: (fontFamily: string) => void;
}

export function FontSelector({ value, onChange }: FontSelectorProps): React.JSX.Element {
  const [systemFonts, setSystemFonts] = useState<string[]>(fontCache ?? FALLBACK_FONTS);
  const [customFonts, setCustomFonts] = useState<string[]>(customFontNames);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dragOver, setDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rehydrate custom fonts + fetch system fonts on first mount
  useEffect(() => {
    rehydrateCustomFonts().then(() => {
      setCustomFonts([...customFontNames]);
    });
    fetchSystemFonts().then((f) => setSystemFonts(f));
  }, []);

  /** Combined font list: custom fonts first, then system fonts. */
  const allFonts = useMemo(() => [...customFonts, ...systemFonts], [customFonts, systemFonts]);

  const filtered = useMemo(() => {
    if (!search) return allFonts;
    const q = search.toLowerCase();
    return allFonts.filter((f) => f.toLowerCase().includes(q));
  }, [allFonts, search]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSearch('');
    setHighlightIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSelect = useCallback(
    (font: string) => {
      onChange(font);
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          handleSelect(filtered[highlightIndex]);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [filtered, highlightIndex, handleSelect],
  );

  /** Import a font file (from file input or drag-drop). */
  const importFontFile = useCallback(
    async (file: File) => {
      try {
        const familyName = await registerCustomFontFromFile(file);
        setCustomFonts([...customFontNames]);
        onChange(familyName);
      } catch {
        // Font load failed — ignore
      }
    },
    [onChange],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void importFontFile(file);
      e.target.value = '';
    },
    [importFontFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && /\.(ttf|otf|woff2?)$/i.test(file.name)) {
        void importFontFile(file);
      }
    },
    [importFontFile],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, font: string) => {
      if (!customFonts.includes(font)) return;
      e.preventDefault();
      removeCustomFont(font);
      setCustomFonts([...customFontNames]);
    },
    [customFonts],
  );

  const isCustom = (font: string): boolean => customFonts.includes(font);

  return (
    <div
      className={`font-selector ${dragOver ? 'font-selector--drag-over' : ''}`}
      ref={containerRef}
      style={{ position: 'relative' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          className="text-property-select font-selector__trigger"
          onClick={handleOpen}
          style={{ fontFamily: value, cursor: 'pointer', textAlign: 'left', flex: 1 }}
          type="button"
        >
          {value}
        </button>
        <button
          className="font-selector__import-btn"
          onClick={() => fileInputRef.current?.click()}
          title={t('font.importCustom')}
          type="button"
        >
          +
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={FONT_FILE_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {isOpen && (
        <div
          className="font-selector__dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-secondary, #2d2d2d)',
            border: '1px solid var(--border-color, #555)',
            borderRadius: 4,
            maxHeight: 300,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <input
            ref={inputRef}
            className="font-selector__search"
            type="text"
            placeholder="Search fonts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlightIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '4px 6px',
              border: 'none',
              borderBottom: '1px solid var(--border-color, #555)',
              background: 'var(--bg-primary, #1e1e1e)',
              color: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div
            ref={listRef}
            className="font-selector__list"
            style={{ overflowY: 'auto', flex: 1 }}
          >
            {filtered.map((font, idx) => (
              <div
                key={font}
                className={`font-selector__item ${idx === highlightIndex ? 'font-selector__item--highlight' : ''}`}
                onClick={() => handleSelect(font)}
                onMouseEnter={() => setHighlightIndex(idx)}
                onContextMenu={(e) => handleContextMenu(e, font)}
                style={{
                  padding: '3px 6px',
                  cursor: 'pointer',
                  fontFamily: font,
                  fontSize: 13,
                  background: idx === highlightIndex ? 'var(--accent-color, #0078d4)' : 'transparent',
                  color: idx === highlightIndex ? '#fff' : 'inherit',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isCustom(font) && (
                  <span className="font-selector__custom-badge" title={t('font.customBadge')}>
                    {'★ '}
                  </span>
                )}
                {font}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '8px', opacity: 0.6, textAlign: 'center' }}>
                No fonts found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
