/**
 * @module app-012-layer-resize.test
 * Tests for layer resize functionality (APP-012).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RasterLayer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';

// Mock OffscreenCanvas for Node.js test environment
const mockGetImageData = vi.fn(() => ({
  data: new Uint8ClampedArray(200 * 150 * 4),
  width: 200,
  height: 150,
  colorSpace: 'srgb' as const,
}));

const mockCtx = {
  putImageData: vi.fn(),
  drawImage: vi.fn(),
  getImageData: mockGetImageData,
};

vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
  getContext: vi.fn(() => mockCtx),
})));

// Mock ImageData constructor for Node.js
vi.stubGlobal('ImageData', class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: string;
  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = maybeHeight!;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
    this.colorSpace = 'srgb';
  }
});

function resetStore(): void {
  useAppStore.setState({
    document: null,
    activeTool: 'select',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    statusMessage: 'Ready',
    showAbout: false,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
    contextMenu: null,
    transformActive: false,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

/** Helper: give a raster layer real pixel data so resizeLayer can work. */
function giveLayerPixels(layerId: string, width: number, height: number): void {
  const doc = useAppStore.getState().document;
  if (!doc) return;
  const layer = findLayerById(doc.rootGroup, layerId);
  if (!layer || layer.type !== 'raster') return;
  const raster = layer as RasterLayer;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
  raster.imageData = new ImageData(data, width, height);
  raster.bounds = { x: 0, y: 0, width, height };
}

describe('APP-012: Layer Resize', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('should have resizeLayer action on the store', () => {
    expect(typeof useAppStore.getState().resizeLayer).toBe('function');
  });

  it('should have setTransformActive action on the store', () => {
    expect(typeof useAppStore.getState().setTransformActive).toBe('function');
  });

  it('should toggle transformActive state', () => {
    useAppStore.getState().setTransformActive(true);
    expect(useAppStore.getState().transformActive).toBe(true);
    useAppStore.getState().setTransformActive(false);
    expect(useAppStore.getState().transformActive).toBe(false);
  });

  it('should have initial transformActive as false', () => {
    expect(useAppStore.getState().transformActive).toBe(false);
  });

  it('should resize a raster layer with pixel data', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Resize Me');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    expect(layer.type).toBe('raster');
    giveLayerPixels(layer.id, 100, 100);
    store.resizeLayer(layer.id, 200, 150);
    const state = useAppStore.getState();
    expect(state.statusMessage).toContain('Resized');
    expect(state.canUndo).toBe(true);
  });

  it('should not resize when no document is open', () => {
    useAppStore.getState().resizeLayer('nonexistent', 100, 100);
    expect(useAppStore.getState().statusMessage).toBe('Ready');
  });

  it('should not resize a layer without imageData', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('No Pixels');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    expect(layer.type).toBe('raster');
    // Force imageData to null for this test (store may initialize it in browser)
    (layer as RasterLayer).imageData = null;
    const msgBefore = useAppStore.getState().statusMessage;
    store.resizeLayer(layer.id, 200, 100);
    expect(useAppStore.getState().statusMessage).toBe(msgBefore);
  });

  it('should not resize a non-raster layer', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Text Layer', 'Hello');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    expect(layer.type).toBe('text');
    store.resizeLayer(layer.id, 200, 100);
    expect(useAppStore.getState().document).not.toBeNull();
  });

  it('should skip resize when dimensions are unchanged', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Same Size');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    giveLayerPixels(layer.id, 100, 100);
    const revBefore = useAppStore.getState().revision;
    store.resizeLayer(layer.id, 100, 100);
    expect(useAppStore.getState().revision).toBe(revBefore);
  });

  it('should be undoable after resize', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Undo Resize');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    giveLayerPixels(layer.id, 100, 100);
    store.resizeLayer(layer.id, 200, 150);
    expect(useAppStore.getState().canUndo).toBe(true);
    store.undo();
    expect(useAppStore.getState().canRedo).toBe(true);
  });

  it('should update status message with new dimensions', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Status Test');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    giveLayerPixels(layer.id, 100, 100);
    store.resizeLayer(layer.id, 200, 150);
    const msg = useAppStore.getState().statusMessage;
    expect(msg).toContain('200');
    expect(msg).toContain('150');
  });
});
