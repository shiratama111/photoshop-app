/**
 * @module google-fonts
 * Google Fonts API client, font download/cache, and IPC handlers for the main process.
 *
 * Responsibilities:
 * - Fetch font metadata from the Google Fonts API
 * - Cache metadata locally as JSON in the userData directory
 * - Download .woff2 font files to `userData/fonts/`
 * - Expose IPC channels: `font:searchGoogleFonts`, `font:downloadGoogleFont`,
 *   `font:getDownloadedGoogleFonts`, `font:loadGoogleFontFile`
 *
 * Graceful degradation: If `GOOGLE_FONTS_API_KEY` is not set, the module
 * operates in offline-only mode using the local metadata cache.
 *
 * @see https://developers.google.com/fonts/docs/developer_api
 * @see FONT-001: Google Fonts integration ticket
 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { bufferToArrayBuffer } from './buffer-utils';

// ── Types ────────────────────────────────────────────────────────────────

/** A single font entry from the Google Fonts API response. */
export interface GoogleFontItem {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
  files: Record<string, string>;
  lastModified: string;
  kind: string;
}

/** Supported Google Fonts category values. */
export type GoogleFontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace';

/** Sort order for font search results. */
export type GoogleFontSortOrder = 'popularity' | 'date';

/** Parameters for searching Google Fonts. */
export interface GoogleFontSearchParams {
  query: string;
  category: GoogleFontCategory | 'all';
  sort: GoogleFontSortOrder;
  offset: number;
  limit: number;
}

/** A simplified font entry returned to the renderer process. */
export interface GoogleFontEntry {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  lastModified: string;
  downloaded: boolean;
}

/** Result of a search operation. */
export interface GoogleFontSearchResult {
  fonts: GoogleFontEntry[];
  total: number;
  offset: number;
  limit: number;
}

/** Metadata for a downloaded Google Font stored on disk. */
interface DownloadedFontMeta {
  family: string;
  category: string;
  variant: string;
  downloadedAt: string;
  fileName: string;
}

/** Shape of the raw API response. */
interface GoogleFontsApiResponse {
  kind: string;
  items: GoogleFontItem[];
}

// ── Paths ────────────────────────────────────────────────────────────────

/** Directory for cached font metadata and downloaded font files. */
function getFontsDir(): string {
  return path.join(app.getPath('userData'), 'fonts');
}

/** Path to the cached metadata JSON file. */
function getMetadataCachePath(): string {
  return path.join(app.getPath('userData'), 'google-fonts-cache.json');
}

/** Path to the downloaded fonts manifest. */
function getDownloadedManifestPath(): string {
  return path.join(getFontsDir(), 'downloaded-manifest.json');
}

// ── Cache state ──────────────────────────────────────────────────────────

/** In-memory cache of font metadata. */
let fontMetadataCache: GoogleFontItem[] | null = null;

/** In-memory cache of downloaded fonts manifest. */
let downloadedManifest: Map<string, DownloadedFontMeta> = new Map();

/** Whether we have already attempted to fetch from the API this session. */
let apiFetchAttempted = false;

// ── Utilities ────────────────────────────────────────────────────────────

/**
 * Make an HTTPS GET request and return the response body as a string.
 * @param url - The URL to fetch.
 * @returns The response body.
 */
function httpsGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const makeRequest = (targetUrl: string, redirectCount: number): void => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      https.get(targetUrl, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location, redirectCount + 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode ?? 'unknown'}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    makeRequest(url, 0);
  });
}

/**
 * Ensure the fonts directory exists.
 */
function ensureFontsDir(): void {
  const dir = getFontsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Type guard for GoogleFontItem.
 * @param value - The value to check.
 * @returns True if value is a valid GoogleFontItem.
 */
function isGoogleFontItem(value: unknown): value is GoogleFontItem {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.family === 'string' &&
    Array.isArray(obj.variants) &&
    Array.isArray(obj.subsets) &&
    typeof obj.category === 'string' &&
    typeof obj.files === 'object' &&
    obj.files !== null
  );
}

/**
 * Type guard for the API response shape.
 * @param value - The value to check.
 * @returns True if value is a valid API response.
 */
function isGoogleFontsApiResponse(value: unknown): value is GoogleFontsApiResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.kind === 'string' && Array.isArray(obj.items);
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

// ── Metadata cache ───────────────────────────────────────────────────────

/**
 * Load font metadata from the local cache file.
 * @returns The cached font items, or null if no cache exists.
 */
export function loadMetadataCache(): GoogleFontItem[] | null {
  try {
    const cachePath = getMetadataCachePath();
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.filter(isGoogleFontItem);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

/**
 * Save font metadata to the local cache file.
 * @param items - The font items to cache.
 */
export function saveMetadataCache(items: GoogleFontItem[]): void {
  try {
    const cachePath = getMetadataCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(items), 'utf-8');
  } catch {
    // Write failed — non-critical
  }
}

/**
 * Fetch font metadata from the Google Fonts API.
 * @returns The font items from the API.
 * @throws If the API request fails or returns invalid data.
 */
export async function fetchFontMetadataFromApi(): Promise<GoogleFontItem[]> {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_FONTS_API_KEY environment variable is not set');
  }

  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
  const buffer = await httpsGet(url);
  const parsed: unknown = JSON.parse(buffer.toString('utf-8'));

  if (!isGoogleFontsApiResponse(parsed)) {
    throw new Error('Invalid response from Google Fonts API');
  }

  const items = parsed.items.filter(isGoogleFontItem);
  return items;
}

/**
 * Get font metadata, using the API if available, falling back to local cache.
 * @returns The font metadata items.
 */
export async function getFontMetadata(): Promise<GoogleFontItem[]> {
  // Return in-memory cache if available
  if (fontMetadataCache) return fontMetadataCache;

  // Try API fetch (once per session)
  if (!apiFetchAttempted && process.env.GOOGLE_FONTS_API_KEY) {
    apiFetchAttempted = true;
    try {
      const items = await fetchFontMetadataFromApi();
      fontMetadataCache = items;
      saveMetadataCache(items);
      return items;
    } catch {
      // API failed — fall through to local cache
    }
  }

  // Load from local cache
  const cached = loadMetadataCache();
  if (cached) {
    fontMetadataCache = cached;
    return cached;
  }

  // No cache available
  return [];
}

// ── Downloaded fonts manifest ────────────────────────────────────────────

/**
 * Load the downloaded fonts manifest from disk.
 */
export function loadDownloadedManifest(): void {
  try {
    const manifestPath = getDownloadedManifestPath();
    if (!fs.existsSync(manifestPath)) return;
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    downloadedManifest = new Map();
    for (const entry of parsed) {
      if (isDownloadedFontMeta(entry)) {
        downloadedManifest.set(entry.family, entry);
      }
    }
  } catch {
    downloadedManifest = new Map();
  }
}

/**
 * Save the downloaded fonts manifest to disk.
 */
function saveDownloadedManifest(): void {
  try {
    ensureFontsDir();
    const manifestPath = getDownloadedManifestPath();
    const entries = Array.from(downloadedManifest.values());
    fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    // Write failed — non-critical
  }
}

/**
 * Check whether a font family has been downloaded.
 * @param family - The font family name.
 * @returns True if the font is downloaded and its file exists on disk.
 */
export function isFontDownloaded(family: string): boolean {
  const meta = downloadedManifest.get(family);
  if (!meta) return false;
  const filePath = path.join(getFontsDir(), meta.fileName);
  return fs.existsSync(filePath);
}

/**
 * Get a list of all downloaded Google Font families.
 * @returns Array of downloaded font metadata entries.
 */
export function getDownloadedFonts(): DownloadedFontMeta[] {
  return Array.from(downloadedManifest.values()).filter((meta) => {
    const filePath = path.join(getFontsDir(), meta.fileName);
    return fs.existsSync(filePath);
  });
}

// ── Search ───────────────────────────────────────────────────────────────

/**
 * Search Google Fonts with filtering and pagination.
 * @param params - Search parameters.
 * @returns Paginated search results.
 */
export async function searchGoogleFonts(params: GoogleFontSearchParams): Promise<GoogleFontSearchResult> {
  const metadata = await getFontMetadata();
  let filtered = metadata;

  // Filter by category
  if (params.category !== 'all') {
    filtered = filtered.filter((f) => f.category === params.category);
  }

  // Filter by search query
  if (params.query.trim().length > 0) {
    const q = params.query.toLowerCase().trim();
    filtered = filtered.filter((f) => f.family.toLowerCase().includes(q));
  }

  // Sort (metadata from API is already sorted by popularity)
  if (params.sort === 'date') {
    filtered = [...filtered].sort((a, b) =>
      b.lastModified.localeCompare(a.lastModified),
    );
  }

  const total = filtered.length;
  const page = filtered.slice(params.offset, params.offset + params.limit);

  const fonts: GoogleFontEntry[] = page.map((f) => ({
    family: f.family,
    category: f.category,
    variants: f.variants,
    subsets: f.subsets,
    lastModified: f.lastModified,
    downloaded: isFontDownloaded(f.family),
  }));

  return { fonts, total, offset: params.offset, limit: params.limit };
}

// ── Download ─────────────────────────────────────────────────────────────

/**
 * Sanitize a font family name for use as a filename.
 * @param family - The font family name.
 * @returns A sanitized filename string.
 */
export function sanitizeFontFileName(family: string): string {
  return family.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Download a Google Font .woff2 file and save it locally.
 * @param family - The font family name to download.
 * @param variant - The variant to download (default: 'regular').
 * @returns The path to the downloaded font file, or null on failure.
 */
export async function downloadGoogleFont(
  family: string,
  variant: string = 'regular',
): Promise<{ filePath: string; data: ArrayBuffer } | null> {
  // Check if already downloaded
  if (isFontDownloaded(family)) {
    const meta = downloadedManifest.get(family);
    if (meta) {
      const filePath = path.join(getFontsDir(), meta.fileName);
      try {
        const buffer = fs.readFileSync(filePath);
        return { filePath, data: bufferToArrayBuffer(buffer) };
      } catch {
        // File read failed — re-download
      }
    }
  }

  const metadata = await getFontMetadata();
  const fontItem = metadata.find((f) => f.family === family);
  if (!fontItem) return null;

  // Find the URL for the requested variant
  let fileUrl: string | undefined = fontItem.files[variant];
  if (!fileUrl) {
    // Fall back to 'regular' or the first available variant
    fileUrl = fontItem.files.regular ?? Object.values(fontItem.files)[0];
  }
  if (!fileUrl) return null;

  // Convert http URLs to https
  fileUrl = fileUrl.replace(/^http:/, 'https:');

  try {
    ensureFontsDir();
    const buffer = await httpsGet(fileUrl);
    const fileName = `${sanitizeFontFileName(family)}.woff2`;
    const filePath = path.join(getFontsDir(), fileName);
    fs.writeFileSync(filePath, buffer);

    // Update manifest
    const meta: DownloadedFontMeta = {
      family,
      category: fontItem.category,
      variant,
      downloadedAt: new Date().toISOString(),
      fileName,
    };
    downloadedManifest.set(family, meta);
    saveDownloadedManifest();

    return { filePath, data: bufferToArrayBuffer(buffer) };
  } catch {
    return null;
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────

/**
 * Register all Google Fonts IPC handlers.
 * Call this once during app initialization (in main/index.ts).
 */
export function registerGoogleFontsHandlers(): void {
  // Load downloaded manifest on startup
  loadDownloadedManifest();

  ipcMain.handle(
    'font:searchGoogleFonts',
    async (
      _event,
      query: string,
      category: string,
      sort: string,
      offset: number,
      limit: number,
    ) => {
      const params: GoogleFontSearchParams = {
        query: typeof query === 'string' ? query : '',
        category: isValidCategory(category) ? category : 'all',
        sort: sort === 'date' ? 'date' : 'popularity',
        offset: typeof offset === 'number' ? offset : 0,
        limit: typeof limit === 'number' ? limit : 50,
      };
      return searchGoogleFonts(params);
    },
  );

  ipcMain.handle(
    'font:downloadGoogleFont',
    async (_event, family: string, variant?: string) => {
      if (typeof family !== 'string') return null;
      return downloadGoogleFont(family, typeof variant === 'string' ? variant : 'regular');
    },
  );

  ipcMain.handle('font:getDownloadedGoogleFonts', () => {
    return getDownloadedFonts();
  });

  ipcMain.handle('font:loadGoogleFontFile', (_event, family: string) => {
    if (typeof family !== 'string') return null;
    const meta = downloadedManifest.get(family);
    if (!meta) return null;
    const filePath = path.join(getFontsDir(), meta.fileName);
    try {
      const buffer = fs.readFileSync(filePath);
      return { family: meta.family, data: bufferToArrayBuffer(buffer) };
    } catch {
      return null;
    }
  });
}

/**
 * Check if a string is a valid Google Fonts category.
 * @param value - The string to validate.
 * @returns True if the value is a valid category or 'all'.
 */
function isValidCategory(value: string): value is GoogleFontCategory | 'all' {
  return ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'].includes(value);
}
