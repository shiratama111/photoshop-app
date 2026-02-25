/**
 * @module text-transform.test
 * Tests for text layer transform functionality (PS-TEXT-006, PS-TEXT-007).
 *
 * Verifies:
 * - resizeTextLayer updates textBounds + fontSize proportionally
 * - Undo/redo restores previous state
 * - Raster resizeLayer is unaffected (regression)
 * - Edge cases: min fontSize, no textBounds, unchanged dimensions
 * - PS-TEXT-007: Multi-step create→edit→resize undo/redo chain
 * - PS-TEXT-007: Raster layer isolation during text transform undo/redo
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TextLayer, RasterLayer } from '@photoshop-app/types';
import { findLayerById } from '@photoshop-app/core';
import { useAppStore } from '../../store';
import { t } from '../../i18n';

// Mock OffscreenCanvas for Node.js test environment (needed for raster regression test)
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
    statusMessage: t('status.ready'),
    showAbout: false,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
    contextMenu: null,
    transformActive: false,
    editingTextLayerId: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

/** Helper: set textBounds on a text layer. */
function setTextBounds(layerId: string, width: number, height: number): void {
  const doc = useAppStore.getState().document;
  if (!doc) return;
  const layer = findLayerById(doc.rootGroup, layerId);
  if (!layer || layer.type !== 'text') return;
  const textLayer = layer as TextLayer;
  textLayer.textBounds = { x: textLayer.position.x, y: textLayer.position.y, width, height };
}

/** Helper: give a raster layer pixel data. */
function giveLayerPixels(layerId: string, width: number, height: number): void {
  const doc = useAppStore.getState().document;
  if (!doc) return;
  const layer = findLayerById(doc.rootGroup, layerId);
  if (!layer || layer.type !== 'raster') return;
  const raster = layer as RasterLayer;
  const data = new Uint8ClampedArray(width * height * 4);
  raster.imageData = new ImageData(data, width, height);
  raster.bounds = { x: 0, y: 0, width, height };
}

describe('PS-TEXT-006: Text Layer Transform', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('should have resizeTextLayer action on the store', () => {
    expect(typeof useAppStore.getState().resizeTextLayer).toBe('function');
  });

  it('should update textBounds and fontSize when resizing a text layer', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Text 1', 'Hello');
    const doc = useAppStore.getState().document!;
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;
    expect(layer.type).toBe('text');

    // Set known textBounds
    setTextBounds(layerId, 100, 50);
    const oldFontSize = layer.fontSize; // 16 (default)

    // Resize to double width and height
    store.resizeTextLayer(layerId, 200, 100);

    expect(layer.textBounds).not.toBeNull();
    expect(layer.textBounds!.width).toBe(200);
    expect(layer.textBounds!.height).toBe(100);
    // scaleFactor = (200/100 + 100/50) / 2 = (2 + 2) / 2 = 2
    expect(layer.fontSize).toBe(oldFontSize * 2);
  });

  it('should increase fontSize when scaling up', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Scale Up', 'Big');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    setTextBounds(layerId, 100, 100);
    const oldFontSize = layer.fontSize;

    store.resizeTextLayer(layerId, 150, 150);

    // scaleFactor = (1.5 + 1.5) / 2 = 1.5
    expect(layer.fontSize).toBe(Math.max(1, Math.round(oldFontSize * 1.5)));
    expect(layer.fontSize).toBeGreaterThan(oldFontSize);
  });

  it('should keep fontSize stable when non-uniform resize preserves area', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Non-uniform', 'Area');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    setTextBounds(layerId, 100, 100);
    const oldFontSize = layer.fontSize;

    // area is unchanged: 100*100 -> 200*50
    store.resizeTextLayer(layerId, 200, 50);

    expect(layer.fontSize).toBe(oldFontSize);
  });

  it('should decrease fontSize when scaling down (min 1px)', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Scale Down', 'Tiny');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    setTextBounds(layerId, 100, 100);

    // Scale down drastically — fontSize should never go below 1
    store.resizeTextLayer(layerId, 1, 1);

    expect(layer.fontSize).toBeGreaterThanOrEqual(1);
  });

  it('should undo resizeTextLayer — restoring fontSize and textBounds', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Undo Test', 'Undo');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    setTextBounds(layerId, 100, 50);
    const oldFontSize = layer.fontSize;
    const oldTextBounds = { ...layer.textBounds! };

    store.resizeTextLayer(layerId, 200, 100);
    expect(layer.fontSize).not.toBe(oldFontSize);
    expect(useAppStore.getState().canUndo).toBe(true);

    // Undo
    useAppStore.getState().undo();
    expect(layer.fontSize).toBe(oldFontSize);
    expect(layer.textBounds).toEqual(oldTextBounds);
  });

  it('should redo after undo', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Redo Test', 'Redo');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    setTextBounds(layerId, 100, 50);
    const oldFontSize = layer.fontSize;

    store.resizeTextLayer(layerId, 200, 100);
    const newFontSize = layer.fontSize;
    expect(newFontSize).not.toBe(oldFontSize);

    // Undo
    useAppStore.getState().undo();
    expect(layer.fontSize).toBe(oldFontSize);

    // Redo
    useAppStore.getState().redo();
    expect(layer.fontSize).toBe(newFontSize);
    expect(layer.textBounds!.width).toBe(200);
    expect(layer.textBounds!.height).toBe(100);
  });

  it('should skip resize when dimensions are unchanged', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('No Change', 'Same');
    const layerId = useAppStore.getState().selectedLayerId!;

    setTextBounds(layerId, 100, 50);
    const revBefore = useAppStore.getState().revision;

    store.resizeTextLayer(layerId, 100, 50);
    expect(useAppStore.getState().revision).toBe(revBefore);
  });

  it('should handle textBounds being null (fallback estimate)', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('No Bounds', 'Test');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    // textBounds is null by default — should use fallback
    expect(layer.textBounds).toBeNull();

    store.resizeTextLayer(layerId, 200, 100);

    // Should have set textBounds
    expect(layer.textBounds).not.toBeNull();
    expect(layer.textBounds!.width).toBe(200);
    expect(layer.textBounds!.height).toBe(100);
    expect(layer.fontSize).toBeGreaterThanOrEqual(1);
  });

  it('should use text-metric fallback consistently when textBounds is null', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Metric Fallback', 'ABCDEFGHIJ');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;
    const oldFontSize = layer.fontSize;

    const lines = layer.text.split('\n');
    const oldWidth = Math.max(20, Math.max(...lines.map((line) => line.length)) * oldFontSize * 0.6);
    const oldHeight = Math.max(20, lines.length * oldFontSize * layer.lineHeight);

    store.resizeTextLayer(layerId, oldWidth * 2, oldHeight * 2);
    expect(layer.fontSize).toBe(oldFontSize * 2);
  });

  it('should clamp invalid target dimensions to at least 1px', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Clamp', 'Clamp');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    setTextBounds(layerId, 100, 100);
    store.resizeTextLayer(layerId, 0, -25);

    expect(layer.textBounds!.width).toBe(1);
    expect(layer.textBounds!.height).toBe(1);
    expect(layer.fontSize).toBeGreaterThanOrEqual(1);
  });

  it('should not affect raster resizeLayer (regression)', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Raster Regression');
    const layerId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId)!;
    expect(layer.type).toBe('raster');

    giveLayerPixels(layer.id, 100, 100);
    store.resizeLayer(layer.id, 200, 150);
    const state = useAppStore.getState();
    expect(state.statusMessage).toContain(t('status.resizedLayer'));
    expect(state.canUndo).toBe(true);
  });

  it('should not resize a non-text layer with resizeTextLayer', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Not Text');
    const layerId = useAppStore.getState().selectedLayerId!;

    const revBefore = useAppStore.getState().revision;
    store.resizeTextLayer(layerId, 200, 100);
    expect(useAppStore.getState().revision).toBe(revBefore);
  });

  it('should update status message with new dimensions', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Status Test', 'Hello');
    const layerId = useAppStore.getState().selectedLayerId!;

    setTextBounds(layerId, 100, 50);
    store.resizeTextLayer(layerId, 300, 200);

    const msg = useAppStore.getState().statusMessage;
    expect(msg).toContain('300');
    expect(msg).toContain('200');
  });
});

// ---------------------------------------------------------------------------
// PS-TEXT-007: Multi-step undo/redo for create→edit→resize
// ---------------------------------------------------------------------------

describe('PS-TEXT-007: Multi-step undo/redo for create→edit→resize', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('should undo resize→text-edit→create chain to original state', () => {
    createTestDocument();
    const doc = useAppStore.getState().document!;
    const store = useAppStore.getState();

    // Step 1: Create text layer (1 undo entry)
    store.addTextLayer('Transform Chain', 'Original');
    const layerId = useAppStore.getState().selectedLayerId!;
    const layer = findLayerById(doc.rootGroup, layerId) as TextLayer;

    // Step 2: Edit text (1 undo entry)
    useAppStore.getState().setTextProperty(layerId, 'text', 'Edited');

    // Step 3: Set textBounds (direct mutation, not undoable itself)
    setTextBounds(layerId, 100, 50);
    const oldFontSize = layer.fontSize;

    // Step 4: Resize (1 undo entry)
    useAppStore.getState().resizeTextLayer(layerId, 200, 100);
    const newFontSize = layer.fontSize;
    expect(newFontSize).not.toBe(oldFontSize);

    // Undo 3 times: resize → text edit → create
    useAppStore.getState().undo(); // undo resize
    expect(layer.fontSize).toBe(oldFontSize);

    useAppStore.getState().undo(); // undo text edit
    expect(layer.text).toBe('Original');

    useAppStore.getState().undo(); // undo create
    expect(findLayerById(doc.rootGroup, layerId)).toBeNull();

    // Redo 3 times: create → text edit → resize
    useAppStore.getState().redo(); // redo create
    expect(findLayerById(doc.rootGroup, layerId)).toBeDefined();

    useAppStore.getState().redo(); // redo text edit
    const restored = findLayerById(doc.rootGroup, layerId) as TextLayer;
    expect(restored.text).toBe('Edited');

    useAppStore.getState().redo(); // redo resize
    expect(restored.fontSize).toBe(newFontSize);
  });

  it('should not affect raster layer properties after text resize undo/redo', () => {
    createTestDocument();
    const store = useAppStore.getState();

    // Create a raster layer with known pixel data
    store.addRasterLayer('Raster Check');
    const rasterId = useAppStore.getState().selectedLayerId!;
    const doc = useAppStore.getState().document!;
    giveLayerPixels(rasterId, 100, 100);

    const rasterLayer = findLayerById(doc.rootGroup, rasterId) as RasterLayer;
    const rasterBoundsBefore = { ...rasterLayer.bounds! };

    // Create a text layer and resize it
    store.addTextLayer('Text Over Raster', 'Hello');
    const textId = useAppStore.getState().selectedLayerId!;
    setTextBounds(textId, 80, 40);
    useAppStore.getState().resizeTextLayer(textId, 160, 80);

    // Undo the text resize
    useAppStore.getState().undo();

    // Verify raster layer is completely unchanged
    const rasterAfter = findLayerById(doc.rootGroup, rasterId) as RasterLayer;
    expect(rasterAfter.bounds).toEqual(rasterBoundsBefore);
    expect(rasterAfter.type).toBe('raster');
  });
});
