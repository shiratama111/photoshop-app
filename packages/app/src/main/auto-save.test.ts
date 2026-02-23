/**
 * @module auto-save.test
 * Unit tests for auto-save and crash recovery helpers.
 * @see APP-008
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/userData') },
  ipcMain: { handle: vi.fn() },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import {
  writeAutoSave,
  clearAutoSave,
  clearAllAutoSaves,
  listRecoveryFiles,
  readAutoSave,
} from './auto-save';
import * as fs from 'fs';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockUnlinkSync = vi.mocked(fs.unlinkSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);

describe('writeAutoSave', () => {
  beforeEach(() => { vi.clearAllMocks(); mockUnlinkSync.mockReset(); mockWriteFileSync.mockReset(); mockReadFileSync.mockReset(); mockExistsSync.mockReset(); mockMkdirSync.mockReset(); mockReaddirSync.mockReset(); });

  it('creates the autosave directory if it does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    writeAutoSave('doc-1', 'Test', null, Buffer.from('data'));
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('autosave'),
      { recursive: true },
    );
  });

  it('writes both data and meta files', () => {
    mockExistsSync.mockReturnValue(true);
    writeAutoSave('doc-1', 'Test Doc', '/path/to/file.psd', Buffer.from('psd-data'));
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);

    // Data file
    const [dataPath, dataContent] = mockWriteFileSync.mock.calls[0];
    expect(dataPath).toContain('doc-1.autosave');
    expect(Buffer.isBuffer(dataContent)).toBe(true);

    // Meta file
    const [metaPath, metaContent] = mockWriteFileSync.mock.calls[1];
    expect(metaPath).toContain('doc-1.meta.json');
    const meta = JSON.parse(metaContent as string);
    expect(meta.documentId).toBe('doc-1');
    expect(meta.documentName).toBe('Test Doc');
    expect(meta.filePath).toBe('/path/to/file.psd');
    expect(meta.savedAt).toBeTruthy();
  });

  it('does not throw on write error', () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFileSync.mockImplementation(() => { throw new Error('ENOSPC'); });
    expect(() => writeAutoSave('doc-1', 'Test', null, Buffer.from('data'))).not.toThrow();
  });
});

describe('clearAutoSave', () => {
  beforeEach(() => { vi.clearAllMocks(); mockUnlinkSync.mockReset(); mockWriteFileSync.mockReset(); mockReadFileSync.mockReset(); mockExistsSync.mockReset(); mockMkdirSync.mockReset(); mockReaddirSync.mockReset(); });

  it('removes both data and meta files', () => {
    mockExistsSync.mockReturnValue(true);
    clearAutoSave('doc-1');
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
    expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringContaining('doc-1.autosave'));
    expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringContaining('doc-1.meta.json'));
  });

  it('does not throw if files do not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => clearAutoSave('doc-1')).not.toThrow();
  });

  it('does not throw on unlink error', () => {
    mockExistsSync.mockReturnValue(true);
    mockUnlinkSync.mockImplementation(() => { throw new Error('EPERM'); });
    expect(() => clearAutoSave('doc-1')).not.toThrow();
  });
});

describe('clearAllAutoSaves', () => {
  beforeEach(() => { vi.clearAllMocks(); mockUnlinkSync.mockReset(); mockWriteFileSync.mockReset(); mockReadFileSync.mockReset(); mockExistsSync.mockReset(); mockMkdirSync.mockReset(); mockReaddirSync.mockReset(); });

  it('removes all files in the autosave directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => ['a.autosave', 'a.meta.json', 'b.autosave', 'b.meta.json'] as never);
    clearAllAutoSaves();
    expect(mockUnlinkSync).toHaveBeenCalledTimes(4);
  });

  it('does nothing if directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    clearAllAutoSaves();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});

describe('listRecoveryFiles', () => {
  beforeEach(() => { vi.clearAllMocks(); mockUnlinkSync.mockReset(); mockWriteFileSync.mockReset(); mockReadFileSync.mockReset(); mockExistsSync.mockReset(); mockMkdirSync.mockReset(); mockReaddirSync.mockReset(); });

  it('returns empty array when no directory', () => {
    mockExistsSync.mockReturnValue(false);
    expect(listRecoveryFiles()).toEqual([]);
  });

  it('returns entries for valid meta files with matching data files', () => {
    // existsSync: first call for dir, subsequent calls for data files
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('autosave')) return true;
      return true;
    });
    mockReaddirSync.mockReturnValue(['doc-1.meta.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    const meta = {
      documentId: 'doc-1',
      documentName: 'Test',
      filePath: null,
      savedAt: '2026-01-01T00:00:00Z',
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(meta));

    const result = listRecoveryFiles();
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('doc-1');
  });

  it('skips malformed meta files', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['bad.meta.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    mockReadFileSync.mockReturnValue('not json');

    expect(listRecoveryFiles()).toEqual([]);
  });

  it('skips meta files without matching data files', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('.autosave')) return false;
      return true;
    });
    mockReaddirSync.mockReturnValue(['orphan.meta.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    const meta = {
      documentId: 'orphan',
      documentName: 'Orphan',
      filePath: null,
      savedAt: '2026-01-01T00:00:00Z',
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(meta));

    expect(listRecoveryFiles()).toEqual([]);
  });
});

describe('readAutoSave', () => {
  beforeEach(() => { vi.clearAllMocks(); mockUnlinkSync.mockReset(); mockWriteFileSync.mockReset(); mockReadFileSync.mockReset(); mockExistsSync.mockReset(); mockMkdirSync.mockReset(); mockReaddirSync.mockReset(); });

  it('returns buffer when file exists', () => {
    mockExistsSync.mockReturnValue(true);
    const buf = Buffer.from('psd-data');
    mockReadFileSync.mockReturnValue(buf);
    const result = readAutoSave('doc-1');
    expect(result).toEqual(buf);
  });

  it('returns null when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(readAutoSave('doc-1')).toBeNull();
  });

  it('returns null on read error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    expect(readAutoSave('doc-1')).toBeNull();
  });
});
