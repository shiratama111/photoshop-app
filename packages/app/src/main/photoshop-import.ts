/**
 * @module photoshop-import
 * Auto-detect and import Photoshop presets (ASL, ABR) and user-installed fonts.
 *
 * Scans known Adobe Photoshop directories for preset files and the Windows
 * user-font directory for locally installed fonts. Uses a manifest file
 * (`userData/photoshop-import-manifest.json`) to track previously imported
 * files and skip duplicates on subsequent launches.
 *
 * IPC channels:
 * - `psimport:scan`           → Run a full import scan, returns {@link PhotoshopImportResult}
 * - `psimport:resetManifest`  → Clear the manifest to force re-import
 *
 * @see auto-save.ts (same pattern for IPC handler registration)
 * @see google-fonts.ts (same pattern for manifest management)
 * @see PRESET-001: Photoshop preset auto-import
 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { bufferToArrayBuffer } from './buffer-utils';

// ── Types ────────────────────────────────────────────────────────────────

/** Type of imported asset. */
export type ImportAssetType = 'asl' | 'abr' | 'font';

/** A single entry in the import manifest. */
export interface ManifestEntry {
  /** Absolute path to the file. */
  filePath: string;
  /** ISO 8601 mtime of the file at import time. */
  mtime: string;
  /** File size in bytes. */
  size: number;
  /** Asset type. */
  type: ImportAssetType;
  /** ISO 8601 timestamp of when the file was imported. */
  importedAt: string;
}

/** Persisted manifest structure. */
export interface ImportManifest {
  /** Schema version. */
  version: 1;
  /** Entries keyed by absolute file path. */
  entries: Record<string, ManifestEntry>;
}

/** A discovered file ready for import. */
export interface DiscoveredFile {
  /** Absolute path to the file. */
  filePath: string;
  /** Asset type. */
  type: ImportAssetType;
  /** File contents as ArrayBuffer (for ABR/ASL), or null for fonts. */
  data: ArrayBuffer | null;
  /** Derived font family name (fonts only). */
  fontFamily?: string;
}

/** Result returned from a scan operation. */
export interface PhotoshopImportResult {
  /** Files that were newly imported this scan. */
  imported: DiscoveredFile[];
  /** Number of files skipped because they were already in the manifest. */
  skippedCount: number;
  /** Errors encountered during scanning (non-fatal). */
  errors: string[];
}

// ── Paths ────────────────────────────────────────────────────────────────

/** Path to the import manifest JSON file. */
function getManifestPath(): string {
  return path.join(app.getPath('userData'), 'photoshop-import-manifest.json');
}

// ── Manifest management ──────────────────────────────────────────────────

/** In-memory manifest cache. */
let manifest: ImportManifest = { version: 1, entries: {} };

/**
 * Load the manifest from disk into memory.
 * Safe to call multiple times; silently handles missing/corrupt files.
 */
export function loadManifest(): void {
  try {
    const raw = fs.readFileSync(getManifestPath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (isValidManifest(parsed)) {
      manifest = parsed;
    }
  } catch {
    // File missing or corrupt — start fresh
    manifest = { version: 1, entries: {} };
  }
}

/** Save the current in-memory manifest to disk. */
export function saveManifest(): void {
  try {
    fs.writeFileSync(getManifestPath(), JSON.stringify(manifest, null, 2), 'utf-8');
  } catch {
    // Write failed — non-critical
  }
}

/** Reset the manifest (clears all entries and removes the file). */
export function resetManifest(): void {
  manifest = { version: 1, entries: {} };
  try {
    const p = getManifestPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // Ignore
  }
}

/** Type guard for the manifest structure. */
function isValidManifest(value: unknown): value is ImportManifest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.version === 1 && typeof obj.entries === 'object' && obj.entries !== null;
}

/**
 * Check whether a file is already in the manifest with the same mtime and size.
 * @returns true if the file should be skipped.
 */
export function isAlreadyImported(filePath: string, stat: fs.Stats): boolean {
  const entry = manifest.entries[filePath];
  if (!entry) return false;
  return entry.mtime === stat.mtime.toISOString() && entry.size === stat.size;
}

/** Record a successful import in the manifest. */
function recordImport(filePath: string, stat: fs.Stats, type: ImportAssetType): void {
  manifest.entries[filePath] = {
    filePath,
    mtime: stat.mtime.toISOString(),
    size: stat.size,
    type,
    importedAt: new Date().toISOString(),
  };
}

// ── Font family derivation ───────────────────────────────────────────────

/** Weight suffixes to strip from file names when deriving a font family name. */
const WEIGHT_SUFFIXES = [
  'ExtraBlack', 'UltraBlack',
  'ExtraBold', 'UltraBold', 'SemiBold', 'DemiBold',
  'ExtraLight', 'UltraLight',
  'Black', 'Heavy',
  'Bold', 'Medium', 'Regular', 'Normal',
  'Light', 'Thin',
  'Italic', 'Oblique',
];

/** Regex that matches trailing weight/style suffixes separated by `-` or at word boundary. */
const SUFFIX_REGEX = new RegExp(
  `[-_]?(${WEIGHT_SUFFIXES.join('|')})$`,
  'i',
);

/**
 * Derive a CSS font-family name from a font file name.
 * Strips extension and common weight/style suffixes.
 *
 * @example
 * deriveFontFamily('HomuraM-Bold.otf')  // 'HomuraM'
 * deriveFontFamily('NotoSansJP-Regular.ttf') // 'NotoSansJP'
 */
export function deriveFontFamily(fileName: string): string {
  // Remove extension
  let name = fileName.replace(/\.[^.]+$/, '');

  // Iteratively strip weight suffixes (some fonts have compound suffixes like BoldItalic)
  let prev = '';
  while (prev !== name) {
    prev = name;
    name = name.replace(SUFFIX_REGEX, '');
  }

  return name.trim() || fileName.replace(/\.[^.]+$/, '');
}

// ── Directory scanning ───────────────────────────────────────────────────

/**
 * Build the list of candidate directories to scan for a given asset type.
 * Returns only directories that actually exist on disk.
 */
export function buildScanDirs(type: ImportAssetType): string[] {
  const dirs: string[] = [];

  if (type === 'asl') {
    const appData = process.env.APPDATA;
    if (appData) {
      for (const year of [2024, 2025, 2026]) {
        dirs.push(path.join(appData, `Adobe/Adobe Photoshop ${year}/Presets/Styles`));
      }
    }
  } else if (type === 'abr') {
    const programFiles = process.env.ProgramFiles ?? process.env['ProgramFiles(x86)'];
    if (programFiles) {
      for (const year of [2024, 2025, 2026]) {
        dirs.push(path.join(programFiles, `Adobe/Adobe Photoshop ${year}/Presets/Brushes`));
        dirs.push(path.join(programFiles, `Adobe/Adobe Photoshop ${year}/Presets/Brushes/Required`));
      }
    }
  } else if (type === 'font') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      dirs.push(path.join(localAppData, 'Microsoft/Windows/Fonts'));
    }
  }

  return dirs.filter((d) => {
    try {
      return fs.existsSync(d) && fs.statSync(d).isDirectory();
    } catch {
      return false;
    }
  });
}

/** File extension filter per asset type. */
const EXT_MAP: Record<ImportAssetType, string[]> = {
  asl: ['.asl'],
  abr: ['.abr'],
  font: ['.otf', '.ttf', '.woff2'],
};

/**
 * Scan directories for files matching the given asset type.
 * Skips files already recorded in the manifest.
 *
 * @returns Discovered new/updated files and a count of skipped files.
 */
export function scanForFiles(
  type: ImportAssetType,
): { files: DiscoveredFile[]; skippedCount: number; errors: string[] } {
  const dirs = buildScanDirs(type);
  const exts = EXT_MAP[type];
  const files: DiscoveredFile[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (const dir of dirs) {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch (err) {
      errors.push(`Failed to read directory ${dir}: ${String(err)}`);
      continue;
    }

    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (!exts.includes(ext)) continue;

      const filePath = path.join(dir, entry);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        errors.push(`Failed to stat ${filePath}`);
        continue;
      }

      if (!stat.isFile()) continue;

      // Check manifest for duplicates
      if (isAlreadyImported(filePath, stat)) {
        skippedCount++;
        continue;
      }

      // Read file data (for ABR/ASL)
      if (type === 'asl' || type === 'abr') {
        try {
          const buffer = fs.readFileSync(filePath);
          files.push({
            filePath,
            type,
            data: bufferToArrayBuffer(buffer),
          });
          recordImport(filePath, stat, type);
        } catch (err) {
          errors.push(`Failed to read ${filePath}: ${String(err)}`);
        }
      } else {
        // Fonts: read data and derive family name
        try {
          const buffer = fs.readFileSync(filePath);
          const fontFamily = deriveFontFamily(entry);
          files.push({
            filePath,
            type,
            data: bufferToArrayBuffer(buffer),
            fontFamily,
          });
          recordImport(filePath, stat, type);
        } catch (err) {
          errors.push(`Failed to read font ${filePath}: ${String(err)}`);
        }
      }
    }
  }

  return { files, skippedCount, errors };
}

// ── Main scan orchestrator ───────────────────────────────────────────────

/**
 * Run a full import scan for all asset types.
 * Loads the manifest, scans all directories, saves the manifest, and returns results.
 */
export function runImportScan(): PhotoshopImportResult {
  loadManifest();

  const allImported: DiscoveredFile[] = [];
  const allErrors: string[] = [];
  let totalSkipped = 0;

  for (const type of ['asl', 'abr', 'font'] as ImportAssetType[]) {
    const { files, skippedCount, errors } = scanForFiles(type);
    allImported.push(...files);
    totalSkipped += skippedCount;
    allErrors.push(...errors);
  }

  // Persist manifest only if we imported something
  if (allImported.length > 0) {
    saveManifest();
  }

  return {
    imported: allImported,
    skippedCount: totalSkipped,
    errors: allErrors,
  };
}

// ── IPC Handlers ─────────────────────────────────────────────────────────

/**
 * Register IPC handlers for Photoshop preset import.
 * Call once during app initialization (in main/index.ts).
 */
export function registerPhotoshopImportHandlers(): void {
  ipcMain.handle('psimport:scan', () => {
    return runImportScan();
  });

  ipcMain.handle('psimport:resetManifest', () => {
    resetManifest();
    return true;
  });
}
