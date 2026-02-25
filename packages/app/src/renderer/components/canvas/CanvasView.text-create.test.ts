/**
 * @module CanvasView.text-create.test
 * Store-level tests for text tool click-to-create behavior (PS-TEXT-003).
 *
 * Tests verify:
 * - addTextLayerAt creates a text layer at the specified position
 * - editingTextLayerId is set immediately after addTextLayerAt
 * - Existing text layer click starts editing without adding new layer
 * - Undo removes the created text layer
 * - Japanese/English mixed text stored correctly
 *
 * @see docs/agent-briefs/PS-TEXT-003.md
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

      const mixedText = 'テスト ABC 123';
      useAppStore.getState().setTextProperty(layerId, 'text', mixedText);

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(layer.text).toBe(mixedText);
    });

    it('should preserve text content after undo/redo of text change', () => {
      createTestDocument();
      useAppStore.getState().addTextLayerAt(0, 0);
      const layerId = useAppStore.getState().selectedLayerId!;

      useAppStore.getState().setTextProperty(layerId, 'text', '日本語テスト');
      useAppStore.getState().undo();

      const doc = useAppStore.getState().document!;
      const layer = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(layer.text).toBe('');

      useAppStore.getState().redo();
      const updated = findLayerById(doc.rootGroup, layerId)! as TextLayer;
      expect(updated.text).toBe('日本語テスト');
    });
  });
});
