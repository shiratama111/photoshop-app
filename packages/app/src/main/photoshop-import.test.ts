/**
 * @module photoshop-import.test
 * Unit tests for the Photoshop preset auto-import module.
 *
 * Tests cover:
 * - Manifest load/save/reset and duplicate detection
 * - Font family name derivation from file names
 * - Directory scanning with manifest-based skip logic
 * - IPC handler registration
 *
 * @see PRESET-001: Photoshop preset auto-import
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/userData') },
  ipcMain: { handle: vi.fn() },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('./buffer-utils', () => ({
  bufferToArrayBuffer: vi.fn((buf: Buffer) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
}));

import {
  loadManifest,
  saveManifest,
  resetManifest,
  isAlreadyImported,
  deriveFontFamily,
  buildScanDirs,
  scanForFiles,
  runImportScan,
  registerPhotoshopImportHandlers,
} from './photoshop-import';
import * as fs from 'fs';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockStatSync = vi.mocked(fs.statSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockUnlinkSync = vi.mocked(fs.unlinkSync);

// ── Helpers ──────────────────────────────────────────────────────────────

function makeStat(mtime: string, size: number, isFile = true): fs.Stats {
  return {
    mtime: new Date(mtime),
    size,
    isFile: () => isFile,
    isDirectory: () => !isFile,
  } as unknown as fs.Stats;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('loadManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetManifest();
  });

  it('starts with an empty manifest when file does not exist', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    loadManifest();
    // Verify no entries are loaded — isAlreadyImported should return false
    const stat = makeStat('2025-06-01T00:00:00.000Z', 1024);
    expect(isAlreadyImported('/some/file.asl', stat)).toBe(false);
  });

  it('loads a valid manifest from disk', () => {
    const manifestData = {
      version: 1,
      entries: {
        '/path/to/style.asl': {
          filePath: '/path/to/style.asl',
          mtime: '2025-06-01T00:00:00.000Z',
          size: 1024,
          type: 'asl',
          importedAt: '2025-06-15T10:00:00.000Z',
        },
      },
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifestData));
    loadManifest();

    const stat = makeStat('2025-06-01T00:00:00.000Z', 1024);
    expect(isAlreadyImported('/path/to/style.asl', stat)).toBe(true);
  });

  it('handles corrupt JSON gracefully', () => {
    mockReadFileSync.mockReturnValue('not valid json!!!');
    expect(() => loadManifest()).not.toThrow();
  });

  it('handles invalid manifest structure gracefully', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: 99, data: [] }));
    expect(() => loadManifest()).not.toThrow();
  });
});

describe('saveManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetManifest();
  });

  it('writes manifest JSON to disk', () => {
    saveManifest();
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [filePath, content] = mockWriteFileSync.mock.calls[0];
    expect(filePath).toContain('photoshop-import-manifest.json');
    const parsed = JSON.parse(content as string);
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toEqual({});
  });

  it('does not throw on write error', () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('ENOSPC'); });
    expect(() => saveManifest()).not.toThrow();
  });
});

describe('resetManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears in-memory entries', () => {
    // Load some data first
    const manifestData = {
      version: 1,
      entries: {
        '/path/to/style.asl': {
          filePath: '/path/to/style.asl',
          mtime: '2025-06-01T00:00:00.000Z',
          size: 1024,
          type: 'asl',
          importedAt: '2025-06-15T10:00:00.000Z',
        },
      },
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifestData));
    loadManifest();

    // Reset
    mockExistsSync.mockReturnValue(true);
    resetManifest();

    const stat = makeStat('2025-06-01T00:00:00.000Z', 1024);
    expect(isAlreadyImported('/path/to/style.asl', stat)).toBe(false);
  });

  it('deletes the manifest file if it exists', () => {
    mockExistsSync.mockReturnValue(true);
    resetManifest();
    expect(mockUnlinkSync).toHaveBeenCalled();
  });

  it('does not throw when manifest file is missing', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => resetManifest()).not.toThrow();
  });
});

describe('isAlreadyImported', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetManifest();
  });

  it('returns false for unknown files', () => {
    const stat = makeStat('2025-06-01T00:00:00.000Z', 1024);
    expect(isAlreadyImported('/unknown/file.asl', stat)).toBe(false);
  });

  it('returns false when mtime differs', () => {
    const manifestData = {
      version: 1,
      entries: {
        '/path/style.asl': {
          filePath: '/path/style.asl',
          mtime: '2025-06-01T00:00:00.000Z',
          size: 1024,
          type: 'asl',
          importedAt: '2025-06-15T10:00:00.000Z',
        },
      },
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifestData));
    loadManifest();

    const stat = makeStat('2025-07-01T00:00:00.000Z', 1024);
    expect(isAlreadyImported('/path/style.asl', stat)).toBe(false);
  });

  it('returns false when size differs', () => {
    const manifestData = {
      version: 1,
      entries: {
        '/path/style.asl': {
          filePath: '/path/style.asl',
          mtime: '2025-06-01T00:00:00.000Z',
          size: 1024,
          type: 'asl',
          importedAt: '2025-06-15T10:00:00.000Z',
        },
      },
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(manifestData));
    loadManifest();

    const stat = makeStat('2025-06-01T00:00:00.000Z', 2048);
    expect(isAlreadyImported('/path/style.asl', stat)).toBe(false);
  });
});

describe('deriveFontFamily', () => {
  it('strips Bold suffix', () => {
    expect(deriveFontFamily('HomuraM-Bold.otf')).toBe('HomuraM');
  });

  it('strips Regular suffix', () => {
    expect(deriveFontFamily('NotoSansJP-Regular.ttf')).toBe('NotoSansJP');
  });

  it('strips compound BoldItalic suffixes', () => {
    expect(deriveFontFamily('Meiryo-BoldItalic.ttf')).toBe('Meiryo');
  });

  it('strips Light suffix', () => {
    expect(deriveFontFamily('SourceHanSans-Light.otf')).toBe('SourceHanSans');
  });

  it('strips ExtraBold suffix', () => {
    expect(deriveFontFamily('Montserrat-ExtraBold.woff2')).toBe('Montserrat');
  });

  it('preserves name when no suffix to strip', () => {
    expect(deriveFontFamily('CustomFont.otf')).toBe('CustomFont');
  });

  it('handles name with underscores', () => {
    expect(deriveFontFamily('My_Font_Bold.ttf')).toBe('My_Font');
  });

  it('returns base name for extension-only input', () => {
    // Edge case: just an extension
    expect(deriveFontFamily('.otf')).toBe('');
  });
});

describe('buildScanDirs', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // All dirs are mock-validated as existing
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as unknown as fs.Stats);
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns ASL directories for years 2024-2026', () => {
    process.env.APPDATA = 'C:/Users/test/AppData/Roaming';
    const dirs = buildScanDirs('asl');
    expect(dirs.length).toBe(3);
    expect(dirs[0]).toContain('2024');
    expect(dirs[1]).toContain('2025');
    expect(dirs[2]).toContain('2026');
  });

  it('returns ABR directories including Required subdirs', () => {
    process.env.ProgramFiles = 'C:/Program Files';
    const dirs = buildScanDirs('abr');
    // 3 years × 2 paths (Brushes + Required) = 6
    expect(dirs.length).toBe(6);
    expect(dirs.some((d) => d.includes('Required'))).toBe(true);
  });

  it('returns font directory', () => {
    process.env.LOCALAPPDATA = 'C:/Users/test/AppData/Local';
    const dirs = buildScanDirs('font');
    expect(dirs.length).toBe(1);
    // path.join uses OS-native separators, so check with both
    expect(dirs[0]).toMatch(/Microsoft[/\\]Windows[/\\]Fonts/);
  });

  it('filters out non-existent directories', () => {
    process.env.APPDATA = 'C:/Users/test/AppData/Roaming';
    mockExistsSync.mockReturnValue(false);
    const dirs = buildScanDirs('asl');
    expect(dirs.length).toBe(0);
  });
});

describe('scanForFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetManifest();
  });

  it('returns empty when no scan directories exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = scanForFiles('asl');
    expect(result.files).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
  });

  it('reads ASL files from matching directories', () => {
    const origEnv = process.env.APPDATA;
    process.env.APPDATA = 'C:/Users/test/AppData/Roaming';

    mockExistsSync.mockReturnValue(true);
    // statSync needs to return isDirectory for dir checks and isFile for file checks
    mockStatSync.mockImplementation((p) => {
      const s = String(p).replace(/\\/g, '/');
      if (s.includes('Presets/Styles') && !s.includes('.asl')) {
        return { isDirectory: () => true } as unknown as fs.Stats;
      }
      return makeStat('2025-06-01T00:00:00.000Z', 1024, true);
    });

    mockReaddirSync.mockReturnValue(['style1.asl', 'readme.txt'] as unknown as fs.Dirent[]);
    mockReadFileSync.mockReturnValue(Buffer.from('mock-asl-data'));

    const result = scanForFiles('asl');
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    expect(result.files[0].type).toBe('asl');

    process.env.APPDATA = origEnv;
  });

  it('records errors for unreadable files and continues', () => {
    const origEnv = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = 'C:/Users/test/AppData/Local';

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockImplementation((p) => {
      const s = String(p).replace(/\\/g, '/');
      if (s.includes('Microsoft/Windows/Fonts') && !s.match(/\.(otf|ttf|woff2)$/)) {
        return { isDirectory: () => true } as unknown as fs.Stats;
      }
      return makeStat('2025-06-01T00:00:00.000Z', 1024, true);
    });

    mockReaddirSync.mockReturnValue(['good.otf', 'bad.ttf'] as unknown as fs.Dirent[]);
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).includes('bad.ttf')) throw new Error('Permission denied');
      return Buffer.from('mock-font-data');
    });

    const result = scanForFiles('font');
    expect(result.files.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('bad.ttf');

    process.env.LOCALAPPDATA = origEnv;
  });
});

describe('runImportScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make loadManifest start fresh
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    // No directories exist by default
    mockExistsSync.mockReturnValue(false);
  });

  it('returns empty result when no directories exist', () => {
    const result = runImportScan();
    expect(result.imported).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('does not save manifest when nothing was imported', () => {
    runImportScan();
    // writeFileSync should not be called (no imports)
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

describe('registerPhotoshopImportHandlers', () => {
  it('registers two IPC handlers', async () => {
    const { ipcMain } = await import('electron');
    const mockHandle = vi.mocked(ipcMain.handle);
    const callsBefore = mockHandle.mock.calls.length;

    registerPhotoshopImportHandlers();

    const callsAfter = mockHandle.mock.calls.length;
    expect(callsAfter - callsBefore).toBe(2);

    const channels = mockHandle.mock.calls.slice(callsBefore).map((c) => c[0]);
    expect(channels).toContain('psimport:scan');
    expect(channels).toContain('psimport:resetManifest');
  });
});
