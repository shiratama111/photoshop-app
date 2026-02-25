/**
 * @module CanvasView.text-create.test
 * Store-level tests for text tool click-to-create behavior (PS-TEXT-003, PS-TEXT-004, PS-TEXT-007).
 *
 * Tests verify:
 * - addTextLayerAt creates a text layer at the specified position
 * - editingTextLayerId is set immediately after addTextLayerAt
 * - Existing text layer click starts editing without adding new layer
 * - Single-click new/existing branching consistency
 * - Undo removes the created text layer
 * - Japanese/English mixed text stored correctly
 * - PS-TEXT-007: Multi-step undo/redo chain regression
 *
 * @see docs/agent-briefs/PS-TEXT-003.md
 * @see docs/agent-briefs/PS-TEXT-004.md
 * @see docs/agent-briefs/PS-TEXT-007-MANUAL-CHECKLIST.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { findLayerById, flattenLayers } from '@photoshop-app/core';
import type { TextLayer } from '@photoshop-app/types';
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
    textToolDefaults: {
      fontFamily: 'Arial',
      fontSize: 16,
      color: { r: 0, g: 0, b: 0, a: 1 },
      bold: false,
      italic: false,
      alignment: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
      writingMode: 'horizontal-tb',
      underline: false,
      strikethrough: false,
    },
  });
}

function createTestDocument(): void {
  useAppStore.getState().newDocument('Test', 800, 600);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PS-TEXT-003: Click-to-type text creation', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addTextLayerAt', () => {
    it('should create a text layer at the specified position', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(150, 200);

      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      const layer = findLayerById(doc.rootGroup, layerId)!;

      expect(layer.type).toBe('text');
      expect(layer.position).toEqual({ x: 150, y: 200 });
    });

    it('should set editingTextLayerId immediately', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(100, 100);

      const state = useAppStore.getState();
      expect(state.editingTextLayerId).not.toBeNull();
      expect(state.editingTextLayerId).toBe(state.selectedLayerId);
    });

    it('should create layer with empty text for immediate input', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(50, 50);

      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;

      expect(layer.text).toBe('');
    });

    it('should apply current text tool defaults to newly created text layer', () => {
      createTestDocument();
      const store = useAppStore.getState();
      store.setActiveTool('text');

      store.addTextLayer('Template', 'A');
      const templateId = useAppStore.getState().selectedLayerId!;
      store.setTextProperty(templateId, 'fontSize', 42);
      store.setTextProperty(templateId, 'fontFamily', 'Georgia');
      store.setTextProperty(templateId, 'bold', true);
      store.setTextProperty(templateId, 'writingMode', 'vertical-rl');
      store.stopEditingText(templateId);

      store.addTextLayerAt(220, 240);
      const createdId = useAppStore.getState().selectedLayerId!;
      const doc = useAppStore.getState().document!;
      const created = findLayerById(doc.rootGroup, createdId)! as TextLayer;

      expect(created.fontSize).toBe(42);
      expect(created.fontFamily).toBe('Georgia');
      expect(created.bold).toBe(true);
      expect(created.writingMode).toBe('vertical-rl');
    });

    it('should use custom name when provided', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(0, 0, 'Custom Name');

      const doc = useAppStore.getState().document!;
      const layerId = useAppStore.getState().selectedLayerId!;
      const layer = findLayerById(doc.rootGroup, layerId)!;

      expect(layer.name).toBe('Custom Name');
    });

    it('should not create layer when no document exists', () => {
      useAppStore.getState().addTextLayerAt(100, 100);
      expect(useAppStore.getState().selectedLayerId).toBeNull();
      expect(useAppStore.getState().editingTextLayerId).toBeNull();
    });
  });

  describe('existing text layer click (edit, not create)', () => {
    it('should start editing existing text layer via startEditingText', () => {
      createTestDocument();
      useAppStore.getState().addTextLayer('Existing', 'Hello');
      const existingId = useAppStore.getState().selectedLayerId!;

      // Stop editing
      useAppStore.getState().stopEditingText();

      const doc = useAppStore.getState().document!;
      const layerCountBefore = flattenLayers(doc.rootGroup).length;

      // Start editing the existing layer
      useAppStore.getState().startEditingText(existingId);

      const layerCountAfter = flattenLayers(doc.rootGroup).length;
      expect(layerCountAfter).toBe(layerCountBefore);
      expect(useAppStore.getState().editingTextLayerId).toBe(existingId);
    });
  });

  describe('undo/redo', () => {
    it('should undo text layer creation', () => {
      createTestDocument();
      const doc = useAppStore.getState().document!;
      const layerCountBefore = flattenLayers(doc.rootGroup).length;

      useAppStore.getState().addTextLayerAt(200, 300);
      expect(flattenLayers(doc.rootGroup).length).toBe(layerCountBefore + 1);

      useAppStore.getState().undo();
      expect(flattenLayers(doc.rootGroup).length).toBe(layerCountBefore);
    });

    it('should redo text layer creation', () => {
      createTestDocument();
      const doc = useAppStore.getState().document!;
      const layerCountBefore = flattenLayers(doc.rootGroup).length;

      useAppStore.getState().addTextLayerAt(200, 300);
      useAppStore.getState().undo();
      expect(flattenLayers(doc.rootGroup).length).toBe(layerCountBefore);

      useAppStore.getState().redo();
      expect(flattenLayers(doc.rootGroup).length).toBe(layerCountBefore + 1);
    });

    it('should preserve position after undo/redo', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(123, 456);
      const layerId = useAppStore.getState().selectedLayerId!;

      useAppStore.getState().undo();
      useAppStore.getState().redo();

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)!;
      expect(layer.position).toEqual({ x: 123, y: 456 });
    });
  });

  describe('Japanese/English mixed text', () => {
    it('should store and retrieve mixed Japanese/English text', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(0, 0);
      const layerId = useAppStore.getState().selectedLayerId!;

      const mixedText = '\u30c6\u30b9\u30c8ABC 123';
      useAppStore.getState().setTextProperty(layerId, 'text', mixedText);

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(layer.text).toBe(mixedText);
    });

    it('should preserve text content after undo/redo of text change', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(0, 0);
      const layerId = useAppStore.getState().selectedLayerId!;

      useAppStore.getState().setTextProperty(layerId, 'text', '\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8');
      useAppStore.getState().undo();

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(layer.text).toBe('');

      useAppStore.getState().redo();
      const updated = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(updated.text).toBe('\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8');
    });
  });

  describe('text layer naming from typed content', () => {
    it('should auto-rename default text layer name using typed content', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(120, 120);
      const layerId = useAppStore.getState().selectedLayerId!;

      useAppStore.getState().setTextProperty(layerId, 'text', '契約書レビュー draft');

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(layer.name).toBe('契約書レビュー draft');
    });

    it('should keep manually assigned names while text content changes', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(10, 10, 'Cover Copy');
      const layerId = useAppStore.getState().selectedLayerId!;

      useAppStore.getState().setTextProperty(layerId, 'text', 'Top secret body');

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(layer.name).toBe('Cover Copy');
    });
  });
});

// ---------------------------------------------------------------------------
// PS-TEXT-004: Single-click branching & editingTextLayerId consistency
// ---------------------------------------------------------------------------

describe('PS-TEXT-004: Single-click new/existing branching', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should set editingTextLayerId on new layer and clear on stop', () => {
    createTestDocument();
    useAppStore.getState().addTextLayerAt(100, 100);
    const layerId = useAppStore.getState().editingTextLayerId;
    expect(layerId).not.toBeNull();

    useAppStore.getState().stopEditingText(layerId!);
    expect(useAppStore.getState().editingTextLayerId).toBeNull();
  });

  it('should not increase layer count when starting edit on existing text', () => {
    createTestDocument();
    useAppStore.getState().addTextLayer('Existing', 'Hello');
    const existingId = useAppStore.getState().selectedLayerId!;
    useAppStore.getState().stopEditingText();

    const doc = useAppStore.getState().document!;
    const countBefore = flattenLayers(doc.rootGroup).length;

    useAppStore.getState().startEditingText(existingId);
    expect(flattenLayers(doc.rootGroup).length).toBe(countBefore);
    expect(useAppStore.getState().editingTextLayerId).toBe(existingId);
  });

  it('should allow sequential create → stop → create cycles', () => {
    createTestDocument();
    const doc = useAppStore.getState().document!;

    // First create
    useAppStore.getState().addTextLayerAt(10, 10);
    const firstId = useAppStore.getState().editingTextLayerId!;
    useAppStore.getState().setTextProperty(firstId, 'text', 'First');
    useAppStore.getState().stopEditingText(firstId);
    expect(useAppStore.getState().editingTextLayerId).toBeNull();

    // Second create
    useAppStore.getState().addTextLayerAt(200, 200);
    const secondId = useAppStore.getState().editingTextLayerId!;
    expect(secondId).not.toBe(firstId);
    useAppStore.getState().setTextProperty(secondId, 'text', 'Second');
    useAppStore.getState().stopEditingText(secondId);

    // Both layers should exist
    const layers = flattenLayers(doc.rootGroup).filter((l) => l.type === 'text');
    expect(layers.length).toBeGreaterThanOrEqual(2);
    const texts = layers.map((l) => (l as TextLayer).text);
    expect(texts).toContain('First');
    expect(texts).toContain('Second');
  });

  it('should preserve テスト ABC 123 through full create → edit → stop cycle', () => {
    createTestDocument();
    useAppStore.getState().addTextLayerAt(50, 50);
    const layerId = useAppStore.getState().editingTextLayerId!;

    const text = 'テスト ABC 123';
    useAppStore.getState().setTextProperty(layerId, 'text', text);
    useAppStore.getState().stopEditingText(layerId);

    const doc = useAppStore.getState().document!;
    const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
    expect(layer.text).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// PS-TEXT-007: Multi-step undo/redo regression
// ---------------------------------------------------------------------------

describe('PS-TEXT-007: Multi-step undo/redo regression', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should undo create→edit→create chain and restore all layers', () => {
    createTestDocument();
    const doc = useAppStore.getState().document!;
    const baseCount = flattenLayers(doc.rootGroup).length;

    // Create layer A and edit text
    useAppStore.getState().addTextLayerAt(10, 10);
    const idA = useAppStore.getState().selectedLayerId!;
    useAppStore.getState().setTextProperty(idA, 'text', 'Layer A');

    // Create layer B
    useAppStore.getState().addTextLayerAt(200, 200);
    expect(flattenLayers(doc.rootGroup).length).toBe(baseCount + 2);

    // Undo 3 times: create B → text edit A → create A
    useAppStore.getState().undo();
    useAppStore.getState().undo();
    useAppStore.getState().undo();
    expect(flattenLayers(doc.rootGroup).length).toBe(baseCount);

    // Redo 3 times: create A → text edit A → create B
    useAppStore.getState().redo();
    useAppStore.getState().redo();
    useAppStore.getState().redo();
    expect(flattenLayers(doc.rootGroup).length).toBe(baseCount + 2);

    const layerA = findLayerById(doc.rootGroup, idA) as TextLayer;
    expect(layerA.text).toBe('Layer A');
  });

  it('should preserve editingTextLayerId=null after undoing text creation', () => {
    createTestDocument();
    useAppStore.getState().addTextLayerAt(100, 100);
    const layerId = useAppStore.getState().editingTextLayerId!;
    expect(layerId).not.toBeNull();

    useAppStore.getState().stopEditingText(layerId);
    useAppStore.getState().undo();

    expect(useAppStore.getState().editingTextLayerId).toBeNull();
  });

  it('should handle rapid create→stop 5 times without layer leaks', () => {
    createTestDocument();
    const doc = useAppStore.getState().document!;
    const baseCount = flattenLayers(doc.rootGroup).length;

    for (let i = 0; i < 5; i++) {
      useAppStore.getState().addTextLayerAt(i * 50, i * 50);
      const id = useAppStore.getState().editingTextLayerId!;
      useAppStore.getState().setTextProperty(id, 'text', `Text ${i}`);
      useAppStore.getState().stopEditingText(id);
    }

    const textLayers = flattenLayers(doc.rootGroup).filter((l) => l.type === 'text');
    expect(textLayers.length).toBe(5);
    expect(flattenLayers(doc.rootGroup).length).toBe(baseCount + 5);
  });
});
