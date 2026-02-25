/**
 * @module text-side-effects.test
 * PS-TEXT-007: Side-effect isolation tests.
 *
 * Verifies that text operations (create, edit, stop) do NOT modify
 * unrelated state such as brush settings, selection, pan/zoom, or activeTool.
 *
 * @see docs/agent-briefs/PS-TEXT-007-MANUAL-CHECKLIST.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store';

// ---------------------------------------------------------------------------
// DOM / global mocks for Node.js test environment
// ---------------------------------------------------------------------------

vi.stubGlobal('OffscreenCanvas', vi.fn(() => ({
  getContext: vi.fn(() => ({
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb' as const,
    })),
  })),
})));

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    editingTextLayerId: null,
    layerStyleDialog: null,
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PS-TEXT-007: Side-effect isolation', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should not modify brushSize/brushColor/brushOpacity/brushHardness after text operations', () => {
    createTestDocument();
    const store = useAppStore.getState();

    // Set brush state to known values
    store.setBrushSize(42);
    store.setBrushOpacity(0.7);
    store.setBrushHardness(0.3);
    store.setBrushColor({ r: 100, g: 50, b: 25, a: 0.8 });

    // Perform text operations
    store.addTextLayerAt(100, 200);
    const layerId = useAppStore.getState().editingTextLayerId!;
    useAppStore.getState().setTextProperty(layerId, 'text', 'Side-effect test');
    useAppStore.getState().startEditingText(layerId);
    useAppStore.getState().stopEditingText(layerId);

    // Assert brush state is unchanged
    const state = useAppStore.getState();
    expect(state.brushSize).toBe(42);
    expect(state.brushOpacity).toBe(0.7);
    expect(state.brushHardness).toBe(0.3);
    expect(state.brushColor).toEqual({ r: 100, g: 50, b: 25, a: 0.8 });
  });

  it('should not modify selection rect after text operations', () => {
    createTestDocument();
    const store = useAppStore.getState();

    // Set a selection rectangle
    store.setSelection({ x: 10, y: 20, width: 100, height: 50 });
    expect(useAppStore.getState().selection).toEqual({ x: 10, y: 20, width: 100, height: 50 });

    // Perform text operations
    store.addTextLayerAt(300, 400);
    const layerId = useAppStore.getState().editingTextLayerId!;
    useAppStore.getState().setTextProperty(layerId, 'text', 'Selection test');
    useAppStore.getState().stopEditingText(layerId);

    // Assert selection is unchanged
    expect(useAppStore.getState().selection).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('should not change panOffset or zoom after text operations', () => {
    createTestDocument();

    // Set known panOffset and zoom
    useAppStore.setState({ panOffset: { x: 55, y: -30 }, zoom: 2.5 });

    const store = useAppStore.getState();
    store.addTextLayerAt(50, 50);
    const layerId = useAppStore.getState().editingTextLayerId!;
    useAppStore.getState().setTextProperty(layerId, 'text', 'Pan/zoom test');
    useAppStore.getState().stopEditingText(layerId);

    // Assert panOffset and zoom unchanged
    const state = useAppStore.getState();
    expect(state.panOffset).toEqual({ x: 55, y: -30 });
    expect(state.zoom).toBe(2.5);
  });

  it('should not change activeTool after text editing lifecycle', () => {
    createTestDocument();

    // Set activeTool to 'text'
    useAppStore.setState({ activeTool: 'text' });

    const store = useAppStore.getState();
    store.addTextLayerAt(100, 100);
    const layerId = useAppStore.getState().editingTextLayerId!;
    useAppStore.getState().setTextProperty(layerId, 'text', 'Tool test');
    useAppStore.getState().startEditingText(layerId);
    useAppStore.getState().stopEditingText(layerId);

    // Assert activeTool is still 'text'
    expect(useAppStore.getState().activeTool).toBe('text');
  });
});
