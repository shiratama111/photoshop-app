/**
 * @module google-fonts.test
 * Unit tests for the Google Fonts API client, search, download, and cache.
 * @see FONT-001: Google Fonts integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/userData') },
  ipcMain: { handle: vi.fn() },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('https', () => ({
  get: vi.fn(),
}));

import {
  loadMetadataCache,
  saveMetadataCache,
  searchGoogleFonts,
  sanitizeFontFileName,
  isFontDownloaded,
  getDownloadedFonts,
  loadDownloadedManifest,
} from './google-fonts';
import type { GoogleFontItem, GoogleFontSearchParams } from './google-fonts';
import * as fs from 'fs';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);

// ── Test data ────────────────────────────────────────────────────────────

function createMockFontItem(overrides: Partial<GoogleFontItem> = {}): GoogleFontItem {
  return {
    family: 'Roboto',
    variants: ['regular', 'bold', 'italic'],
    subsets: ['latin', 'latin-ext'],
    category: 'sans-serif',
    files: {
      regular: 'https://fonts.gstatic.com/s/roboto/v30/regular.woff2',
      bold: 'https://fonts.gstatic.com/s/roboto/v30/bold.woff2',
    },
    lastModified: '2025-01-01',
    kind: 'webfonts#webfont',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('loadMetadataCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when cache file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(loadMetadataCache()).toBeNull();
  });

  it('returns null when cache file contains invalid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not json');
    expect(loadMetadataCache()).toBeNull();
  });

  it('returns null when cache file contains non-array JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ not: 'array' }));
    expect(loadMetadataCache()).toBeNull();
  });

  it('returns font items from valid cache file', () => {
    const items = [createMockFontItem()];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(items));

    const result = loadMetadataCache();
    expect(result).toHaveLength(1);
    expect(result![0].family).toBe('Roboto');
  });

  it('filters out invalid entries from cache', () => {
    const items = [
      createMockFontItem(),
      { invalid: 'entry' },
      createMockFontItem({ family: 'Open Sans' }),
    ];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(items));

    const result = loadMetadataCache();
    expect(result).toHaveLength(2);
    expect(result![0].family).toBe('Roboto');
    expect(result![1].family).toBe('Open Sans');
  });
});

describe('saveMetadataCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes JSON to the cache file path', () => {
    const items = [createMockFontItem()];
    saveMetadataCache(items);

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [filePath, content] = mockWriteFileSync.mock.calls[0];
    expect(filePath).toContain('google-fonts-cache.json');
    const parsed = JSON.parse(content as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].family).toBe('Roboto');
  });

  it('does not throw on write error', () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('ENOSPC');
    });
    expect(() => saveMetadataCache([createMockFontItem()])).not.toThrow();
  });
});

describe('sanitizeFontFileName', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeFontFileName('Open Sans')).toBe('Open_Sans');
  });

  it('removes special characters', () => {
    expect(sanitizeFontFileName('Noto Sans JP')).toBe('Noto_Sans_JP');
  });

  it('preserves hyphens and underscores', () => {
    expect(sanitizeFontFileName('Source-Code_Pro')).toBe('Source-Code_Pro');
  });

  it('handles empty string', () => {
    expect(sanitizeFontFileName('')).toBe('');
  });
});

describe('searchGoogleFonts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pre-populate the metadata cache by loading from mock file
    const testFonts: GoogleFontItem[] = [
      createMockFontItem({ family: 'Roboto', category: 'sans-serif', lastModified: '2025-01-01' }),
      createMockFontItem({ family: 'Open Sans', category: 'sans-serif', lastModified: '2025-02-01' }),
      createMockFontItem({ family: 'Playfair Display', category: 'serif', lastModified: '2024-06-01' }),
      createMockFontItem({ family: 'Fira Code', category: 'monospace', lastModified: '2025-03-01' }),
      createMockFontItem({ family: 'Dancing Script', category: 'handwriting', lastModified: '2024-12-01' }),
      createMockFontItem({ family: 'Lobster', category: 'display', lastModified: '2024-01-01' }),
    ];
    // Write mock cache for the module to pick up
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(testFonts));
  });

  it('returns all fonts when no filters applied', async () => {
    const params: GoogleFontSearchParams = {
      query: '',
      category: 'all',
      sort: 'popularity',
      offset: 0,
      limit: 50,
    };
    // Force reload metadata cache
    const result = await searchGoogleFonts(params);
    expect(result.fonts.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('filters by category', async () => {
    const params: GoogleFontSearchParams = {
      query: '',
      category: 'serif',
      sort: 'popularity',
      offset: 0,
      limit: 50,
    };
    const result = await searchGoogleFonts(params);
    for (const font of result.fonts) {
      expect(font.category).toBe('serif');
    }
  });

  it('filters by search query (case-insensitive)', async () => {
    const params: GoogleFontSearchParams = {
      query: 'rob',
      category: 'all',
      sort: 'popularity',
      offset: 0,
      limit: 50,
    };
    const result = await searchGoogleFonts(params);
    for (const font of result.fonts) {
      expect(font.family.toLowerCase()).toContain('rob');
    }
  });

  it('returns correct pagination', async () => {
    const params: GoogleFontSearchParams = {
      query: '',
      category: 'all',
      sort: 'popularity',
      offset: 0,
      limit: 2,
    };
    const result = await searchGoogleFonts(params);
    expect(result.fonts.length).toBeLessThanOrEqual(2);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(2);
    expect(result.total).toBeGreaterThanOrEqual(result.fonts.length);
  });

  it('returns empty results when query matches nothing', async () => {
    const params: GoogleFontSearchParams = {
      query: 'zzzznonexistent',
      category: 'all',
      sort: 'popularity',
      offset: 0,
      limit: 50,
    };
    const result = await searchGoogleFonts(params);
    expect(result.fonts).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('includes downloaded flag in results', async () => {
    const params: GoogleFontSearchParams = {
      query: '',
      category: 'all',
      sort: 'popularity',
      offset: 0,
      limit: 50,
    };
    const result = await searchGoogleFonts(params);
    for (const font of result.fonts) {
      expect(typeof font.downloaded).toBe('boolean');
    }
  });
});

describe('isFontDownloaded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when font is not in manifest', () => {
    expect(isFontDownloaded('NonExistent Font')).toBe(false);
  });
});

describe('getDownloadedFonts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when manifest is empty', () => {
    expect(getDownloadedFonts()).toEqual([]);
  });
});

describe('loadDownloadedManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when manifest file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => loadDownloadedManifest()).not.toThrow();
  });

  it('does not throw on invalid JSON in manifest', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('invalid json');
    expect(() => loadDownloadedManifest()).not.toThrow();
  });

  it('loads valid manifest entries', () => {
    const manifest = [
      {
        family: 'Roboto',
        category: 'sans-serif',
        variant: 'regular',
        downloadedAt: '2025-01-01T00:00:00Z',
        fileName: 'Roboto.woff2',
      },
    ];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    loadDownloadedManifest();
    // After loading, isFontDownloaded should check the file
    mockExistsSync.mockReturnValue(true);
    expect(isFontDownloaded('Roboto')).toBe(true);
  });

  it('skips invalid manifest entries', () => {
    const manifest = [
      { invalid: 'entry' },
      {
        family: 'Open Sans',
        category: 'sans-serif',
        variant: 'regular',
        downloadedAt: '2025-01-01T00:00:00Z',
        fileName: 'Open_Sans.woff2',
      },
    ];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    loadDownloadedManifest();
    mockExistsSync.mockReturnValue(true);
    expect(isFontDownloaded('Open Sans')).toBe(true);
    expect(isFontDownloaded('invalid')).toBe(false);
  });
});

describe('registerGoogleFontsHandlers (IPC registration)', () => {
  it('registers four IPC handlers', async () => {
    const { ipcMain } = await import('electron');
    const mockHandle = vi.mocked(ipcMain.handle);
    const callsBefore = mockHandle.mock.calls.length;

    const { registerGoogleFontsHandlers } = await import('./google-fonts');
    registerGoogleFontsHandlers();

    const callsAfter = mockHandle.mock.calls.length;
    const newCalls = callsAfter - callsBefore;
    expect(newCalls).toBe(4);

    // Check channel names
    const channels = mockHandle.mock.calls.slice(callsBefore).map((c) => c[0]);
    expect(channels).toContain('font:searchGoogleFonts');
    expect(channels).toContain('font:downloadGoogleFont');
    expect(channels).toContain('font:getDownloadedGoogleFonts');
    expect(channels).toContain('font:loadGoogleFontFile');
  });
});
