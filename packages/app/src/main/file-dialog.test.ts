/**
 * @module file-dialog.test
 * Unit tests for file-dialog recent-files helpers.
 * @see APP-004
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/userData') },
  dialog: {},
  ipcMain: { handle: vi.fn() },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { loadRecentFiles, saveRecentFiles, addRecentFile } from './file-dialog';
import * as fs from 'fs';

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);

describe('loadRecentFiles', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when file does not exist', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    expect(loadRecentFiles()).toEqual([]);
  });

  it('returns parsed entries when file is valid JSON array', () => {
    const entries = [{ filePath: '/a.psd', name: 'a.psd', openedAt: '2026-01-01T00:00:00Z' }];
    mockReadFileSync.mockReturnValue(JSON.stringify(entries));
    expect(loadRecentFiles()).toEqual(entries);
  });

  it('returns empty array when file contains invalid JSON', () => {
    mockReadFileSync.mockReturnValue('not json');
    expect(loadRecentFiles()).toEqual([]);
  });

  it('returns empty array when file contains non-array JSON', () => {
    mockReadFileSync.mockReturnValue('{"key": "value"}');
    expect(loadRecentFiles()).toEqual([]);
  });
});

describe('saveRecentFiles', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('writes JSON to the recent-files path', () => {
    const entries = [{ filePath: '/b.psd', name: 'b.psd', openedAt: '2026-02-01T00:00:00Z' }];
    saveRecentFiles(entries);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [, data] = mockWriteFileSync.mock.calls[0];
    expect(JSON.parse(data as string)).toEqual(entries);
  });

  it('does not throw on write error (EPERM)', () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('EPERM'); });
    expect(() => saveRecentFiles([])).not.toThrow();
  });
});

describe('addRecentFile', () => {
  beforeEach(() => { vi.clearAllMocks(); mockReadFileSync.mockReturnValue('[]'); });

  it('adds entry to the front of the list', () => {
    const result = addRecentFile('/new.psd');
    expect(result.length).toBe(1);
    expect(result[0].filePath).toBe('/new.psd');
    expect(result[0].name).toBe('new.psd');
  });

  it('deduplicates by filePath', () => {
    const existing = [{ filePath: '/dup.psd', name: 'dup.psd', openedAt: '2026-01-01T00:00:00Z' }];
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));
    const result = addRecentFile('/dup.psd');
    expect(result.length).toBe(1);
    expect(result[0].filePath).toBe('/dup.psd');
  });

  it('trims to max 10 entries', () => {
    const existing = Array.from({ length: 12 }, (_, i) => ({
      filePath: `/file${i}.psd`, name: `file${i}.psd`, openedAt: '2026-01-01T00:00:00Z',
    }));
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));
    const result = addRecentFile('/newest.psd');
    expect(result.length).toBe(10);
    expect(result[0].filePath).toBe('/newest.psd');
  });
});
