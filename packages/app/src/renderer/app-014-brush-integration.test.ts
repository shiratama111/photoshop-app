/**
 * @module app-014-brush-integration.test
 * Tests for brush/eraser canvas integration (APP-014).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './store';

// Mock OffscreenCanvas
vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
  getContext: vi.fn(() => ({
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100*100*4), width: 100, height: 100 })),
  })),
})));

function resetStore(): void {
  useAppStore.setState({
    document: null, activeTool: 'select', zoom: 1,
    panOffset: { x: 0, y: 0 }, statusMessage: 'Ready',
    showAbout: false, selectedLayerId: null,
    canUndo: false, canRedo: false, revision: 0, contextMenu: null,
    brushSize: 10, brushHardness: 0.8, brushOpacity: 1,
    brushColor: { r: 0, g: 0, b: 0, a: 1 },
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

describe('APP-014: Brush/Eraser Integration', () => {
  beforeEach(() => { resetStore(); });

  it('should have default brush settings', () => {
    const state = useAppStore.getState();
    expect(state.brushSize).toBe(10);
    expect(state.brushHardness).toBe(0.8);
    expect(state.brushOpacity).toBe(1);
    expect(state.brushColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('should set brush size', () => {
    useAppStore.getState().setBrushSize(50);
    expect(useAppStore.getState().brushSize).toBe(50);
  });

  it('should clamp brush size to valid range', () => {
    useAppStore.getState().setBrushSize(0);
    expect(useAppStore.getState().brushSize).toBe(1);
    useAppStore.getState().setBrushSize(999);
    expect(useAppStore.getState().brushSize).toBe(500);
  });

  it('should set brush opacity', () => {
    useAppStore.getState().setBrushOpacity(0.5);
    expect(useAppStore.getState().brushOpacity).toBe(0.5);
  });

  it('should clamp brush opacity', () => {
    useAppStore.getState().setBrushOpacity(-1);
    expect(useAppStore.getState().brushOpacity).toBe(0);
    useAppStore.getState().setBrushOpacity(2);
    expect(useAppStore.getState().brushOpacity).toBe(1);
  });

  it('should set brush color', () => {
    useAppStore.getState().setBrushColor({ r: 255, g: 128, b: 0, a: 1 });
    expect(useAppStore.getState().brushColor).toEqual({ r: 255, g: 128, b: 0, a: 1 });
  });

  it('should set brush hardness', () => {
    useAppStore.getState().setBrushHardness(0.5);
    expect(useAppStore.getState().brushHardness).toBe(0.5);
  });

  it('should commit a brush stroke as an undoable command', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Paint Layer');
    const children = useAppStore.getState().document!.rootGroup.children;
    const layer = children[children.length - 1];
    expect(layer.type).toBe('raster');
    const region = { x: 10, y: 10, width: 20, height: 20 };
    const oldPixels = new Uint8ClampedArray(20 * 20 * 4);
    const newPixels = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < newPixels.length; i += 4) { newPixels[i] = 255; newPixels[i+3] = 255; }
    store.commitBrushStroke(layer.id, region, oldPixels, newPixels);
    expect(useAppStore.getState().canUndo).toBe(true);
    expect(useAppStore.getState().document?.dirty).toBe(true);
  });

  it('should undo a brush stroke', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addRasterLayer('Undo Paint');
    const children = useAppStore.getState().document!.rootGroup.children;
    const layer = children[children.length - 1];
    const region = { x: 0, y: 0, width: 10, height: 10 };
    const oldPixels = new Uint8ClampedArray(10 * 10 * 4);
    const newPixels = new Uint8ClampedArray(10 * 10 * 4);
    newPixels.fill(255);
    store.commitBrushStroke(layer.id, region, oldPixels, newPixels);
    expect(useAppStore.getState().canUndo).toBe(true);
    store.undo();
    expect(useAppStore.getState().canRedo).toBe(true);
  });

  it('should ignore commitBrushStroke for non-raster layers', () => {
    createTestDocument();
    const store = useAppStore.getState();
    store.addTextLayer('Text', 'Hello');
    const children = useAppStore.getState().document!.rootGroup.children;
    const layer = children[children.length - 1];
    const region = { x: 0, y: 0, width: 10, height: 10 };
    const oldPixels = new Uint8ClampedArray(10 * 10 * 4);
    const newPixels = new Uint8ClampedArray(10 * 10 * 4);
    store.commitBrushStroke(layer.id, region, oldPixels, newPixels);
    expect(useAppStore.getState().canUndo).toBe(true);
  });
});
