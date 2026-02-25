/**
 * @module app-009-image-import.test
 * Tests for PNG/JPEG/WebP image import (APP-009).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './store';
import { t } from './i18n';

// Mock createImageBitmap and OffscreenCanvas for Node.js test environment
const mockImageData = {
  data: new Uint8ClampedArray(400 * 300 * 4),
  width: 400,
  height: 300,
};

const mockCtx = {
  drawImage: vi.fn(),
  getImageData: vi.fn(() => mockImageData),
};

const mockBitmap = {
  width: 400,
  height: 300,
  close: vi.fn(),
};

// Set up globals before tests
vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(mockBitmap)));
vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
  getContext: vi.fn(() => mockCtx),
})));

// Stub window global for Node.js test environment
const mockElectronAPI = {
  readFileByPath: vi.fn(),
  setTitle: vi.fn(() => Promise.resolve()),
  openFile: vi.fn(),
  saveFile: vi.fn(),
  exportFile: vi.fn(),
  writeTo: vi.fn(),
  getRecentFiles: vi.fn(() => Promise.resolve([])),
  clearRecentFiles: vi.fn(() => Promise.resolve(true)),
  autoSave: vi.fn(() => Promise.resolve(true)),
  autoSaveClear: vi.fn(() => Promise.resolve(true)),
  autoSaveClearAll: vi.fn(() => Promise.resolve(true)),
  listRecoveryFiles: vi.fn(() => Promise.resolve([])),
  readRecoveryFile: vi.fn(() => Promise.resolve(null)),
  confirmClose: vi.fn(),
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

describe('APP-009: Image Import', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    // Re-setup default mocks after clearAllMocks
    vi.mocked(globalThis.createImageBitmap).mockImplementation(() => Promise.resolve(mockBitmap));
  });

  it('should open a PNG file as a single-layer document', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/image.png', data: mockData });

    await useAppStore.getState().openFileByPath('/test/image.png');
    
    // Wait for async image processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.document).not.toBeNull();
    if (state.document) {
      expect(state.document.name).toBe('image.png');
      expect(state.document.canvas.size.width).toBe(400);
      expect(state.document.canvas.size.height).toBe(300);
      expect(state.document.rootGroup.children).toHaveLength(1);
      expect(state.document.rootGroup.children[0].type).toBe('raster');
      expect(state.document.rootGroup.children[0].name).toBe('Background');
    }
  });

  it('should open a JPEG file', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/photo.jpg', data: mockData });

    await useAppStore.getState().openFileByPath('/test/photo.jpg');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.document).not.toBeNull();
    expect(state.document?.name).toBe('photo.jpg');
  });

  it('should open a WebP file', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/image.webp', data: mockData });

    await useAppStore.getState().openFileByPath('/test/image.webp');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.document).not.toBeNull();
    expect(state.document?.name).toBe('image.webp');
  });

  it('should reject unsupported formats', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/file.bmp', data: mockData });

    await useAppStore.getState().openFileByPath('/test/file.bmp');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.document).toBeNull();
    expect(state.statusMessage).toContain(t('status.unsupportedFileFormat'));
  });

  it('should set document dimensions from the image', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/large.png', data: mockData });

    await useAppStore.getState().openFileByPath('/test/large.png');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.document?.canvas.size.width).toBe(400);
    expect(state.document?.canvas.size.height).toBe(300);
  });

  it('should create a raster layer with correct bounds', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/img.png', data: mockData });

    await useAppStore.getState().openFileByPath('/test/img.png');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    const layer = state.document?.rootGroup.children[0];
    if (layer && layer.type === 'raster') {
      expect(layer.bounds.width).toBe(400);
      expect(layer.bounds.height).toBe(300);
      expect(layer.bounds.x).toBe(0);
      expect(layer.bounds.y).toBe(0);
    }
  });

  it('should select the background layer after import', async () => {
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/img.png', data: mockData });

    await useAppStore.getState().openFileByPath('/test/img.png');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.selectedLayerId).not.toBeNull();
    expect(state.selectedLayerId).toBe(state.document?.rootGroup.children[0].id);
  });

  it('should handle createImageBitmap failure gracefully', async () => {
    vi.mocked(globalThis.createImageBitmap).mockRejectedValueOnce(new Error('Decode failed'));
    
    const mockData = new ArrayBuffer(100);
    mockElectronAPI.readFileByPath.mockResolvedValueOnce({ filePath: '/test/corrupt.png', data: mockData });

    await useAppStore.getState().openFileByPath('/test/corrupt.png');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const state = useAppStore.getState();
    expect(state.document).toBeNull();
    expect(state.statusMessage).toContain(t('status.failedOpenImage'));
  });
});
