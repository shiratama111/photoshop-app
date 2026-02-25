/**
 * @module app-010-image-export.test
 * Tests for PNG/JPEG image export (APP-010).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './store';
import { t } from './i18n';

// Mock OffscreenCanvas for Node.js test environment
const mockBlob = {
  arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(1000))),
};

const mockExportCtx = {
  canvas: { width: 800, height: 600 },
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: '',
  save: vi.fn(),
  restore: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  putImageData: vi.fn(),
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  filter: 'none',
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  scale: vi.fn(),
  translate: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  createPattern: vi.fn(() => null),
};

vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
  getContext: vi.fn(() => mockExportCtx),
  convertToBlob: vi.fn(() => Promise.resolve(mockBlob)),
  width: 800,
  height: 600,
})));

// Mock electronAPI on window for Node.js test environment
const mockExportFile = vi.fn<
  (data: ArrayBuffer, defaultPath?: string) => Promise<string | null>
>(() => Promise.resolve('/exported/TestDoc.png'));
const mockElectronAPI = {
  exportFile: mockExportFile,
  setTitle: vi.fn(() => Promise.resolve()),
  saveFile: vi.fn(() => Promise.resolve(null)),
  openFile: vi.fn(() => Promise.resolve(null)),
  loadRecentFiles: vi.fn(() => Promise.resolve([])),
  autoSaveClear: vi.fn(() => Promise.resolve()),
};

vi.stubGlobal('window', { electronAPI: mockElectronAPI });

function resetStore(): void {
  useAppStore.setState({
    document: null,
    activeTool: 'select',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    statusMessage: t('status.ready'),
    showAbout: false,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
    contextMenu: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('TestDoc', 800, 600);
}

describe('APP-010: Image Export', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    // Re-set mock return values after clearAllMocks
    mockExportFile.mockImplementation(() => Promise.resolve('/exported/TestDoc.png'));
  });

  it('should export as PNG by default', async () => {
    createTestDocument();

    await useAppStore.getState().exportAsImage();

    expect(mockExportFile).toHaveBeenCalled();
    const state = useAppStore.getState();
    expect(state.statusMessage).toContain(t('status.exported'));
  });

  it('should export as JPEG when specified', async () => {
    createTestDocument();
    mockExportFile.mockImplementation(() => Promise.resolve('/exported/TestDoc.jpg'));

    await useAppStore.getState().exportAsImage('jpeg');

    expect(mockExportFile).toHaveBeenCalled();
    // Default name should have .jpg extension
    const callArgs = mockExportFile.mock.calls[0];
    expect(callArgs[1]).toContain('.jpg');
  });

  it('should show error when no document is open', async () => {
    // No document created
    await useAppStore.getState().exportAsImage();

    const state = useAppStore.getState();
    expect(state.statusMessage).toContain(t('status.noDocumentToExport'));
  });

  it('should handle export cancellation gracefully', async () => {
    createTestDocument();
    mockExportFile.mockImplementation(() => Promise.resolve(null));

    await useAppStore.getState().exportAsImage();

    // No crash, status message should not say "Exported"
    const state = useAppStore.getState();
    expect(state.statusMessage).not.toContain(t('status.exported'));
  });

  it('should support WebP export', async () => {
    createTestDocument();
    mockExportFile.mockImplementation(() => Promise.resolve('/exported/TestDoc.webp'));

    await useAppStore.getState().exportAsImage('webp');

    expect(mockExportFile).toHaveBeenCalled();
    const callArgs = mockExportFile.mock.calls[0];
    expect(callArgs[1]).toContain('.webp');
  });

  it('should use document name for default export filename', async () => {
    createTestDocument();
    mockExportFile.mockImplementation(() => Promise.resolve('/exported/TestDoc.png'));

    await useAppStore.getState().exportAsImage('png');

    const callArgs = mockExportFile.mock.calls[0];
    expect(callArgs[1]).toBe('TestDoc.png');
  });
});
